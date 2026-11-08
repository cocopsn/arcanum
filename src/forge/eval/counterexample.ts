import { deepEqual, type RunResult } from "@/lib/exercise";
import type { ExecRunner } from "@/lib/exercises-validate";
import type { ContraejemploData } from "@/forge/bank/types/contraejemplo";

// e · contraejemplo evaluator (design §5.1). Pure: it receives the runner (runJs in the app, a fake or execCode in
// the tests) and decides in TypeScript. One runJs call per program (D1): precondition, almost-correct version,
// reference, comparator and invariant each run in their own Worker with their own time limit. Every program gets a
// fresh clone of the arguments, so a program that sorts its input in place cannot change the next one's input.

export const CONTRA_ARGS_MAX = 20_000;

export type Outcome = { ok: true; value: unknown } | { ok: false; error: string };
export type ContraMotivo = "fuera-de-contrato" | "difiere" | "viola-invariante" | "coincide";
export interface ContraFacts {
  pre: boolean;
  casi: Outcome;
  ref: Outcome;
  same: boolean | null;
  prop: boolean | null;
  propRef: boolean | null;
}
export type ContraGrade =
  /** invalid JSON, not a list or longer than 20,000: nothing ran */
  | { estado: "rechazada"; motivo: string }
  /** the author's precondition did not finish with this input */
  | { estado: "tiempo" }
  /** pre/ref/same/prop do not compile or throw; ref does not finish: the bank's fault */
  | { estado: "error-item"; motivo: string }
  | { estado: "calificada"; correcto: boolean; motivo: ContraMotivo; casi?: Outcome; ref?: unknown };

/** The learner's arguments: a JSON list of at most 20,000 characters. */
export function parseContraArgs(raw: string): { ok: true; args: unknown[] } | { ok: false; error: string } {
  const text = raw ?? "";
  if (text.length > CONTRA_ARGS_MAX) return { ok: false, error: `La lista de argumentos pasa de ${CONTRA_ARGS_MAX.toLocaleString("en-US")} caracteres.` };
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return { ok: false, error: "No es JSON válido: escribe la lista de argumentos, por ejemplo [[1, 2], 3]." };
  }
  if (!Array.isArray(v)) return { ok: false, error: "Debe ser una lista de argumentos en JSON, por ejemplo [[1, 2], 3]." };
  return { ok: true, args: v };
}

/** The decision, in this order: outside the contract never counts; a different output counts; an output that
 *  violates the invariant counts only when the reference's output satisfies it. */
export function decideCounterexample(f: ContraFacts): { correcto: boolean; motivo: ContraMotivo } {
  if (f.pre !== true) return { correcto: false, motivo: "fuera-de-contrato" };
  if (f.same === false) return { correcto: true, motivo: "difiere" };
  if (f.prop === false && f.propRef === true) return { correcto: true, motivo: "viola-invariante" };
  return { correcto: false, motivo: "coincide" };
}

/** Thrown inside gradeCounterexample when the bank's own code fails; turned into `error-item`. */
class ItemError extends Error {}

const firstCase = (r: RunResult) => r.cases[0];
const NO_CORRIO: Outcome = { ok: false, error: "no corrió" };

export async function gradeCounterexample(d: ContraejemploData, args: unknown[], run: ExecRunner): Promise<ContraGrade> {
  const input = () => structuredClone(args);
  try {
    // (1) the author's precondition
    const p = await run(d.pre, "pre", [{ input: input(), expected: true }]);
    if (p.timedOut) return { estado: "tiempo" };
    if (p.syntaxError) throw new ItemError(`la precondición falló: ${p.syntaxError}`);
    const pc = firstCase(p);
    if (!pc || pc.error !== undefined) throw new ItemError(`la precondición falló: ${pc?.error ?? "sin resultado"}`);
    if (pc.output !== true) return { estado: "calificada", ...decideCounterexample({ pre: false, casi: NO_CORRIO, ref: NO_CORRIO, same: null, prop: null, propRef: null }) };

    // (2) the almost-correct version: a throw or a timeout is an observable difference
    const c = await run(d.casi, d.functionName, [{ input: input(), expected: null }]);
    if (c.syntaxError) throw new ItemError(`la casi correcta no compila: ${c.syntaxError}`);
    let casi: Outcome;
    if (c.timedOut) casi = { ok: false, error: "no terminó en 3 s" };
    else {
      const cc = firstCase(c);
      if (!cc) casi = { ok: false, error: "sin resultado" };
      else if (cc.error !== undefined) casi = { ok: false, error: cc.error };
      else casi = { ok: true, value: cc.output };
    }

    // (3) the reference: any failure inside the contract is the bank's fault
    const r = await run(d.referencia, d.functionName, [{ input: input(), expected: null }]);
    const rc = firstCase(r);
    if (r.syntaxError || r.timedOut || !rc || rc.error !== undefined) {
      throw new ItemError(`la referencia falló con una entrada dentro del contrato (${r.syntaxError ?? (r.timedOut ? "no terminó en 3 s" : rc?.error ?? "sin resultado")})`);
    }
    const ref = { ok: true as const, value: rc.output };

    // (4) same output?
    const runSame = async (a: unknown, b: unknown): Promise<boolean> => {
      const s = await run(d.comparador!, "same", [{ input: [structuredClone(a), structuredClone(b), input()], expected: true }]);
      const sc = firstCase(s);
      if (s.syntaxError || s.timedOut || !sc || sc.error !== undefined) {
        throw new ItemError(`el comparador falló (${s.syntaxError ?? (s.timedOut ? "no terminó en 3 s" : sc?.error ?? "sin resultado")})`);
      }
      return sc.output === true;
    };
    let same: boolean;
    if (!casi.ok) same = false;   // literal: una casi correcta que lanza o no termina difiere
    else if (d.comparador) same = await runSame(casi.value, ref.value);
    else same = deepEqual(casi.value, ref.value);

    // (5) the invariant, on both outputs, in one call
    let prop: boolean | null = null;
    let propRef: boolean | null = null;
    if (d.invariante && casi.ok) {
      const iv = await run(d.invariante, "prop", [
        { input: [input(), structuredClone(casi.value)], expected: true },
        { input: [input(), structuredClone(ref.value)], expected: true },
      ]);
      const [a, b] = iv.cases;
      if (iv.syntaxError || iv.timedOut || !a || !b || a.error !== undefined || b.error !== undefined) {
        throw new ItemError(`la invariante falló (${iv.syntaxError ?? (iv.timedOut ? "no terminó en 3 s" : a?.error ?? b?.error ?? "sin resultado")})`);
      }
      prop = a.output === true;
      propRef = b.output === true;
      if (prop === false && propRef === false) throw new ItemError("la referencia viola su propia invariante con esta entrada");
    }

    const dec = decideCounterexample({ pre: true, casi, ref, same, prop, propRef });
    return { estado: "calificada", correcto: dec.correcto, motivo: dec.motivo, casi, ref: ref.value };
  } catch (e) {
    if (e instanceof ItemError) return { estado: "error-item", motivo: e.message };
    throw e;
  }
}
