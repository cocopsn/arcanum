// THE PORT TOWARDS THE AI for Forge (design §9.5, §10, §22.3). Frozen interface; forge/e3-ia replaces the STUB
// bodies in Phase 1 (src/forge/ai.ts, ai-drain.ts). The stub never mints a verdict and never opens anything: it
// answers «en cola» with the honest message of §10.7, and the simulated user is unavailable.

/** The 7 kinds of ForgeVerdictFields (§8.1). `mintTargetFor(cell, kind)` decides gate vs evidence. */
export type ForgeVerdictKind = "mision" | "expediente" | "entrevista" | "ontologia" | "gameday" | "retencion" | "diagnostico";

export type ForgeApoyo = "independiente" | "con_apoyo";
export type ForgeScope = "local" | "nativa";

export interface ForgeSubmitRequest {
  cellCode: string;
  kind: ForgeVerdictKind;
  scope: ForgeScope;
  /** mandatory for evidence submissions (apoyo-pendiente); for a gate it is taken from mission.submitted, never from here */
  apoyo?: ForgeApoyo;
  /** for a gate: id of the last mission.submitted of the cell at request time (set by submitForgeVerdict itself) */
  missionEventId?: string;
  /** ids of the evidence.recorded that ARE the artifact (artifact mode, §8.3) */
  artefactoEventIds?: string[];
  giroRespuesta?: string;
  retencionItemId?: string;
  respuesta?: string;
  local?: unknown;
}

export type ForgeSubmitResult =
  | { estado: "acunado"; eventId: string }
  | { estado: "en-cola"; motivo: string }
  | { estado: "rechazado"; error: "entrega-pendiente" | "giro-pendiente" | "apoyo-pendiente" | "invalid"; detalle?: string };

export interface SimulatedUserRequest {
  cellCode: string;
  itemId: string;
  fase: "preguntas" | "estructuracion" | "defensa";
  /** the learner's question (≤ 1,000 characters); travels as DATA under the lock */
  question: string;
}

export type SimulatedUserResult =
  | { estado: "respuesta"; reply: string; revealed: string[] }
  | { estado: "sin-ia"; motivo: string }
  | { estado: "limite"; reintentaEnS: number };

export const STUB_QUEUE_MOTIVO = "el evaluador desplegado todavía no tiene la acción Forge";

/** Ask for a Forge verdict. STUB: queues with the honest message; never mints, never opens. */
export async function submitForgeVerdict(req: ForgeSubmitRequest): Promise<ForgeSubmitResult> {
  void req;
  return { estado: "en-cola", motivo: STUB_QUEUE_MOTIVO };
}

/** Ask the simulated user of an `entrevista`. STUB: unavailable; never invents an answer. */
export async function askSimulatedUser(req: SimulatedUserRequest): Promise<SimulatedUserResult> {
  void req;
  return { estado: "sin-ia", motivo: "La entrevista necesita al usuario simulado (IA); tus preguntas quedan guardadas" };
}
