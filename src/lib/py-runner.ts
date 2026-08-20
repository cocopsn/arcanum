import type { CaseResult, RunResult, TestCase } from "@/lib/exercise";
import { deepEqual } from "@/lib/exercise";

// Offline PYTHON execution via Pyodide (real CPython in WebAssembly). Loaded ONCE from a CDN and cached
// by the Service Worker → runs 100% offline afterward (the user's condition: casi nunca hay datos). Runs
// in an ISOLATED Worker with a TIMEOUT that terminates a runaway. Level 1 = the REAL Python SyntaxError
// (line + message); Level 2 = deepEqual vs the saved cases. Honest degradation: if the runtime can't be
// fetched (first run offline / blocked), the caller shows "descarga el runtime de Python con conexión".

export const PYODIDE_VERSION = "0.26.4";
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

const RUNNER_PY = `
import json
_out = {"syntaxError": None, "results": []}
_ns = {}
try:
    exec(_code, _ns)
except SyntaxError as _e:
    _out["syntaxError"] = "SyntaxError: " + str(_e.msg) + (" (linea " + str(_e.lineno) + ")" if _e.lineno else "")
except Exception as _e:
    _out["syntaxError"] = type(_e).__name__ + ": " + str(_e)
if _out["syntaxError"] is None:
    _fn = _ns.get(_fn_name)
    if not callable(_fn):
        _out["syntaxError"] = "No se encontro la funcion \\u00ab" + _fn_name + "\\u00bb. Definela con ese nombre exacto."
    else:
        for _args in _inputs:
            try:
                _out["results"].append({"ok": True, "value": _fn(*list(_args))})
            except Exception as _e:
                _out["results"].append({"ok": False, "error": type(_e).__name__ + ": " + str(_e)})
json.dumps(_out)
`;

const WORKER_SRC = `
let _ready = null;
function boot() {
  if (!_ready) {
    importScripts("${PYODIDE_BASE}pyodide.js");
    _ready = loadPyodide({ indexURL: "${PYODIDE_BASE}" }).then(function (py) {
      // Sever the storage bridge: Pyodide's js module proxies this worker's globals, so a learner's
      // "import js; js.indexedDB.deleteDatabase('arcanum')" would otherwise reach the real event log.
      // 🔴 HARDENED (audit H3): the old sever used the SAME configurable:true shadow that was proven
      // bypassable in the JS worker — and Pyodide hands the learner full JS reflection (js.Object,
      // js.Reflect), so a delete / the prototype getter restored the live handle. Since Pyodide MUST
      // keep fetch/importScripts for package loads, a re-readable log meant "read AND exfiltrate" was
      // wide open. Now every prototype-chain level that owns the property is redefined non-configurable
      // and non-writable. (Declared debt #1/#2 stand: fetch survives, and the worker is a singleton.)
      ['indexedDB','caches','openDatabase','localStorage','sessionStorage','BroadcastChannel'].forEach(function (k) {
        var hit = false, o = self;
        while (o) { try { if (Object.getOwnPropertyDescriptor(o, k)) { Object.defineProperty(o, k, { value: undefined, configurable: false, writable: false }); hit = true; } } catch (_e) {} o = Object.getPrototypeOf(o); }
        if (!hit) { try { Object.defineProperty(self, k, { value: undefined, configurable: false, writable: false }); } catch (_e2) { try { self[k] = undefined; } catch (_e3) {} } }
      });
      return py;
    });
  }
  return _ready;
}
self.onmessage = async function (e) {
  const d = e.data;
  try {
    const py = await boot();
    py.globals.set("_code", d.code);
    py.globals.set("_fn_name", d.functionName);
    py.globals.set("_inputs", py.toPy(d.inputs));
    const out = await py.runPythonAsync(${JSON.stringify(RUNNER_PY)});
    self.postMessage({ ok: true, out: out });
  } catch (err) {
    self.postMessage({ loadError: String(err && err.message ? err.message : err) });
  }
};
`;

interface Reply {
  ok?: boolean;
  out?: string;
  loadError?: string;
  __timeout?: boolean;
}

let _worker: Worker | null = null;
let _url: string | null = null;
function worker(): Worker {
  if (!_worker) {
    _url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "application/javascript" }));
    _worker = new Worker(_url);
  }
  return _worker;
}
/** Drop the Pyodide worker (e.g. after a timeout kill). */
export function resetPy() {
  _worker?.terminate();
  _worker = null;
  if (_url) URL.revokeObjectURL(_url);
  _url = null;
}

/** Run the learner's Python against the (non-hint) cases. Returns a RunResult, or a `pyUnavailable`
 *  flag when the runtime couldn't be loaded (honest — the caller says "descárgalo con conexión"). */
export async function runPy(code: string, functionName: string, cases: TestCase[], timeoutMs = 15000): Promise<RunResult & { pyUnavailable?: boolean }> {
  const real = cases.filter((c) => !c.hint);
  if (typeof window === "undefined" || typeof Worker === "undefined") return { syntaxError: null, cases: [], pyUnavailable: true };
  const w = worker();
  const reply = await new Promise<Reply>((resolve) => {
    const timer = setTimeout(() => resolve({ __timeout: true }), timeoutMs);
    const onMsg = (e: MessageEvent) => {
      clearTimeout(timer);
      w.removeEventListener("message", onMsg);
      resolve(e.data as Reply);
    };
    w.addEventListener("message", onMsg);
    w.postMessage({ code, functionName, inputs: real.map((c) => c.input) });
  });
  if (reply.__timeout) {
    resetPy(); // terminate the runaway
    return { syntaxError: null, cases: [], timedOut: true };
  }
  if (reply.loadError) return { syntaxError: null, cases: [], pyUnavailable: true };
  let parsed: { syntaxError: string | null; results: ({ ok: true; value: unknown } | { ok: false; error: string })[] };
  try {
    parsed = JSON.parse(reply.out ?? "{}");
  } catch {
    return { syntaxError: null, cases: [], pyUnavailable: true };
  }
  if (parsed.syntaxError) return { syntaxError: parsed.syntaxError, cases: [] };
  const caseResults: CaseResult[] = real.map((c, i) => {
    const r = parsed.results[i];
    if (!r || !r.ok) return { input: c.input, expected: c.expected, error: r && !r.ok ? r.error : "sin resultado", pass: false };
    return { input: c.input, expected: c.expected, output: r.value, pass: deepEqual(r.value, c.expected) };
  });
  return { syntaxError: null, cases: caseResults };
}
