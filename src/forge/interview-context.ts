import type { ArcanumEvent, Json } from "@/core/event";
import { validEvidence, type EvidenceRecordedPayload } from "@/core/evidence";
import type { SimulatedUserRequest, SimulatedUserResult } from "@/forge/ai-port";
import type { ForgeItemOf } from "@/forge/bank/registry";
import { forgeCodeForCellId } from "@/forge/ids";

// THE CLIENT SIDE OF forge_interview (design-poblar §9.4, anexo-r2 [9] and [23]). PURE: the context askSimulatedUser
// sends to the Edge, how it reads the Edge's answer, and how an answered turn is kept in the log and read back.
// askSimulatedUser stays a stub until InterviewConsole exists (§16); these functions are what its body will call.

/** One previous turn as the context carries it: `persona` is to whom the question went. */
export interface InterviewTurn {
  persona?: string;
  q: string;
  reply: string;
}

/** `body.context` of forge_interview (§9.1). The Edge validates it again; it cannot check the sheet against the bank. */
export interface InterviewContext {
  item: {
    brief: string;
    personas: { id: string; nombre: string; rol: string; estilo: string }[];
    hechos: { id: string; persona: string; texto: string; oculto: boolean; revela_si: string }[];
  };
  fase: SimulatedUserRequest["fase"];
  persona?: string;
  transcript: InterviewTurn[];
  question: string;
}

/** The Edge refuses a context of more than 40,000 characters (field «tamaño»); the client keeps 2,000 of margin. */
export const INTERVIEW_CONTEXT_MAX = 38_000;
/** The Edge takes at most 20 previous turns. */
export const INTERVIEW_MAX_TURNS = 20;

export const INTERVIEW_TEXTS = {
  sinRed: "El usuario simulado necesita conexión; tu pregunta queda aquí",
  /** an Edge without the action answers «Acción desconocida»: the same text as the stub of askSimulatedUser today */
  edgeVieja: "El usuario simulado requiere la versión nueva del evaluador; tus preguntas quedan guardadas",
  noDisponible: "El evaluador no está disponible",
  hojaGrande: "La hoja de hechos de este ítem es demasiado grande para el usuario simulado",
  /** a 422 without the Edge's text (the Edge always sends one) */
  bloqueado: "El proveedor de IA bloqueó el contenido por su política de seguridad; reformúlalo.",
} as const;

/** The motive of a 400 «Entrada inválida: <campo>». */
export const noEnviadaText = (campo: string): string => `No se pudo enviar la pregunta (${campo})`;

/** The Edge's limiter counts 12 requests per minute and per user. */
const LIMIT_WINDOW_S = 60;

/** The context of one question (§9.4): the sheet of the item, at most the last 20 turns and the question. While the
 *  JSON passes 38,000 characters the oldest turn goes; the last one stays while it fits. A sheet that does not fit
 *  even without turns is a defect of the bank: no call, and the code and item go to the console. */
export function buildInterviewContext(
  item: ForgeItemOf<"entrevista">,
  turns: readonly InterviewTurn[],
  req: { fase: SimulatedUserRequest["fase"]; persona?: string; question: string },
): { ok: true; context: InterviewContext } | { ok: false; motivo: string } {
  const sheet: InterviewContext["item"] = {
    brief: item.statement,
    personas: item.data.personas.map((p) => ({ id: p.id, nombre: p.nombre, rol: p.rol, estilo: p.estilo })),
    hechos: item.data.hechos.map((h) => ({ id: h.id, persona: h.persona, texto: h.texto, oculto: h.oculto, revela_si: h.revela_si })),
  };
  let transcript = turns.slice(-INTERVIEW_MAX_TURNS).map((t) => ({ ...(t.persona !== undefined ? { persona: t.persona } : {}), q: t.q, reply: t.reply }));
  const contextWith = (tr: InterviewTurn[]): InterviewContext => ({
    item: sheet,
    fase: req.fase,
    ...(req.persona !== undefined ? { persona: req.persona } : {}),
    transcript: tr,
    question: req.question,
  });
  while (transcript.length > 0 && JSON.stringify(contextWith(transcript)).length > INTERVIEW_CONTEXT_MAX) transcript = transcript.slice(1);
  const context = contextWith(transcript);
  const size = JSON.stringify(context).length;
  if (size > INTERVIEW_CONTEXT_MAX) {
    console.error(
      `forge_interview: la hoja de hechos de ${forgeCodeForCellId(item.moduleId) ?? item.moduleId ?? "?"} · ${item.itemId} mide ${size} caracteres sin vueltas (máximo ${INTERVIEW_CONTEXT_MAX})`,
    );
    return { ok: false, motivo: INTERVIEW_TEXTS.hojaGrande };
  }
  return { ok: true, context };
}

/** The Edge's answer → what the interview shows (the table of §9.4). `status` 0 = no HTTP answer (offline, or a fetch
 *  without response). Never throws and never makes up a reply. */
export function interviewResultFrom(status: number, body: unknown): SimulatedUserResult {
  const b = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const error = typeof b.error === "string" ? b.error : "";
  if (status === 0) return { estado: "sin-ia", motivo: INTERVIEW_TEXTS.sinRed };
  if (status === 200) {
    if (typeof b.reply !== "string" || !b.reply.trim()) return { estado: "sin-ia", motivo: INTERVIEW_TEXTS.noDisponible };
    const revealed = Array.isArray(b.revealed) ? b.revealed.filter((x): x is string => typeof x === "string") : [];
    return { estado: "respuesta", reply: b.reply, revealed };
  }
  if (status === 400 && error === "Acción desconocida.") return { estado: "sin-ia", motivo: INTERVIEW_TEXTS.edgeVieja };
  if (status === 400 && error.startsWith("Entrada inválida: ")) {
    const campo = error.slice("Entrada inválida: ".length);
    // a defect of the client or of the bank, not something the learner can fix
    console.error(`forge_interview rechazó el contexto: ${campo}`);
    return { estado: "sin-ia", motivo: noEnviadaText(campo) };
  }
  if (status === 422) return { estado: "bloqueado", motivo: error || INTERVIEW_TEXTS.bloqueado };
  if (status === 429) return { estado: "limite", reintentaEnS: LIMIT_WINDOW_S };
  return { estado: "sin-ia", motivo: INTERVIEW_TEXTS.noDisponible };
}

/** The evidence.recorded of one answered turn (§9.4): it keeps to whom the question went (anexo-r2 [9]). */
export function interviewTurnPayload(req: SimulatedUserRequest, answer: { reply: string; revealed: string[] }): EvidenceRecordedPayload {
  const data: { [k: string]: Json } = { q: req.question, reply: answer.reply, revealed: answer.revealed };
  if (req.persona !== undefined) data.persona = req.persona;
  return { itemId: req.itemId, type: "entrevista", phase: "turno", outcome: "registrado", source: "ai", data };
}

/** The answered turns of one interview item of a cell, in log order: the `turns` of buildInterviewContext. */
export function interviewTurnsFrom(events: readonly ArcanumEvent[], cellId: string, itemId: string): InterviewTurn[] {
  const out: InterviewTurn[] = [];
  for (const e of events) {
    if (e.type !== "evidence.recorded" || e.module_id !== cellId || !validEvidence(e)) continue;
    const p = e.payload as unknown as EvidenceRecordedPayload;
    if (p.type !== "entrevista" || p.phase !== "turno" || p.itemId !== itemId || p.source !== "ai") continue;
    const d = p.data && typeof p.data === "object" && !Array.isArray(p.data) ? (p.data as Record<string, unknown>) : {};
    if (typeof d.q !== "string" || typeof d.reply !== "string") continue;
    out.push({ ...(typeof d.persona === "string" ? { persona: d.persona } : {}), q: d.q, reply: d.reply });
  }
  return out;
}
