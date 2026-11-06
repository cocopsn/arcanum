import { deepEqual, evaluateRun, formatValue, type RunResult, type TestCase } from "@/lib/exercise";
import { execCode } from "@/lib/js-runner";
import type { ParsedExerciseBank } from "@/lib/exercises-md";
import type { ForgeBankItem, ForgeType } from "@/forge/bank/registry";
import { CHECKS } from "@/forge/bank/check/registry";

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
  /** where the bank comes from (saveExerciseBank passes it). Absent: "seed" if trustPython, else "import". */
  source?: "seed" | "import";
}

/** ok: `pendientes` = ids (Exercise.id) of Forge items whose check is still the Phase-0 stub (§9.2). They are
 *  accepted but never offered. `missingCheck`: a lazy check chunk did not load (offline before the SW finished):
 *  the bank is not saved and the caller says «no descargado · requiere conexión una vez» (§6.3). */
export type ValidateResult = { ok: true; pendientes: string[] } | { ok: false; errors: string[]; missingCheck?: true };

// ── Forge ingestion-check contract (frozen in Phase 0, design §9.2 + obligation M1 of D6) ──────────────────────
//
// `check` reads the block's data (structure, cross-references, calculations in TypeScript). It NEVER executes
// code: its ctx.jsRun is a guard that refuses (M1). Author code (references, mutants, naive solutions, almost-
// correct versions, harnesses) runs ONLY in `js` (JavaScript) or `py` (Python and SQL), and ONLY when the bank is
// IMPORTED, through the runners the caller passes (runJs = shielded Worker with a 3 s timeout; runPy = Pyodide).
// In the SEED nothing executes: those steps were verified by scripts/forge/bank-check.mjs and recorded in
// content/forge/verification/<código>.json; authoring.ts only says «Verificado» when that run's sha10 matches the
// current .md (§5.7), and banks.test.ts enforces it at the integration gate.

export interface BankCheckContext {
  /** ValidateOpts.source, passed by saveExerciseBank */
  source: "seed" | "import";
  /** in `check`: a guard that refuses to execute (M1). In `js.check` (import only): the caller's Worker runner. */
  jsRun: ExecRunner;
  /** runPy at import; absent in the seed */
  pyRun?: ExecRunner;
}
export type BankCheck = (item: ForgeBankItem, ctx: BankCheckContext) => Promise<{ ok: true } | { ok: false; errors: string[] } | { disponible: false }>;
export type BankCheckJs = (item: ForgeBankItem, ctx: BankCheckContext) => Promise<{ ok: true } | { ok: false; errors: string[] }>;
export type BankCheckPy = (item: ForgeBankItem, ctx: BankCheckContext & { pyRun: ExecRunner }) => Promise<{ ok: true } | { ok: false; errors: string[] }>;
export interface BankCheckModule {
  /** structure and TypeScript calculation over the block's data: always runs, never executes code */
  check: BankCheck;
  /** JavaScript steps of the author (reference, mutants, naive, almost-correct): only at import, in the Worker */
  js?: { needs: (item: ForgeBankItem) => boolean; check: BankCheckJs };
  /** Python and SQL steps: only at import */
  py?: { needs: (item: ForgeBankItem) => boolean; check: BankCheckPy };
}

/** Thrown by the guard runner: someone tried to execute author code where the contract forbids it (M1). */
export class ExecutionRefused extends Error {
  constructor(where: string) {
    super(`la ingesta no ejecuta código del autor en ${where} (M1): ese paso va en js.check o py.check, sólo al importar, en el worker`);
    this.name = "ExecutionRefused";
  }
}
const refuse =
  (where: string): ExecRunner =>
  async () => {
    throw new ExecutionRefused(where);
  };
/** The runner a `check` receives, seed or import: it never executes anything. */
export const CHECK_GUARD_RUNNER: ExecRunner = refuse("check (estructura)");

class PyUnavailable extends Error {}

const itemLabel = (item: ForgeBankItem) => `«${item.title}» (${item.type})`;
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Lazy-load the check module of each Forge type the bank brings (only those: a bank of another world loads none). */
async function loadChecks(types: ForgeType[]): Promise<Map<ForgeType, BankCheckModule> | string> {
  const out = new Map<ForgeType, BankCheckModule>();
  for (const t of types) {
    try {
      out.set(t, (await CHECKS[t]()) as BankCheckModule);
    } catch (e) {
      return `no se pudo cargar el chequeo de ${t} — conéctate una vez para terminar de instalar (${errMsg(e)})`;
    }
  }
  return out;
}

/** The Forge part of validateBank: one rule for every type (pending, seed trust, M1). Lives only here. */
async function validateForgeItems(items: ForgeBankItem[], opts: ValidateOpts, source: "seed" | "import"): Promise<ValidateResult> {
  if (items.length === 0) return { ok: true, pendientes: [] };
  const mods = await loadChecks([...new Set(items.map((i) => i.type))]);
  if (typeof mods === "string") return { ok: false, errors: [mods], missingCheck: true };
  const errors: string[] = [];
  const pendientes: string[] = [];
  const checkCtx: BankCheckContext = { source, jsRun: CHECK_GUARD_RUNNER, ...(source === "import" && opts.pyRun ? { pyRun: opts.pyRun } : {}) };
  for (const item of items) {
    const mod = mods.get(item.type)!;
    let r: Awaited<ReturnType<BankCheck>>;
    try {
      r = await mod.check(item, checkCtx);
    } catch (e) {
      errors.push(`${itemLabel(item)}: ${errMsg(e)}`);
      continue;
    }
    if ("disponible" in r) {
      pendientes.push(item.id); // stub check → pending: accepted, not validated, never offered (§9.2)
      continue;
    }
    if (!r.ok) {
      errors.push(...r.errors); // a REAL check that fails rejects the whole bank (all-or-nothing)
      continue;
    }
    const needsJs = mod.js?.needs(item) === true;
    const needsPy = mod.py?.needs(item) === true;
    if (!needsJs && !needsPy) continue;
    // SEED TRUST (single rule, §9.2 + M1): in the seed, author code never runs — neither Python/SQL nor JS
    // (mutants, naive solutions). bank-check.mjs verified it (verification/<código>.json, sha10 of the .md).
    if (source === "seed") continue;
    if (needsJs) {
      if (!opts.jsRun) {
        errors.push(`${itemLabel(item)}: no hay un runtime aislado (worker) para validar los pasos JavaScript — importa el banco desde la app.`);
        continue;
      }
      try {
        const rj = await mod.js!.check(item, { source, jsRun: opts.jsRun, ...(opts.pyRun ? { pyRun: opts.pyRun } : {}) });
        if (!rj.ok) errors.push(...rj.errors);
      } catch (e) {
        errors.push(`${itemLabel(item)}: ${errMsg(e)}`);
      }
    }
    if (needsPy) {
      if (!opts.pyRun) {
        errors.push(`${itemLabel(item)}: no hay runtime para validar la solución de referencia — conéctate una vez para importar bancos con Python.`);
        continue;
      }
      const pyRun = opts.pyRun;
      const guardedPy: ExecRunner = async (code, fn, cases) => {
        const out = await pyRun(code, fn, cases);
        if (out.pyUnavailable) throw new PyUnavailable();
        return out;
      };
      try {
        const rp = await mod.py!.check(item, { source, jsRun: CHECK_GUARD_RUNNER, pyRun: guardedPy });
        if (!rp.ok) errors.push(...rp.errors);
      } catch (e) {
        if (e instanceof PyUnavailable) errors.push(`${itemLabel(item)}: runtime de Python no disponible — no se pudo validar.`);
        else errors.push(`${itemLabel(item)}: ${errMsg(e)}`);
      }
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, pendientes };
}

/** Run every code exercise's reference solution against its own cases. All pass → ok; else the exact
 *  failures. Choice exercises are structurally validated at parse time (answer in range), so they're skipped. */
export async function validateBank(bank: ParsedExerciseBank, opts: ValidateOpts = {}): Promise<ValidateResult> {
  const jsRun = opts.jsRun ?? defaultJsRun;
  const errors: string[] = [];
  const source = opts.source ?? (opts.trustPython ? "seed" : "import");
  const forge = await validateForgeItems(
    bank.exercises.filter((e): e is ForgeBankItem => e.kind === "forge"),
    opts,
    source,
  );
  if (!forge.ok && forge.missingCheck) return forge;
  if (!forge.ok) errors.push(...forge.errors);
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
  return errors.length ? { ok: false, errors } : { ok: true, pendientes: forge.ok ? forge.pendientes : [] };
}
