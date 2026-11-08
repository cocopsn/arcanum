import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deepEqual, type CaseResult } from "@/lib/exercise";
import type { ExecRunner } from "@/lib/exercises-validate";

// CPython stand-in for runPy (design §11.1): the same contract as the Pyodide worker of src/lib/py-runner.ts
// (exec the program in a fresh namespace, call the function with each non-hint input, report a SyntaxError or a
// missing function as `syntaxError`, an exception per case as its `error`), so the forense harness can be tested
// against real SQLite. `PY` is false when no `python3`/`python`/`py -3` with sqlite3 exists: the tests that need it
// are skipped and the red-check script reports them «no ejecutado: sin CPython».

function findPython(): { cmd: string; args: string[] } | null {
  for (const [cmd, ...args] of [["python3"], ["python"], ["py", "-3"]] as string[][]) {
    const r = spawnSync(cmd!, [...args, "-c", "import sqlite3;print(1)"], { encoding: "utf8", timeout: 20000 });
    if (r.status === 0 && r.stdout.trim() === "1") return { cmd: cmd!, args };
  }
  return null;
}

export const PY_CMD = findPython();
export const PY = PY_CMD !== null;

// the same steps as RUNNER_PY in src/lib/py-runner.ts, reading the program from a file and the request from stdin
const DRIVER = `
import json, sys
_req = json.loads(sys.stdin.read())
with open(_req["file"], encoding="utf-8") as _f:
    _code = _f.read()
_out = {"syntaxError": None, "results": []}
_ns = {}
try:
    exec(compile(_code, "programa.py", "exec"), _ns)
except SyntaxError as _e:
    _out["syntaxError"] = "SyntaxError: " + str(_e.msg) + (" (linea " + str(_e.lineno) + ")" if _e.lineno else "")
except Exception as _e:
    _out["syntaxError"] = type(_e).__name__ + ": " + str(_e)
if _out["syntaxError"] is None:
    _fn = _ns.get(_req["functionName"])
    if not callable(_fn):
        _out["syntaxError"] = "No se encontro la funcion " + _req["functionName"]
    else:
        for _args in _req["inputs"]:
            try:
                _out["results"].append({"ok": True, "value": _fn(*list(_args))})
            except Exception as _e:
                _out["results"].append({"ok": False, "error": type(_e).__name__ + ": " + str(_e)})
print(json.dumps(_out))
`;

/** runPy's shape over CPython: writes the program to a temporary file and calls `functionName` once per case. */
export const cpythonRunner: ExecRunner = async (code, functionName, cases) => {
  if (!PY_CMD) return { syntaxError: null, cases: [], pyUnavailable: true };
  const real = cases.filter((c) => !c.hint);
  const dir = mkdtempSync(join(tmpdir(), "forge-cpython-"));
  try {
    const file = join(dir, "programa.py");
    const driver = join(dir, "driver.py");
    writeFileSync(file, code, "utf8");
    writeFileSync(driver, DRIVER, "utf8");
    const r = spawnSync(PY_CMD.cmd, [...PY_CMD.args, driver], {
      input: JSON.stringify({ file, functionName, inputs: real.map((c) => c.input) }),
      encoding: "utf8",
      timeout: 30000,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    if (r.error && (r.error as NodeJS.ErrnoException).code === "ETIMEDOUT") return { syntaxError: null, cases: [], timedOut: true };
    if (r.status !== 0) throw new Error(`CPython salió con ${r.status}: ${(r.stderr ?? "").slice(-400)}`);
    const parsed = JSON.parse(r.stdout.trim().split(/\r?\n/).pop()!) as { syntaxError: string | null; results: ({ ok: true; value: unknown } | { ok: false; error: string })[] };
    if (parsed.syntaxError) return { syntaxError: parsed.syntaxError, cases: [] };
    const out: CaseResult[] = real.map((c, i) => {
      const res = parsed.results[i];
      if (!res || !res.ok) return { input: c.input, expected: c.expected, error: res && !res.ok ? res.error : "sin resultado", pass: false };
      return { input: c.input, expected: c.expected, output: res.value, pass: deepEqual(res.value, c.expected) };
    });
    return { syntaxError: null, cases: out };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
