import { FORGE_GOAL_ID, FORGE_OPENING_KINDS } from "@/core/forge-verdict";
import { newEventId, type ArcanumEvent, type EventType, type Json } from "@/core/event";
import { forgeCellId } from "@/forge/ids";

// THE PORT TOWARDS THE AI for Forge (design §9.5, §10, §22.3). Frozen interface; Phase 1 bodies (forge/e3-ia).
// submitForgeVerdict ALWAYS leaves the submission in the log first (`ai.queued { kind: "forge" }`) and then tries
// to drain that one item right away: the verdict, when there is one, resolves the queue; when there is none, the
// item stays queued with its honest reason (§10.7). Enqueuing never opens anything. The drain and the context
// builder live behind a lazy import so the Forge AI code is not in the main chunk.

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
  /** id of the persona the question goes to (one of the item's personas); it travels as `context.persona` and the
   *  answered turn keeps it (interview-context.ts) */
  persona?: string;
  /** the learner's question (≤ 1,000 characters); travels as DATA under the lock */
  question: string;
}

export type SimulatedUserResult =
  | { estado: "respuesta"; reply: string; revealed: string[] }
  | { estado: "sin-ia"; motivo: string }
  /** the provider's content filter refused the question: the Edge's text; it is not a turn and reveals nothing */
  | { estado: "bloqueado"; motivo: string }
  | { estado: "limite"; reintentaEnS: number };

export const STUB_QUEUE_MOTIVO = "el evaluador desplegado todavía no tiene la acción Forge";

/** What the port needs from the app: read the log and write one event (returning its id). Bound by useActions
 *  (src/ui/use-actions.ts getForgeRuntime); tests may bind their own with bindForgeRuntime. */
export interface ForgeRuntime {
  events: () => Promise<ArcanumEvent[]>;
  fire: (type: EventType, payload: Json, refs: { goalId?: string | null; moduleId?: string | null }) => Promise<string>;
}

let runtime: ForgeRuntime | null = null;
export function bindForgeRuntime(rt: ForgeRuntime | null): void {
  runtime = rt;
}

/** Version of the static data the request was built with (sha10 of the master program the routes came from). */
export const FORGE_DATA_VERSION = "maestro";

const OPENING = new Set<string>(FORGE_OPENING_KINDS);

/** Ask for a Forge verdict: enqueue, then try to resolve that item now. */
export async function submitForgeVerdict(req: ForgeSubmitRequest): Promise<ForgeSubmitResult> {
  const rt = runtime ?? (await import("@/ui/use-actions")).getForgeRuntime();
  if (!rt) return { estado: "rechazado", error: "invalid", detalle: "la app no tiene el registro abierto" };
  const cellId = forgeCellId(req.cellCode);
  const events = await rt.events();
  const { lastMissionEventId } = await import("@/forge/ai");
  // For an opening kind the request names the mission.submitted it was built on; the drain reads entrega and
  // apoyo from THAT event, never from the caller (§9.5). For evidence the builder ignores it.
  const missionEventId = OPENING.has(req.kind) ? (lastMissionEventId(events, cellId) ?? undefined) : undefined;
  const input = {
    action: "forge_judge",
    kind: req.kind,
    cellCode: req.cellCode,
    scope: req.scope,
    // only evidence submissions carry apoyo (ForgeMission never passes it; a gate's apoyo is read from mission.submitted)
    ...(req.apoyo ? { apoyo: req.apoyo } : {}),
    ...(missionEventId ? { missionEventId } : {}),
    ...(req.giroRespuesta ? { giroRespuesta: req.giroRespuesta } : {}),
    ...(req.retencionItemId ? { retencionItemId: req.retencionItemId } : {}),
    ...(req.respuesta ? { respuesta: req.respuesta } : {}),
    ...(req.local !== undefined ? { local: req.local } : {}),
    ...(req.artefactoEventIds && req.artefactoEventIds.length ? { artefactoEventIds: req.artefactoEventIds } : {}),
    dataVersion: FORGE_DATA_VERSION,
  };
  const queueId = newEventId();
  const refs = { goalId: FORGE_GOAL_ID, moduleId: cellId };
  await rt.fire("ai.queued", { queueId, kind: "forge", input } as unknown as Json, refs);
  const { drainForgeItem, defaultDrainDeps } = await import("@/forge/ai-drain");
  const r = await drainForgeItem(
    { queueId, kind: "forge", moduleId: cellId, goalId: FORGE_GOAL_ID, input: input as unknown as Json, ts: Date.now() },
    { ...defaultDrainDeps, events: rt.events, fire: rt.fire },
  );
  if (r.outcome === "resolved") {
    if (r.kind === "invalida") {
      const m = r.motivo ?? "";
      const error = m === "entrega-pendiente" || m === "giro-pendiente" || m === "apoyo-pendiente" ? m : "invalid";
      return { estado: "rechazado", error, detalle: m };
    }
    return { estado: "acunado", eventId: r.eventId };
  }
  return { estado: "en-cola", motivo: r.motivo };
}

/** Ask the simulated user of an `entrevista`. A stub until InterviewConsole exists: honest unavailability, never an
 *  invented answer (§10.7). The pieces of its body are in src/forge/interview-context.ts: interviewTurnsFrom and
 *  buildInterviewContext before the Edge's `forge_interview`, interviewResultFrom and interviewTurnPayload after it. */
export async function askSimulatedUser(req: SimulatedUserRequest): Promise<SimulatedUserResult> {
  void req;
  return { estado: "sin-ia", motivo: "El usuario simulado requiere la versión nueva del evaluador; tus preguntas quedan guardadas" };
}
