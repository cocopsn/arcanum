import { ENTREGA_KEYS, type ArcanumEvent, type EntregaKey } from "@/core/event";
import { getSupabase } from "@/sync/client";
import { FORGE_PATHS, forgePathCellCodes, type ForgePathSlug } from "@/forge/ids";
import type { ForgeCellData, ForgeRouteData } from "@/forge/route-data";
import type { ForgeApoyo, ForgeScope, ForgeVerdictKind } from "@/forge/ai-port";

// ENGINEERING FORGE — the client side of `forge_judge` (design §8.1, §9.5, §10.2, §10.5). The context builder is
// PURE and is the one both the immediate request and the queue drain use: for a gate it takes `entrega` and
// `apoyo` from the mission.submitted named by `missionEventId` (never from the caller), and the giro answer from
// the log after that submission.

/** §8.1: the cell's single compuerta mints a gate; every other kind is evidence that never opens anything. */
export function mintTargetFor(cell: Pick<ForgeCellData, "compuerta">, kind: ForgeVerdictKind): "gate" | "evidence" {
  return kind === cell.compuerta ? "gate" : "evidence";
}

/** The path slug of a cell code (F0-01 → f0, D3 → diagnostico, X07 → retos, SD-02 → expedientes). */
export function slugForCode(code: string): ForgePathSlug | null {
  for (const p of FORGE_PATHS) if (forgePathCellCodes(p).includes(code)) return p.slug;
  return null;
}

/** Text written in the 7 sections of artifact mode (§8.3): the artifact in the log already is the evidence. */
export const ARTEFACTO_TEXT = "ver el artefacto adjunto";
/** The client clips the context to this many characters before sending (the Edge rejects > 100,000). */
export const FORGE_CONTEXT_CLIP = 90_000;

export interface ForgeJudgeContext {
  kind: ForgeVerdictKind;
  cell: { code: string; title: string; ruta: string };
  mission: { mision: string; defensa: string; transferencia?: string };
  rubric: string[];
  essential: string[];
  critical: { id: string; texto: string }[];
  scope: ForgeScope;
  apoyo: ForgeApoyo;
  sources: string[];
  evidence: Record<string, unknown>;
}

export type ForgeContextError = "entrega-pendiente" | "giro-pendiente" | "apoyo-pendiente";

export interface BuildContextArgs {
  route: ForgeRouteData;
  cell: ForgeCellData;
  kind: ForgeVerdictKind;
  scope: ForgeScope;
  /** only for evidence submissions; ignored for a gate */
  apoyo?: ForgeApoyo;
  missionEventId?: string;
  /** the log (fold order) */
  events: ArcanumEvent[];
  /** the giro of the cell's bank, or null when the bank has none */
  giro: { texto: string } | null;
  artefactoEventIds?: string[];
  retencionItemId?: string;
  respuesta?: string;
  local?: unknown;
}

function isApoyo(x: unknown): x is ForgeApoyo {
  return x === "independiente" || x === "con_apoyo";
}

/** The entrega when it has exactly the 9 keys, all non-empty strings; otherwise null. */
export function completeEntrega(x: unknown): Record<EntregaKey, string> | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  if (Object.keys(o).length !== ENTREGA_KEYS.length) return null;
  const out = {} as Record<EntregaKey, string>;
  for (const k of ENTREGA_KEYS) {
    const v = o[k];
    if (typeof v !== "string" || !v.trim()) return null;
    out[k] = v;
  }
  return out;
}

/** The last mission.submitted of the cell in the log (its id), or null. */
export function lastMissionEventId(events: ArcanumEvent[], cellId: string): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (e.type === "mission.submitted" && e.module_id === cellId) return e.id;
  }
  return null;
}

/** The learner's answer to the giro recorded AFTER the mission.submitted at index `after`, or null. */
function giroAnswerAfter(events: ArcanumEvent[], cellId: string, after: number): string | null {
  let answer: string | null = null;
  for (let i = after + 1; i < events.length; i++) {
    const e = events[i]!;
    if (e.type !== "evidence.recorded" || e.module_id !== cellId) continue;
    const p = e.payload as Record<string, unknown>;
    if (p.type !== "giro") continue;
    const d = p.data as Record<string, unknown> | null;
    if (d && typeof d.respuesta === "string" && d.respuesta.trim()) answer = d.respuesta;
  }
  return answer;
}

/** Clip the longest entrega sections first until the JSON fits, marking «[recortado]». */
function clip(ctx: ForgeJudgeContext): ForgeJudgeContext {
  let size = JSON.stringify(ctx).length;
  if (size <= FORGE_CONTEXT_CLIP) return ctx;
  const ev = { ...ctx.evidence };
  const entrega = ev.entrega && typeof ev.entrega === "object" ? { ...(ev.entrega as Record<string, string>) } : null;
  if (entrega) {
    while (size > FORGE_CONTEXT_CLIP) {
      const [k, v] = Object.entries(entrega).sort((a, b) => b[1].length - a[1].length)[0]!;
      const cut = Math.max(0, v.length - (size - FORGE_CONTEXT_CLIP) - 20);
      entrega[k] = v.slice(0, cut) + " [recortado]";
      ev.entrega = entrega;
      const next = JSON.stringify({ ...ctx, evidence: ev }).length;
      if (next >= size) break;
      size = next;
    }
  }
  return { ...ctx, evidence: ev };
}

/**
 * Build the `forge_judge` context (§9.5, §10.2). For a gate (mintTargetFor = "gate"): `entrega` and `apoyo` come
 * from the mission.submitted `missionEventId` → `entrega-pendiente` if it is missing, lacks the 9 keys or a valid
 * `apoyo`; `giro-pendiente` if the bank has a giro and no answer was recorded after that submission. For an
 * evidence submission: `apoyo-pendiente` without a declared `apoyo`.
 */
export function buildForgeJudgeContext(a: BuildContextArgs): { context: ForgeJudgeContext } | { error: ForgeContextError } {
  const target = mintTargetFor(a.cell, a.kind);
  const evidence: Record<string, unknown> = {};
  let apoyo: ForgeApoyo;
  if (target === "gate") {
    const idx = a.missionEventId ? a.events.findIndex((e) => e.id === a.missionEventId) : -1;
    const ev = idx >= 0 ? a.events[idx]! : null;
    if (!ev || ev.type !== "mission.submitted" || ev.module_id !== a.cell.id) return { error: "entrega-pendiente" };
    const p = ev.payload as Record<string, unknown>;
    const entrega = completeEntrega(p.entrega);
    if (!entrega || !isApoyo(p.apoyo)) return { error: "entrega-pendiente" };
    apoyo = p.apoyo;
    evidence.entrega = entrega;
    if (a.giro) {
      const respuesta = giroAnswerAfter(a.events, a.cell.id, idx);
      if (!respuesta) return { error: "giro-pendiente" };
      evidence.giro = { texto: a.giro.texto, respuesta };
    }
  } else {
    if (!isApoyo(a.apoyo)) return { error: "apoyo-pendiente" };
    apoyo = a.apoyo;
  }
  if (a.artefactoEventIds && a.artefactoEventIds.length) {
    const wanted = new Set(a.artefactoEventIds);
    evidence.artefactos = a.events
      .filter((e) => wanted.has(e.id) && e.type === "evidence.recorded" && e.module_id === a.cell.id)
      .map((e) => {
        const p = e.payload as Record<string, unknown>;
        return { type: p.type, phase: p.phase, data: p.data };
      });
  }
  if (a.retencionItemId) evidence.retencion = { itemId: a.retencionItemId, respuesta: a.respuesta ?? "" };
  else if (a.respuesta) evidence.respuesta = a.respuesta;
  if (a.local !== undefined) evidence.local = a.local;
  const critical = a.cell.criticas.map((k) => ({ id: k.id.slice(0, 64), texto: k.texto.slice(0, 300) }));
  if (a.cell.requireEnglish) critical.push({ id: "ingles", texto: "La defensa se presenta en inglés con claridad, precisión y escucha" });
  const ctx: ForgeJudgeContext = {
    kind: a.kind,
    cell: { code: a.cell.code, title: a.cell.title.slice(0, 200), ruta: a.route.name.slice(0, 200) },
    mission: {
      mision: a.cell.ficha.mision.slice(0, 4000),
      defensa: a.cell.ficha.defensa.slice(0, 4000),
      ...(a.cell.ficha.transferencia ? { transferencia: a.cell.ficha.transferencia.slice(0, 4000) } : {}),
    },
    rubric: (a.cell.gate?.rubrica ?? []).slice(0, 12).map((r) => r.slice(0, 400)),
    essential: a.cell.capacidades.slice(0, 8),
    critical: critical.slice(0, 12),
    scope: a.scope,
    apoyo,
    sources: a.cell.ficha.fuentes.map((s) => s.url).filter((u) => typeof u === "string" && u.length <= 2000).slice(0, 20),
    evidence,
  };
  return { context: clip(ctx) };
}

// ── Transport (§10.5) ────────────────────────────────────────────────────────────────────────────────────

export interface ForgeJudgeReply {
  provider: string;
  kind: string;
  capabilities: Record<string, number>;
  critical: { id: string; passed: boolean }[];
  failureMode: string | null;
  scope: string;
  questions: string[];
  passed: boolean;
  summary: string;
  feedback: string;
}

export type ForgeInvokeResult =
  | { ok: true; data: ForgeJudgeReply }
  | { ok: false; reason: "unsupported" | "offline" | "no-session" | "unavailable" }
  | { ok: false; reason: "invalid"; field: string }
  | { ok: false; reason: "rate-limited"; retryAfterS: number };

/** Honest message shown for each queued outcome (§10.5, §10.7). */
export const FORGE_QUEUE_MOTIVOS = {
  unsupported: "el evaluador desplegado todavía no tiene la acción Forge",
  offline: "Sin red: en cola",
  "no-session": "Inicia sesión para que se evalúe",
  "rate-limited": "Límite de solicitudes: en cola",
  unavailable: "El evaluador no está disponible: en cola",
} as const;

/** Classify an Edge answer (pure; the IO lives in invokeForge). */
export function classifyForgeResponse(status: number | null, body: unknown, online: boolean, retryAfter: string | null): ForgeInvokeResult {
  if (status === null) return { ok: false, reason: online ? "unavailable" : "offline" };
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const err = typeof b.error === "string" ? b.error : "";
  if (status === 401) return { ok: false, reason: "no-session" };
  if (status === 429) {
    const n = Number(retryAfter);
    return { ok: false, reason: "rate-limited", retryAfterS: Number.isFinite(n) && n > 0 ? n : 60 };
  }
  if (status === 400 && /Acción desconocida/.test(err)) return { ok: false, reason: "unsupported" };
  if (status === 400 && /Entrada inválida/.test(err)) return { ok: false, reason: "invalid", field: err.replace(/^Entrada inválida:\s*/, "") };
  if (status >= 200 && status < 300 && !err && typeof b.passed === "boolean" && b.capabilities && Array.isArray(b.critical)) {
    return { ok: true, data: b as unknown as ForgeJudgeReply };
  }
  return { ok: false, reason: "unavailable" };
}

/** Call `forge_judge` on the ai-router Edge. Never throws. */
export async function invokeForge(context: ForgeJudgeContext): Promise<ForgeInvokeResult> {
  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  if (!online) return { ok: false, reason: "offline" };
  try {
    const sb = getSupabase();
    const { data: session } = await sb.auth.getSession();
    if (!session.session) return { ok: false, reason: "no-session" };
    const { data, error } = await sb.functions.invoke("ai-router", { body: { action: "forge_judge", context } });
    if (!error) return classifyForgeResponse(200, data, online, null);
    const ctx = (error as { context?: unknown }).context;
    if (ctx instanceof Response) {
      let body: unknown = null;
      try {
        body = await ctx.clone().json();
      } catch {
        body = null;
      }
      return classifyForgeResponse(ctx.status, body, online, ctx.headers.get("Retry-After"));
    }
    return classifyForgeResponse(null, null, online, null);
  } catch {
    return { ok: false, reason: online ? "unavailable" : "offline" };
  }
}
