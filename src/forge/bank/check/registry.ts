import type { ForgeType } from "@/forge/bank/registry";
import type { BankCheckModule } from "@/lib/exercises-validate";

// LAZY map of the ingestion checks of the 16 Forge types (design §9.2, §22.3). One loader per type and NO static
// import, ever: validateBank loads only the types a bank brings, so a bank of another world loads none and no
// evaluator lands in the page chunk (budget-report checks it on the chunk map, §6.7). Nobody edits this file after
// Phase 0: a branch that owns a type replaces the module file ./<tipo>.ts, never this map.

export const CHECKS: Record<ForgeType, () => Promise<BankCheckModule>> = {
  prediccion: () => import("./prediccion"),
  desvanecido: () => import("./desvanecido"),
  historial: () => import("./historial"),
  mutantes: () => import("./mutantes"),
  contraejemplo: () => import("./contraejemplo"),
  senal: () => import("./senal"),
  entrevista: () => import("./entrevista"),
  expediente: () => import("./expediente"),
  retencion: () => import("./retencion"),
  giro: () => import("./giro"),
  sql: () => import("./sql"),
  ontologia: () => import("./ontologia"),
  forense: () => import("./forense"),
  permisos: () => import("./permisos"),
  recuperacion: () => import("./recuperacion"),
  gameday: () => import("./gameday"),
};
