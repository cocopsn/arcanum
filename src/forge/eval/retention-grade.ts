import type { CaseResult, Lang } from "@/lib/exercise";
import type { ExecRunner } from "@/lib/exercises-validate";
import type { ReadModel } from "@/core/read-model";
import type { ForgeItemOf } from "@/forge/bank/registry";
import type { RetencionData } from "@/forge/bank/types/retencion";
import { presentForgeRetention } from "@/forge/model/retention";

// i · retencion evaluator (design §5.5; named so it is not confused with the presenter model/retention.ts). The
// gate is the presenter: an item is graded only when it is due (D5), and the presenter is pure given `nowMs` (the
// runner passes Date.now()). `forma: codigo` runs the learner's function against the item's cases; `forma: defensa`
// is judged by the AI through the existing submitForgeVerdict path.

export const RETENCION_RESPUESTA_MAX = 6_000;
export const RETENCION_CODIGO_MAX = 20_000;

export type RetentionStatus = { estado: "sin-agenda" } | { estado: "programada"; dueMs: number } | { estado: "vencida"; dueMs: number };

/** presentForgeRetention(rm, [{ cellId, items: [{ id: item.itemId, type: "retencion", dias }] }], nowMs) for one item. */
export function retentionStatus(rm: ReadModel, cellId: string, item: ForgeItemOf<"retencion">, nowMs: number): RetentionStatus {
  const view = presentForgeRetention(rm, [{ cellId, items: [{ id: item.itemId, type: "retencion", dias: item.data.dias }] }], nowMs);
  const vencido = view.vencidos[0];
  if (vencido) return { estado: "vencida", dueMs: vencido.dueMs };
  const proximo = view.proximos[0];
  if (proximo) return { estado: "programada", dueMs: proximo.dueMs };
  return { estado: "sin-agenda" };
}

export type CodeGrade =
  | { estado: "sin-python" }
  | { estado: "tiempo" }
  | { estado: "sintaxis"; motivo: string }
  | { estado: "calificada"; correcto: boolean; pasan: number; total: number; primerFallo?: CaseResult };

export async function gradeRetentionCode(d: Extract<RetencionData, { forma: "codigo" }>, lang: Lang, code: string, run: ExecRunner): Promise<CodeGrade> {
  const fn = d.functionName[lang];
  if (!fn) return { estado: "sintaxis", motivo: `el ítem no trae firma en ${lang}` };
  if (code.length > RETENCION_CODIGO_MAX) return { estado: "sintaxis", motivo: `tu función pasa de ${RETENCION_CODIGO_MAX.toLocaleString("en-US")} caracteres` };
  const r = await run(code, fn, d.casos.map((c) => ({ ...c, input: structuredClone(c.input) })));
  if (r.pyUnavailable) return { estado: "sin-python" };
  if (r.timedOut) return { estado: "tiempo" };
  if (r.syntaxError) return { estado: "sintaxis", motivo: r.syntaxError };
  const pasan = r.cases.filter((c) => c.pass).length;
  const total = r.cases.length;
  const primerFallo = r.cases.find((c) => !c.pass);
  return { estado: "calificada", correcto: total > 0 && pasan === total, pasan, total, ...(primerFallo ? { primerFallo } : {}) };
}
