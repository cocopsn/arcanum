import type { RunResult, TestCase } from "@/lib/exercise";
import type { ExecRunner } from "@/lib/exercises-validate";
import type { MutantesData } from "@/forge/bank/types/mutantes";
import type { Outcome } from "@/forge/eval/counterexample";

// d · mutantes evaluator (design §5.2). The learner writes test cases; a case is VALID only when the reference
// returns its `expected` (a wrong expectation never kills a mutant). Each mutant runs, in its own runner call, only
// on the valid cases, with fresh copies of their inputs. Approved: at least one valid case, no critical mutant
// alive and at least `minimo` mutants killed. A mutant that does not finish counts as killed.

export const MUT_CASES_MAX = 50;
export const MUT_JSON_MAX = 20_000;

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/** The learner's cases: a JSON list of 1 to 50 `{ input: [...], expected }`. Only `input` and `expected` are kept
 *  (a learner's `hint: true` would make the runners skip the case). */
export function parseMutantCases(raw: string): { ok: true; casos: TestCase[] } | { ok: false; error: string } {
  const text = raw ?? "";
  if (text.length > MUT_JSON_MAX) return { ok: false, error: `Tus casos pasan de ${MUT_JSON_MAX.toLocaleString("en-US")} caracteres.` };
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return { ok: false, error: "No es JSON válido: escribe una lista de casos { \"input\": [...], \"expected\": ... }." };
  }
  if (!Array.isArray(v) || v.length === 0) return { ok: false, error: "Escribe una lista con al menos un caso { \"input\": [...], \"expected\": ... }." };
  if (v.length > MUT_CASES_MAX) return { ok: false, error: `Escribe a lo sumo ${MUT_CASES_MAX} casos.` };
  const malo = v.findIndex((c) => !isRecord(c) || !Array.isArray(c.input) || !("expected" in c));
  if (malo >= 0) return { ok: false, error: `El caso ${malo + 1} necesita «input» (una lista de argumentos) y «expected».` };
  const casos = (v as { input: unknown[]; expected: unknown }[]).map((c) => ({ input: c.input, expected: c.expected }));
  return { ok: true, casos };
}

/** Indices of the cases the reference passes (`pass === true`). */
export function validCaseIdx(ref: RunResult): number[] {
  return ref.cases.flatMap((c, i) => (c.pass === true ? [i] : []));
}

/** `mut` is the mutant's run over the cases it was given (in the app, only the valid ones; at ingestion, the golden
 *  ones). A timeout kills it; otherwise it dies when some case fails. */
export function killedBy(mut: RunResult & { timedOut?: boolean }): boolean {
  if (mut.timedOut) return true;
  return mut.cases.some((c) => !c.pass);
}

export function decideMutants(valid: number[], muertos: number, criticosVivos: number, minimo: number): boolean {
  return valid.length > 0 && criticosVivos === 0 && muertos >= minimo;
}

export interface MutantRun {
  idx: number;
  id: string;
  critico: boolean;
  muerto: boolean;
  porTiempo: boolean;
}
export type MutantsGrade =
  | { estado: "rechazada"; motivo: string }
  /** the reference did not finish with the learner's cases */
  | { estado: "tiempo" }
  /** a reference or mutant that does not compile: the bank's fault */
  | { estado: "error-item"; motivo: string }
  | {
      estado: "calificada";
      correcto: boolean;
      validos: number[];
      invalidos: { i: number; referencia: Outcome }[];
      mutantes: MutantRun[];
      muertos: number;
      criticosVivos: number;
    };

export async function gradeMutants(d: MutantesData, casos: TestCase[], run: ExecRunner): Promise<MutantsGrade> {
  const clones = () => casos.map((c) => ({ input: structuredClone(c.input), expected: c.expected }));
  const refRun = await run(d.referencia, d.functionName, clones());
  if (refRun.timedOut) return { estado: "tiempo" };
  if (refRun.syntaxError) return { estado: "error-item", motivo: `la referencia no compila: ${refRun.syntaxError}` };
  const valid = validCaseIdx(refRun);
  const invalidos = casos.flatMap((_, i) => {
    if (valid.includes(i)) return [];
    const c = refRun.cases[i];
    const referencia: Outcome = !c ? { ok: false, error: "sin resultado" } : c.error !== undefined ? { ok: false, error: c.error } : { ok: true, value: c.output };
    return [{ i, referencia }];
  });
  const mutantes: MutantRun[] = [];
  if (valid.length === 0) {
    d.mutantes.forEach((m, idx) => mutantes.push({ idx, id: m.id, critico: m.critico, muerto: false, porTiempo: false }));
  } else {
    for (const [idx, m] of d.mutantes.entries()) {
      const fresh = clones();
      const r = await run(m.code, d.functionName, valid.map((i) => fresh[i]!));
      if (r.syntaxError) return { estado: "error-item", motivo: `la versión sembrada ${idx + 1} no compila: ${r.syntaxError}` };
      mutantes.push({ idx, id: m.id, critico: m.critico, muerto: killedBy(r), porTiempo: !!r.timedOut });
    }
  }
  const muertos = mutantes.filter((m) => m.muerto).length;
  const criticosVivos = mutantes.filter((m) => m.critico && !m.muerto).length;
  return { estado: "calificada", correcto: decideMutants(valid, muertos, criticosVivos, d.minimo), validos: valid, invalidos, mutantes, muertos, criticosVivos };
}
