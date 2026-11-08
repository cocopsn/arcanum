import type { ArcanumEvent, EventType, Json } from "@/core/event";
import { forgeVerdictPasses, type ForgeCapability, type ForgeFailureMode, type ForgeVerdictFields } from "@/core/forge-verdict";
import type { PendingAiRM } from "@/core/read-model";
import { buildForgeJudgeContext, FORGE_QUEUE_MOTIVOS, invokeForge, mintTargetFor, slugForCode, type ForgeInvokeResult, type ForgeJudgeContext, type ForgeJudgeReply } from "@/forge/ai";
import type { ForgeApoyo, ForgeScope, ForgeVerdictKind } from "@/forge/ai-port";
import type { ForgeBankItem, ForgeItemOf } from "@/forge/bank/registry";
import { ensureForgeBank, loadForgeBankItems, loadForgeRoute, type EnsureBankResult } from "@/forge/loaders";
import type { ForgeRouteData } from "@/forge/route-data";

// THE FORGE QUEUE DRAIN (design §10.6, D6 M2). One queued `ai.queued { kind: "forge" }` is rebuilt from the log
// and the packaged data and sent to `forge_judge`. Outcomes: `resolved` (a verdict or an «invalida» record was
// minted and the item leaves the queue), `keep` (stays queued, the drain continues with the next one) and `stop`
// (no network, no session, 429, 503: the drain stops as today). Enqueuing NEVER opens anything; only a verdict
// that passes the §8.1 rule, folded by the projector, does. Without the route's bank on this device NOTHING is
// graded: the item stays queued with the visible reason MOTIVO_SIN_BANCO (M2).

export const MOTIVO_SIN_BANCO = "falta el banco de la ruta en este dispositivo: descárgalo";
export const MOTIVO_SIN_RUTA = "faltan los datos de la ruta en este dispositivo";
export const MOTIVO_BANCO_IMPORTADO = "el banco importado es de una versión anterior: vuelve a importarlo";
const motivoPendiente = (r: EnsureBankResult | null) => (r?.ok && !r.refreshed ? MOTIVO_BANCO_IMPORTADO : MOTIVO_SIN_BANCO);

/** The queued input (§10.6). `entrega` and `apoyo` of a gate never travel here: `missionEventId` does. */
export interface ForgeQueuedInput {
  action: "forge_judge";
  kind: ForgeVerdictKind;
  cellCode: string;
  scope: ForgeScope;
  apoyo?: ForgeApoyo;
  missionEventId?: string;
  giroRespuesta?: string;
  retencionItemId?: string;
  respuesta?: string;
  local?: unknown;
  artefactoEventIds?: string[];
  dataVersion: string;
}

export interface ForgeDrainDeps {
  events: () => Promise<ArcanumEvent[]>;
  /** writes one event and returns its id */
  fire: (type: EventType, payload: Json, refs: { goalId?: string | null; moduleId?: string | null }) => Promise<string>;
  loadRoute: (slug: string) => Promise<ForgeRouteData | null>;
  loadBankItems: (code: string) => Promise<{ items: ForgeBankItem[]; pendientes: string[] } | null>;
  ensureBank: (code: string) => Promise<EnsureBankResult>;
  invoke: (ctx: ForgeJudgeContext) => Promise<ForgeInvokeResult>;
}

export const defaultDrainDeps: Omit<ForgeDrainDeps, "events" | "fire"> = {
  loadRoute: loadForgeRoute,
  loadBankItems: loadForgeBankItems,
  ensureBank: ensureForgeBank,
  invoke: invokeForge,
};

export type DrainResult =
  | { outcome: "resolved"; eventId: string; kind: "gate" | "evidence" | "invalida"; motivo?: string }
  | { outcome: "keep"; motivo: string }
  | { outcome: "stop"; motivo: string };

/** Visible reason per queueId while an item stays queued (in memory; the queue itself is in the log). */
export const forgeQueueMotivos = new Map<string, string>();
/** After an «unsupported» answer (old Edge), forge items are not retried until this time (ms, in memory). */
export let forgeUnsupportedUntil = 0;
export function resetForgeUnsupported(): void {
  forgeUnsupportedUntil = 0;
}

function verdictFields(ctx: ForgeJudgeContext, reply: ForgeJudgeReply): ForgeVerdictFields {
  const capabilities: Partial<Record<ForgeCapability, number>> = {};
  for (const c of ctx.essential) {
    const n = Number(reply.capabilities?.[c]);
    capabilities[c as ForgeCapability] = Number.isInteger(n) ? Math.max(0, Math.min(4, n)) : 0;
  }
  const critical = ctx.critical.map((k) => ({ id: k.id, passed: Array.isArray(reply.critical) && reply.critical.some((x) => x && x.id === k.id && x.passed === true) }));
  const fm = typeof reply.failureMode === "string" ? (reply.failureMode as ForgeFailureMode) : null;
  return { v: 1, kind: ctx.kind, essential: ctx.essential as ForgeCapability[], capabilities, critical, failureMode: fm, scope: ctx.scope, apoyo: ctx.apoyo };
}

function bankGiro(bank: { items: ForgeBankItem[]; pendientes: string[] }): { texto: string } | null {
  const g = bank.items.find((i) => i.type === "giro" && !bank.pendientes.includes(i.itemId));
  return g ? { texto: g.statement } : null;
}

/** Rebuild and judge one queued Forge submission. Never throws on an expected condition. */
export async function drainForgeItem(p: PendingAiRM, deps: ForgeDrainDeps, now = Date.now()): Promise<DrainResult> {
  const input = (p.input ?? {}) as unknown as ForgeQueuedInput;
  const refs = { goalId: p.goalId, moduleId: p.moduleId };
  const keep = (motivo: string): DrainResult => {
    forgeQueueMotivos.set(p.queueId, motivo);
    return { outcome: "keep", motivo };
  };
  const invalida = async (motivo: string): Promise<DrainResult> => {
    const eventId = await deps.fire(
      "evidence.recorded",
      { itemId: "envio-" + p.queueId, type: input.kind, phase: "invalida", outcome: "registrado", source: "local", data: { motivo }, queueId: p.queueId } as unknown as Json,
      refs,
    );
    forgeQueueMotivos.delete(p.queueId);
    return { outcome: "resolved", eventId, kind: "invalida", motivo };
  };
  if (now < forgeUnsupportedUntil) return keep(FORGE_QUEUE_MOTIVOS.unsupported);

  const slug = typeof input.cellCode === "string" ? slugForCode(input.cellCode) : null;
  const route = slug ? await deps.loadRoute(slug) : null;
  const cell = route?.cells.find((c) => c.code === input.cellCode && c.id === p.moduleId) ?? null;
  if (!route || !cell) return keep(MOTIVO_SIN_RUTA);

  // M2: the bank must be on this device; ensure it, and never grade without it. A row with old pendings (a
  // retention whose type was a stub before this release) is revalidated before a retention is looked up (H13).
  let bank = await deps.loadBankItems(cell.code);
  let reval: EnsureBankResult | null = null;
  if (!bank || (input.retencionItemId && bank.pendientes.length > 0)) {
    reval = await deps.ensureBank(cell.code);
    if (reval.ok) bank = (await deps.loadBankItems(cell.code)) ?? bank;
  }
  if (!bank) return keep(MOTIVO_SIN_BANCO);
  const ret = input.retencionItemId
    ? bank.items.find((i): i is ForgeItemOf<"retencion"> => i.type === "retencion" && i.itemId === input.retencionItemId)
    : undefined;
  if (input.retencionItemId && (!ret || ret.data.forma !== "defensa")) return invalida("retencion-desconocida");
  if (ret && bank.pendientes.includes(ret.id)) return keep(motivoPendiente(reval));
  const retencion = ret ? { enunciado: ret.statement, rubrica: ret.data.forma === "defensa" ? ret.data.rubrica : [] } : undefined;

  const events = await deps.events();
  const built = buildForgeJudgeContext({
    route,
    cell,
    kind: input.kind,
    scope: input.scope,
    apoyo: input.apoyo,
    missionEventId: input.missionEventId,
    events,
    giro: bankGiro(bank),
    artefactoEventIds: input.artefactoEventIds,
    retencionItemId: input.retencionItemId,
    retencion,
    respuesta: input.respuesta,
    local: input.local,
  });
  if ("error" in built) return invalida(built.error);

  const res = await deps.invoke(built.context);
  if (!res.ok) {
    if (res.reason === "invalid") return invalida(`Entrada inválida: ${res.field}`);
    if (res.reason === "unsupported") {
      forgeUnsupportedUntil = now + 10 * 60_000;
      return keep(FORGE_QUEUE_MOTIVOS.unsupported);
    }
    const motivo = FORGE_QUEUE_MOTIVOS[res.reason];
    forgeQueueMotivos.set(p.queueId, motivo);
    return { outcome: "stop", motivo };
  }

  const ctx = built.context;
  const forge = verdictFields(ctx, res.data);
  const rulePasses = res.data.passed === true && forgeVerdictPasses(forge);
  const essentialScores = ctx.essential.map((c) => forge.capabilities[c as ForgeCapability] ?? 0);
  const score = essentialScores.length ? essentialScores.reduce((s, n) => s + n, 0) / (4 * essentialScores.length) : 0;
  const target = mintTargetFor(cell, input.kind);
  let eventId: string;
  if (target === "gate") {
    // native scope: the result travels in forge.nativePassed, never in the top-level passed (§7.4, §8.2)
    const native = ctx.scope === "nativa";
    eventId = await deps.fire(
      "gate.evaluated",
      {
        passed: native ? false : rulePasses,
        score,
        summary: res.data.summary,
        feedback: res.data.feedback,
        questions: res.data.questions,
        source: "ai",
        provider: res.data.provider,
        queueId: p.queueId,
        forge: native ? { ...forge, nativePassed: rulePasses } : forge,
      } as unknown as Json,
      refs,
    );
  } else {
    eventId = await deps.fire(
      "evidence.recorded",
      {
        itemId: input.retencionItemId ?? "envio-" + p.queueId,
        type: input.kind,
        phase: "veredicto",
        outcome: rulePasses ? "aprobado" : "reprobado",
        data: { summary: res.data.summary, feedback: res.data.feedback, questions: res.data.questions },
        source: "ai",
        provider: res.data.provider,
        verdict: forge,
        queueId: p.queueId,
      } as unknown as Json,
      refs,
    );
  }
  forgeQueueMotivos.delete(p.queueId);
  return { outcome: "resolved", eventId, kind: target };
}
