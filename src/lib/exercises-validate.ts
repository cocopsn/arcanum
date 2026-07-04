import { deepEqual, evaluateRun, formatValue, type RunResult, type TestCase } from "@/lib/exercise";
import { execCode } from "@/lib/js-runner";
import type { ParsedExerciseBank } from "@/lib/exercises-md";

// AUTO-CONSISTENCY GATE — the critical ingestion check. Every code exercise's REFERENCE SOLUTION must pass
// its OWN test_cases when executed in the local engine BEFORE the bank is accepted. An AI-generated bank
// whose reference is wrong (a broken exercise) is REJECTED with a precise message (which exercise, which
// case) — never ingested. This is verified at RUNTIME (the real engine), not assumed. JS runs via execCode
// (synchronous, offline, deterministic → also unit-testable); Python needs Pyodide, so it takes an injected
// async runner (runPy in the app) and, for the BUNDLED seed, is TRUSTED (validated at build time by the
// round-trip test — Pyodide isn't available at first offline launch). No placebo: a python ref that can't
// be validated (no runtime, not trusted) is reported as an error, never silently accepted.

export type ExecRunner = (code: string, functionName: string, cases: TestCase[]) => Promise<RunResult & { pyUnavailable?: boolean }>;

/** Default JS runner: the tested synchronous engine (execCode), wrapped so the validator is uniform. */
const defaultJsRun: ExecRunner = async (code, functionName, cases) => {
  const real = cases.filter((c) => !c.hint);
  const out = execCode(code, functionName, real.map((c) => c.input));
  if ("syntaxError" in out) return { syntaxError: out.syntaxError, cases: [] };
  return {
    syntaxError: null,
    cases: real.map((c, i) => {
      const r = out.results[i];
      if (!r || !r.ok) return { input: c.input, expected: c.expected, error: r && !r.ok ? r.error : "sin resultado", pass: false };
      return { input: c.input, expected: c.expected, output: r.value, pass: deepEqual(r.value, c.expected) };
    }),
  };
};

export interface ValidateOpts {
  /** override the JS runner (app passes the shielded worker runJs; default = execCode) */
  jsRun?: ExecRunner;
  /** the Python runner (runPy in the app). Absent + not trusted → python refs report an honest error. */
  pyRun?: ExecRunner;
  /** trust python refs without running them — ONLY for the bundled seed (build-time validated). */
  trustPython?: boolean;
}

export type ValidateResult = { ok: true } | { ok: false; errors: string[] };

/** Run every code exercise's reference solution against its own cases. All pass → ok; else the exact
 *  failures. Choice exercises are structurally validated at parse time (answer in range), so they're skipped. */
export async function validateBank(bank: ParsedExerciseBank, opts: ValidateOpts = {}): Promise<ValidateResult> {
  const jsRun = opts.jsRun ?? defaultJsRun;
  const errors: string[] = [];
  for (const ex of bank.exercises) {
    if (ex.kind !== "code") continue;
    let result: RunResult & { pyUnavailable?: boolean };
    if (ex.lang === "python") {
      if (opts.trustPython) continue;
      if (!opts.pyRun) {
        errors.push(`«${ex.title}» (python): no hay runtime para validar la solución de referencia — conéctate una vez para importar bancos con Python.`);
        continue;
      }
      result = await opts.pyRun(ex.referenceSolution, ex.functionName, ex.testCases);
    } else {
      result = await jsRun(ex.referenceSolution, ex.functionName, ex.testCases);
    }
    if (result.pyUnavailable) {
      errors.push(`«${ex.title}» (${ex.lang}): runtime de Python no disponible — no se pudo validar.`);
      continue;
    }
    const ev = evaluateRun(result);
    if (!ev.allPass) {
      const ff = ev.firstFail;
      const detail = ff
        ? `input=${formatValue(ff.input.length === 1 ? ff.input[0] : ff.input)} esperado=${formatValue(ff.expected)} obtenido=${ff.error ?? formatValue(ff.output)}`
        : result.syntaxError ?? "sin casos";
      errors.push(`«${ex.title}» (${ex.lang}): la solución de referencia NO pasa sus propios test cases — ${detail}.`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
