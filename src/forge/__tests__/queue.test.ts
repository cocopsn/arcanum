import { describe, it, expect, beforeEach, vi } from "vitest";
import { ENTREGA_KEYS, makeEvent, type ArcanumEvent, type EventType, type Json } from "@/core/event";
import type { PendingAiRM } from "@/core/read-model";
import { drainForgeItem, forgeQueueMotivos, MOTIVO_SIN_BANCO, resetForgeUnsupported, type ForgeDrainDeps } from "@/forge/ai-drain";
import type { ForgeInvokeResult } from "@/forge/ai";
import { fixtureRoute } from "@/forge/__tests__/helpers/flow-envelope";

// §10.6 and D6 M2. The drain rebuilds a queued Forge submission and judges it. Without the route's bank on this
// device it calls ensureForgeBank; if that fails the item STAYS queued with the visible reason and nothing is
// graded. An `invalid` item leaves the queue with its reason and does not block the next one. Enqueuing never
// opens anything (the fold is covered by projector-forge; here: no gate.evaluated is written without a verdict).

const route = fixtureRoute({ code: "P2-06", id: "cf000000-0000-4000-8000-000000000a01", compuerta: "mision", flujo: "mision" });
const cell = route.cells[0]!;
const entrega = Object.fromEntries(ENTREGA_KEYS.map((k) => [k, `texto de ${k}`]));
const PASS: ForgeInvokeResult = {
  ok: true,
  data: { provider: "azure", kind: "mision", capabilities: { sistemas: 4 }, critical: [{ id: "correctitud", passed: true }], failureMode: null, scope: "local", questions: [], passed: true, summary: "ok", feedback: "bien" },
};

function setup(opts: { bankOnDevice: boolean; ensureOk: boolean; invoke?: ForgeInvokeResult }) {
  const log: ArcanumEvent[] = [];
  let t = 1_000;
  const write = (type: EventType, payload: Json) => {
    const e = makeEvent(type, payload, { ts: ++t, deviceId: "d", goalId: null, moduleId: cell.id });
    log.push(e);
    return e;
  };
  const m = write("mission.submitted", { notes: "x", entrega, apoyo: "independiente" } as Json);
  let bank = opts.bankOnDevice ? { items: [], pendientes: [] } : null;
  const deps: ForgeDrainDeps = {
    events: async () => log,
    fire: async (type, payload) => write(type, payload).id,
    loadRoute: async () => route,
    loadBankItems: vi.fn(async () => bank),
    ensureBank: vi.fn(async () => {
      if (!opts.ensureOk) return { ok: false as const, reason: "no-descargado" as const };
      bank = { items: [], pendientes: [] };
      return { ok: true as const, refreshed: true, pendientes: [] };
    }),
    invoke: vi.fn(async () => opts.invoke ?? PASS),
  };
  const pending = (queueId: string, input: Record<string, unknown> = {}): PendingAiRM => ({
    queueId,
    kind: "forge",
    moduleId: cell.id,
    goalId: null,
    input: { action: "forge_judge", kind: "mision", cellCode: "P2-06", scope: "local", missionEventId: m.id, dataVersion: "t", ...input } as Json,
    ts: 1,
  });
  return { log, deps, pending };
}

beforeEach(() => {
  forgeQueueMotivos.clear();
  resetForgeUnsupported();
});

describe("drainForgeItem — M2: never grades without the route's bank", () => {
  it("bank missing and ensureForgeBank fails → stays queued with the visible reason, invoke never called, nothing minted", async () => {
    const s = setup({ bankOnDevice: false, ensureOk: false });
    const r = await drainForgeItem(s.pending("0190a000-0000-7000-8000-000000000001"), s.deps);
    expect(s.deps.ensureBank, "el drenado no intentó descargar el banco").toHaveBeenCalledWith("P2-06");
    expect(r, "se calificó sin el banco de la ruta").toEqual({ outcome: "keep", motivo: MOTIVO_SIN_BANCO });
    expect(MOTIVO_SIN_BANCO).toBe("falta el banco de la ruta en este dispositivo: descárgalo");
    expect(forgeQueueMotivos.get("0190a000-0000-7000-8000-000000000001")).toBe(MOTIVO_SIN_BANCO);
    expect(s.deps.invoke).not.toHaveBeenCalled();
    expect(s.log.filter((e) => e.type !== "mission.submitted")).toEqual([]);
  });

  it("bank missing but ensureForgeBank succeeds → judged and resolved", async () => {
    const s = setup({ bankOnDevice: false, ensureOk: true });
    const r = await drainForgeItem(s.pending("0190a000-0000-7000-8000-000000000002"), s.deps);
    expect(r.outcome).toBe("resolved");
    const g = s.log.find((e) => e.type === "gate.evaluated");
    expect((g?.payload as Record<string, unknown>).queueId).toBe("0190a000-0000-7000-8000-000000000002");
    expect((g?.payload as Record<string, unknown>).passed).toBe(true);
  });
});

describe("drainForgeItem — §10.6 outcomes", () => {
  it("an invalid item leaves the queue with its reason (phase «invalida», nothing opens) and does not block the next", async () => {
    const s = setup({ bankOnDevice: true, ensureOk: true, invoke: { ok: false, reason: "invalid", field: "rubric" } });
    const r1 = await drainForgeItem(s.pending("0190a000-0000-7000-8000-000000000003"), s.deps);
    expect(r1.outcome).toBe("resolved");
    const inv = s.log.find((e) => e.type === "evidence.recorded")!;
    expect(inv.payload).toMatchObject({ itemId: "envio-0190a000-0000-7000-8000-000000000003", phase: "invalida", outcome: "registrado", source: "local", queueId: "0190a000-0000-7000-8000-000000000003" });
    expect(s.log.some((e) => e.type === "gate.evaluated")).toBe(false);
    (s.deps.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PASS);
    const r2 = await drainForgeItem(s.pending("0190a000-0000-7000-8000-000000000004"), s.deps);
    expect(r2.outcome).toBe("resolved");
  });

  it("an old Edge (unsupported) keeps the item with the honest message; no network stops", async () => {
    const s = setup({ bankOnDevice: true, ensureOk: true, invoke: { ok: false, reason: "unsupported" } });
    expect(await drainForgeItem(s.pending("0190a000-0000-7000-8000-000000000005"), s.deps)).toEqual({ outcome: "keep", motivo: "el evaluador desplegado todavía no tiene la acción Forge" });
    resetForgeUnsupported();
    (s.deps.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, reason: "offline" });
    expect((await drainForgeItem(s.pending("0190a000-0000-7000-8000-000000000006"), s.deps)).outcome).toBe("stop");
    expect(s.log.some((e) => e.type === "gate.evaluated")).toBe(false);
  });

  it("a gate request whose mission.submitted is gone → «invalida» entrega-pendiente, never a verdict", async () => {
    const s = setup({ bankOnDevice: true, ensureOk: true });
    const r = await drainForgeItem(s.pending("0190a000-0000-7000-8000-000000000007", { missionEventId: "0190a000-0000-7000-8000-0000000000ff" }), s.deps);
    expect(r).toMatchObject({ outcome: "resolved", kind: "invalida", motivo: "entrega-pendiente" });
    expect(s.deps.invoke).not.toHaveBeenCalled();
  });

  it("a reply the §8.1 rule rejects is minted as NOT passed even if the model said passed", async () => {
    const s = setup({ bankOnDevice: true, ensureOk: true, invoke: { ok: true, data: { ...(PASS as { data: object }).data, capabilities: { sistemas: 2 } } as never } });
    await drainForgeItem(s.pending("0190a000-0000-7000-8000-000000000008"), s.deps);
    expect((s.log.find((e) => e.type === "gate.evaluated")?.payload as Record<string, unknown>).passed).toBe(false);
  });
});
