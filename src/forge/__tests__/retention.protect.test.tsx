import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Dexie from "dexie";
import { makeEvent, type ArcanumEvent } from "@/core/event";
import { project } from "@/core/projector";
import { FORGE_GOAL_ID, type ForgeVerdictFields } from "@/core/forge-verdict";
import { DAY_MS } from "@/forge/model/retention";
import { competenceState } from "@/forge/model/competence";
import { buildForgeJudgeContext, invokeForge } from "@/forge/ai";
import { drainForgeItem, MOTIVO_BANCO_IMPORTADO, MOTIVO_SIN_BANCO, type ForgeDrainDeps } from "@/forge/ai-drain";
import { gradeRetentionCode, retentionStatus } from "@/forge/eval/retention-grade";
import { forgeItem, realForgeItem, RET_DEFENSA } from "@/forge/__tests__/fixtures/evaluator-blocks";
import { execRunner } from "@/forge/__tests__/helpers/exec-runner";
import { fixtureRoute } from "@/forge/__tests__/helpers/flow-envelope";
import type { PendingAiRM } from "@/core/read-model";

// i · retencion (design §5.5, §11.1, §11.2.5). The due gate over the presenter (fake clock) and the code grade; the
// AI context of a retention and the queue drain (cases a–f of §11.1); and the DOM of the runner (§11.2.5).

const CELL = "cf000000-0000-4000-8000-0050322d3036";
const T0 = Date.UTC(2026, 10, 10, 15, 0, 0);
let n = 0;
const ev = (type: Parameters<typeof makeEvent>[0], payload: unknown, ts: number): ArcanumEvent =>
  makeEvent(type, payload as never, { ts, deviceId: "t", goalId: FORGE_GOAL_ID, moduleId: CELL, id: `c8000000-0000-4000-8000-${String(++n).padStart(12, "0")}` });
const base = [
  makeEvent("goal.upserted", { title: "Engineering Forge", priority: 1, color: "#ffffff", sigil: "forge" }, { ts: T0 - 10, deviceId: "t", goalId: FORGE_GOAL_ID, id: "c8000000-0000-4000-8000-200000000001" }),
  makeEvent("module.upserted", { title: "P2-06", prereqs: [], kind: "mission" }, { ts: T0 - 9, deviceId: "t", goalId: FORGE_GOAL_ID, moduleId: CELL, id: "c8000000-0000-4000-8000-200000000002" }),
];
const verdict = (over: Partial<ForgeVerdictFields> = {}): ForgeVerdictFields => ({
  v: 1, kind: "mision", essential: ["sistemas"], capabilities: { sistemas: 3 }, critical: [{ id: "consistencia", passed: true }],
  failureMode: null, scope: "local", apoyo: "independiente", ...over,
});
const gate = (ts: number, f: ForgeVerdictFields) => ev("gate.evaluated", { passed: true, score: 1, summary: "", feedback: "", source: "ai", provider: "azure", forge: f }, ts);

const timeout = () => realForgeItem("P2-06", "p206-ret-timeout", "retencion");

afterEach(() => {
  vi.useRealTimers();
});

describe("retención · retentionStatus con reloj falso (comportamiento)", () => {
  it("sin veredicto no hay agenda", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 30 * DAY_MS);
    expect(retentionStatus(project(base), CELL, timeout(), Date.now())).toEqual({ estado: "sin-agenda" });
  });
  it("veredicto independiente en T0 y dias: 21 → programada en T0 + 20 d y vencida en T0 + 21 d", () => {
    const item = timeout();
    expect(item.data.dias).toBe(21);
    const rm = project([...base, gate(T0, verdict())]);
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 20 * DAY_MS);
    expect(retentionStatus(rm, CELL, item, Date.now())).toEqual({ estado: "programada", dueMs: T0 + 21 * DAY_MS });
    vi.setSystemTime(T0 + 21 * DAY_MS);
    expect(retentionStatus(rm, CELL, item, Date.now())).toEqual({ estado: "vencida", dueMs: T0 + 21 * DAY_MS });
  });
  it("con dias: 7 en defensa vence a los 7 días; con un veredicto con apoyo no hay agenda", () => {
    const item = realForgeItem("P2-06", "p206-ret-inventario", "retencion");
    expect(item.data.dias).toBe(7);
    const rm = project([...base, gate(T0, verdict())]);
    expect(retentionStatus(rm, CELL, item, T0 + 6 * DAY_MS)).toMatchObject({ estado: "programada" });
    expect(retentionStatus(rm, CELL, item, T0 + 7 * DAY_MS)).toMatchObject({ estado: "vencida" });
    const apoyo = project([...base, gate(T0, verdict({ apoyo: "con_apoyo" }))]);
    expect(retentionStatus(apoyo, CELL, item, T0 + 30 * DAY_MS)).toEqual({ estado: "sin-agenda" });
    expect(retentionStatus(rm, "cf000000-0000-4000-8000-000000000999", item, T0 + 30 * DAY_MS)).toEqual({ estado: "sin-agenda" });
  });
});

describe("retención · gradeRetentionCode sobre P2-06 p206-ret-timeout (comportamiento)", () => {
  it("la solución pasa sus 7 casos; una que ignora la consulta falla y dice el primer caso", async () => {
    const d = timeout().data;
    if (d.forma !== "codigo") throw new Error("p206-ret-timeout dejó de ser de código");
    expect(await gradeRetentionCode(d, "js", d.solucion.js!, execRunner)).toEqual({ estado: "calificada", correcto: true, pasan: 7, total: 7 });
    const ignora = 'function diagnosticar(intentos, consulta) { if (intentos.includes("ok")) return "aplicada"; return intentos.includes("timeout") ? "desconocida" : "no-aplicada"; }';
    const g = await gradeRetentionCode(d, "js", ignora, execRunner);
    expect(g).toMatchObject({ estado: "calificada", correcto: false, total: 7 });
    if (g.estado === "calificada") expect(g.primerFallo?.input).toEqual([["timeout", "timeout"], { encontrada: true }]);
    expect(await gradeRetentionCode(d, "js", "function diagnosticar( {", execRunner)).toMatchObject({ estado: "sintaxis" });
    expect(await gradeRetentionCode(d, "python", "def diagnosticar(i, c): pass", execRunner)).toMatchObject({ estado: "sintaxis" });
  });
});

// ── AI context of a retention (design §5.5, §11.1) ────────────────────────────────────────────────────────────────

describe("retención · contexto del juez", () => {
  const route = fixtureRoute({ code: "F0-01", compuerta: "mision", flujo: "mision" });
  const cell = route.cells[0]!;
  it("con retencion trae enunciado, rúbrica y respuesta recortados", () => {
    const r = buildForgeJudgeContext({
      route, cell, kind: "retencion", scope: "local", apoyo: "independiente", events: [], giro: null,
      retencionItemId: "r1", retencion: { enunciado: "e".repeat(5000), rubrica: ["a".repeat(500), "b"] }, respuesta: "x".repeat(7000),
    });
    expect("context" in r).toBe(true);
    const ret = "context" in r ? (r.context.evidence.retencion as { enunciado?: string; rubrica?: string[]; respuesta?: string }) : {};
    expect({ enunciado: ret.enunciado?.length, rubrica: ret.rubrica?.[0]?.length, respuesta: ret.respuesta?.length }, "el juez de retención no recibió la variante ni su rúbrica").toEqual({ enunciado: 4000, rubrica: 400, respuesta: 6000 });
  });
  it("con retencionItemId y sin retencion devuelve retencion-desconocida, sin romper el contexto", () => {
    let r: unknown;
    try {
      r = buildForgeJudgeContext({ route, cell, kind: "retencion", scope: "local", apoyo: "independiente", events: [], giro: null, retencionItemId: "r1", respuesta: "x" });
    } catch (e) {
      r = { lanzo: String(e) };
    }
    expect(r, "una retención sin ítem llegó al juez o rompió el contexto").toEqual({ error: "retencion-desconocida" });
  });
});

// ── Queue drain (design §11.1, cases a–f). drainForgeItem with injected deps; loadRoute returns the fixture route. ──

const route = fixtureRoute({ code: "F0-01", id: CELL, compuerta: "mision", flujo: "mision" });
const pending = (input: Record<string, unknown>): PendingAiRM => ({ queueId: "q-ret", kind: "forge", moduleId: CELL, goalId: FORGE_GOAL_ID, input: input as never, ts: T0 });
const baseDeps = (over: Partial<ForgeDrainDeps>): ForgeDrainDeps => ({
  events: async () => [],
  fire: vi.fn(async () => "evt-1"),
  loadRoute: async () => route,
  loadBankItems: async () => ({ items: [], pendientes: [] }),
  ensureBank: async () => ({ ok: true, refreshed: true, pendientes: [] }),
  invoke: vi.fn(async () => ({ ok: false as const, reason: "offline" as const })),
  ...over,
});
const retInput = { action: "forge_judge", kind: "retencion", cellCode: "F0-01", scope: "local", apoyo: "independiente", retencionItemId: "ret-defensa", respuesta: "r", dataVersion: "maestro" };
const codigoItem = () => ({ ...realForgeItem("P2-06", "p206-ret-timeout", "retencion"), id: "x:ret-defensa", itemId: "ret-defensa" });
const defensaItem = () => ({ ...forgeItem(RET_DEFENSA, "retencion"), id: "x:ret-defensa", itemId: "ret-defensa" });

describe("retención · drenado", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("(a) una retención de CÓDIGO invalida con retencion-desconocida y no llama a invoke", async () => {
    const invoke = vi.fn(async () => ({ ok: true as const, data: {} as never }));
    const r = await drainForgeItem(pending(retInput), baseDeps({ loadBankItems: async () => ({ items: [codigoItem() as never], pendientes: [] }), invoke }));
    expect(r, "una retención que no es de defensa llegó al juez").toMatchObject({ outcome: "resolved", kind: "invalida", motivo: "retencion-desconocida" });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("(b) un id que no existe invalida", async () => {
    const r = await drainForgeItem(pending(retInput), baseDeps({ loadBankItems: async () => ({ items: [], pendientes: [] }) }));
    expect(r).toMatchObject({ outcome: "resolved", kind: "invalida", motivo: "retencion-desconocida" });
  });

  it("(c) pendientes viejos: se revalida y la defensa llega a invoke", async () => {
    let pend = ["x:ret-defensa"];
    const items = [defensaItem() as never];
    const invoke = vi.fn(async () => ({ ok: false as const, reason: "offline" as const }));
    const ensureBank = vi.fn(async () => {
      pend = [];
      return { ok: true as const, refreshed: true as const, pendientes: [] };
    });
    const r = await drainForgeItem(
      pending(retInput),
      baseDeps({ loadBankItems: async () => ({ items, pendientes: pend }), ensureBank, invoke }),
    );
    expect(ensureBank, "una fila con pendientes viejos no llegó al juez").toHaveBeenCalled();
    expect(invoke, "una fila con pendientes viejos no llegó al juez").toHaveBeenCalled();
    void r;
  });

  it("(d) pendiente que sigue pendiente espera (keep MOTIVO_SIN_BANCO), sin invoke ni invalida", async () => {
    const invoke = vi.fn(async () => ({ ok: true as const, data: {} as never }));
    const r = await drainForgeItem(
      pending(retInput),
      baseDeps({ loadBankItems: async () => ({ items: [defensaItem() as never], pendientes: ["x:ret-defensa"] }), ensureBank: async () => ({ ok: false, reason: "no-descargado" }), invoke }),
    );
    expect(r, "una retención pendiente se juzgó o se invalidó en lugar de esperar").toEqual({ outcome: "keep", motivo: MOTIVO_SIN_BANCO });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("(e) sin red: invoke real y navigator.onLine false → stop «Sin red: en cola»", async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis.navigator, "onLine");
    Object.defineProperty(globalThis.navigator, "onLine", { configurable: true, value: false });
    try {
      const r = await drainForgeItem(pending(retInput), baseDeps({ loadBankItems: async () => ({ items: [defensaItem() as never], pendientes: [] }), invoke: invokeForge }));
      expect(r).toEqual({ outcome: "stop", motivo: "Sin red: en cola" });
    } finally {
      if (original) Object.defineProperty(globalThis.navigator, "onLine", original);
    }
  });

  it("(f) banco importado: keep MOTIVO_BANCO_IMPORTADO, sin invoke ni invalida (rc85)", async () => {
    const invoke = vi.fn(async () => ({ ok: true as const, data: {} as never }));
    // ensureBank answers ok+!refreshed (the import row is never refreshed), the item still pending
    const r = await drainForgeItem(
      pending(retInput),
      baseDeps({ loadBankItems: async () => ({ items: [defensaItem() as never], pendientes: ["x:ret-defensa"] }), ensureBank: async () => ({ ok: true, refreshed: false, pendientes: ["x:ret-defensa"] }), invoke }),
    );
    expect(r, "una retención de un banco importado quedó en cola con un motivo que no aplica").toEqual({ outcome: "keep", motivo: MOTIVO_BANCO_IMPORTADO });
    expect(invoke).not.toHaveBeenCalled();
  });
});

// ── DOM of RetencionRunner (design §11.2.5) ──────────────────────────────────────────────────────────────────────

vi.mock("@/ui/use-actions", () => ({ useActions: () => ({ fire: domEnv.fire, passLesson: domEnv.passLesson }) }));
vi.mock("@/app/providers", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).providersMock);
vi.mock("@/forge/ai-port", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/forge/ai-port")>();
  return { ...real, submitForgeVerdict: (req: unknown) => domEnv.submit(req) };
});

const domEnv = vi.hoisted(() => ({
  store: null as import("@/store/arcanum-store").ArcanumStore | null,
  passLesson: vi.fn(async () => {}),
  submit: vi.fn(async (_req: unknown) => ({ estado: "en-cola", motivo: "Sin red: en cola" }) as unknown),
  fire: vi.fn(async (type: string, payload: unknown, refs: { goalId?: string | null; moduleId?: string | null }) => {
    const { makeEvent: mk } = await import("@/core/event");
    const e = mk(type as never, payload as never, { ts: Date.now(), deviceId: "t", goalId: refs.goalId ?? null, moduleId: refs.moduleId ?? null });
    await domEnv.store!.getState().dispatch(e, Date.now());
  }),
}));

describe("retención · DOM del corredor (§11.2.5)", () => {
  beforeEach(() => {
    domEnv.passLesson.mockClear();
    domEnv.submit.mockReset();
    domEnv.submit.mockResolvedValue({ estado: "en-cola", motivo: "Sin red: en cola" });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  async function mountRet(itemId: string, nowMs: number, seed: ArcanumEvent[] = []) {
    const { createEnvelope } = await import("@/forge/__tests__/helpers/flow-envelope");
    const RetencionRunner = (await import("@/forge/ui/exercises/RetencionRunner")).default;
    const env = await createEnvelope();
    domEnv.store = env.store;
    const cellId = env.store.getState().readModel.modules[0]?.id ?? CELL;
    const goalId = env.store.getState().readModel.modules[0]?.goalId ?? null;
    // seed: an independent approved verdict so the retention is due, plus any extra events
    const g = makeEvent("gate.evaluated", { passed: true, score: 1, summary: "", feedback: "", source: "ai", provider: "azure", forge: verdict() } as never, { ts: nowMs - 30 * DAY_MS, deviceId: "t", goalId, moduleId: cellId });
    for (const e of [g, ...seed]) await env.store.getState().dispatch(e, nowMs);
    vi.spyOn(Date, "now").mockReturnValue(nowMs);
    const item = realForgeItem("P2-06", itemId, "retencion");
    const rm = () => env.store.getState().readModel;
    const view = render(<RetencionRunner item={item} cellCode="P2-06" cellId={cellId} readModel={rm()} onClose={() => {}} />);
    return { env, cellId, item, rm, view };
  }

  it("antes del vencimiento no hay editor ni botón de calificar", async () => {
    const { env, cellId } = await (async () => {
      const { createEnvelope } = await import("@/forge/__tests__/helpers/flow-envelope");
      const e = await createEnvelope();
      domEnv.store = e.store;
      const cid = e.store.getState().readModel.modules[0]?.id ?? CELL;
      const gid = e.store.getState().readModel.modules[0]?.goalId ?? null;
      const g = makeEvent("gate.evaluated", { passed: true, score: 1, summary: "", feedback: "", source: "ai", provider: "azure", forge: verdict() } as never, { ts: T0, deviceId: "t", goalId: gid, moduleId: cid });
      await e.store.getState().dispatch(g, T0);
      return { env: e, cellId: cid };
    })();
    const RetencionRunner = (await import("@/forge/ui/exercises/RetencionRunner")).default;
    vi.spyOn(Date, "now").mockReturnValue(T0 + 3 * DAY_MS);
    const item = realForgeItem("P2-06", "p206-ret-timeout", "retencion");
    render(<RetencionRunner item={item} cellCode="P2-06" cellId={cellId} readModel={env.store.getState().readModel} onClose={() => {}} />);
    expect(screen.queryByLabelText("Tu función"), "la retención se calificó antes de vencer").toBeNull();
    expect(screen.queryByRole("button", { name: /Ejecutar y calificar/ })).toBeNull();
  });

  it("vencida, el código correcto registra forma codigo y la competencia queda retenida", async () => {
    const { env, cellId, item } = await mountRet("p206-ret-timeout", T0 + 30 * DAY_MS);
    if (item.data.forma !== "codigo") throw new Error("no codigo");
    // before a correct attempt is in the log, the «solución» block is not in the DOM (rc34)
    expect(screen.queryByText("solución"), "la solución apareció antes de un acierto registrado").toBeNull();
    fireEvent.change(screen.getByLabelText("Tu función"), { target: { value: item.data.solucion.js! } });
    fireEvent.click(screen.getByRole("button", { name: /Ejecutar y calificar/ }));
    await waitFor(() => expect(document.body.textContent).toContain("✓ Pasan"));
    const e = env.store.getState().readModel.evidence.find((x) => x.itemId === "p206-ret-timeout" && x.phase === "respuesta");
    expect(e, "no se registró la respuesta").toBeTruthy();
    const data = e!.data as Record<string, unknown>;
    expect(data.forma).toBe("codigo");
    expect(competenceState(cellId, env.store.getState().readModel)).toBe("retenida");
    expect(domEnv.passLesson).toHaveBeenCalled();
  });

  it("en defensa ningún apoyo empieza marcado y «Pedir veredicto» exige apoyo, respuesta y cola vacía", async () => {
    await mountRet("p206-ret-inventario", T0 + 30 * DAY_MS);
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.some((r) => r.checked), "el apoyo tenía un valor por omisión").toBe(false);
    const boton = () => screen.getByRole("button", { name: /Pedir veredicto/ }) as HTMLButtonElement;
    expect(boton().disabled, "se pudo pedir el veredicto sin apoyo, sin respuesta o con un envío en cola").toBe(true);
    fireEvent.click(radios[0]!);
    expect(boton().disabled).toBe(true); // falta la respuesta
    fireEvent.change(screen.getByLabelText("Tu respuesta"), { target: { value: "una historia concreta" } });
    expect(boton().disabled).toBe(false);
  });

  it("en cola pinta el motivo honesto", async () => {
    await mountRet("p206-ret-inventario", T0 + 30 * DAY_MS);
    fireEvent.click(screen.getAllByRole("radio")[0]!);
    fireEvent.change(screen.getByLabelText("Tu respuesta"), { target: { value: "historia" } });
    fireEvent.click(screen.getByRole("button", { name: /Pedir veredicto/ }));
    await waitFor(() => expect(document.body.textContent).toContain("Tu respuesta quedó en cola: Sin red: en cola. Se evalúa sola cuando haya conexión."));
  });

  it("un veredicto truncado pinta el aviso y no undefined", async () => {
    const seedTrunc = (cellId: string, goalId: string | null) => makeEvent("evidence.recorded", { itemId: "p206-ret-inventario", type: "retencion", phase: "veredicto", outcome: "aprobado", source: "ai", provider: "azure", data: { truncated: true, bytes: 9000 } } as never, { ts: T0 + 29 * DAY_MS, deviceId: "t", goalId, moduleId: cellId });
    const { createEnvelope } = await import("@/forge/__tests__/helpers/flow-envelope");
    const RetencionRunner = (await import("@/forge/ui/exercises/RetencionRunner")).default;
    const env = await createEnvelope();
    domEnv.store = env.store;
    const cellId = env.store.getState().readModel.modules[0]?.id ?? CELL;
    const goalId = env.store.getState().readModel.modules[0]?.goalId ?? null;
    const g = makeEvent("gate.evaluated", { passed: true, score: 1, summary: "", feedback: "", source: "ai", provider: "azure", forge: verdict() } as never, { ts: T0, deviceId: "t", goalId, moduleId: cellId });
    for (const e of [g, seedTrunc(cellId, goalId)]) await env.store.getState().dispatch(e, T0 + 30 * DAY_MS);
    vi.spyOn(Date, "now").mockReturnValue(T0 + 30 * DAY_MS);
    const item = realForgeItem("P2-06", "p206-ret-inventario", "retencion");
    render(<RetencionRunner item={item} cellCode="P2-06" cellId={cellId} readModel={env.store.getState().readModel} onClose={() => {}} />);
    expect(document.body.textContent).toContain("✓ Retención aprobada.");
    expect(document.body.textContent, "el veredicto truncado se pintó como si tuviera detalle").toContain("El detalle es demasiado largo para mostrarlo aquí; quedó en el registro.");
    expect(document.body.textContent).not.toContain("undefined");
  });

  it("(a) resultado inmediato: pinta el veredicto que se pidió, no el otro (rc90)", async () => {
    const { createEnvelope } = await import("@/forge/__tests__/helpers/flow-envelope");
    const RetencionRunner = (await import("@/forge/ui/exercises/RetencionRunner")).default;
    const env = await createEnvelope();
    domEnv.store = env.store;
    const cellId = env.store.getState().readModel.modules[0]?.id ?? CELL;
    const goalId = env.store.getState().readModel.modules[0]?.goalId ?? null;
    const g = makeEvent("gate.evaluated", { passed: true, score: 1, summary: "", feedback: "", source: "ai", provider: "azure", forge: verdict() } as never, { ts: T0, deviceId: "t", goalId, moduleId: cellId });
    const aprob = makeEvent("evidence.recorded", { itemId: "p206-ret-inventario", type: "retencion", phase: "veredicto", outcome: "aprobado", source: "ai", provider: "azure", data: { summary: "bien", feedback: "ok" } } as never, { ts: T0 + 1, deviceId: "t", goalId, moduleId: cellId });
    const reprob = makeEvent("evidence.recorded", { itemId: "p206-ret-inventario", type: "retencion", phase: "veredicto", outcome: "reprobado", source: "ai", provider: "azure", data: { summary: "mal", feedback: "no" } } as never, { ts: T0 + 2, deviceId: "otro", goalId, moduleId: cellId });
    for (const e of [g, aprob, reprob]) await env.store.getState().dispatch(e, T0 + 30 * DAY_MS);
    domEnv.submit.mockResolvedValue({ estado: "acunado", eventId: aprob.id });
    vi.spyOn(Date, "now").mockReturnValue(T0 + 30 * DAY_MS);
    const item = realForgeItem("P2-06", "p206-ret-inventario", "retencion");
    render(<RetencionRunner item={item} cellCode="P2-06" cellId={cellId} readModel={env.store.getState().readModel} onClose={() => {}} />);
    fireEvent.click(screen.getAllByRole("radio")[0]!);
    fireEvent.change(screen.getByLabelText("Tu respuesta"), { target: { value: "historia" } });
    // at mount, `ultimo` is the rejected one (higher ts): «✕ No aprobada.» is already painted. After the acunado
    // answer, the runner must pin the REQUESTED (approved) verdict by its id (rc90): «✕ No aprobada.» must disappear.
    expect(document.body.textContent).toContain("✕ No aprobada.");
    fireEvent.click(screen.getByRole("button", { name: /Pedir veredicto/ }));
    await waitFor(() => expect(domEnv.submit).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText("Enviando…")).toBeNull());
    expect(document.body.textContent, "el resultado de la retención no es el del veredicto que se pidió").toContain("✓ Retención aprobada.");
    expect(document.body.textContent).not.toContain("✕ No aprobada.");
  });

  it("(b) al reabrir pinta el último por ts, no uno viejo (rc91)", async () => {
    const { createEnvelope } = await import("@/forge/__tests__/helpers/flow-envelope");
    const RetencionRunner = (await import("@/forge/ui/exercises/RetencionRunner")).default;
    const env = await createEnvelope();
    domEnv.store = env.store;
    const cellId = env.store.getState().readModel.modules[0]?.id ?? CELL;
    const goalId = env.store.getState().readModel.modules[0]?.goalId ?? null;
    const g = makeEvent("gate.evaluated", { passed: true, score: 1, summary: "", feedback: "", source: "ai", provider: "azure", forge: verdict() } as never, { ts: T0, deviceId: "t", goalId, moduleId: cellId });
    const reprob = makeEvent("evidence.recorded", { itemId: "p206-ret-inventario", type: "retencion", phase: "veredicto", outcome: "reprobado", source: "ai", provider: "azure", data: { summary: "mal", feedback: "no" } } as never, { ts: T0 + 1, deviceId: "t", goalId, moduleId: cellId });
    const aprob = makeEvent("evidence.recorded", { itemId: "p206-ret-inventario", type: "retencion", phase: "veredicto", outcome: "aprobado", source: "ai", provider: "azure", data: { summary: "bien", feedback: "ok" } } as never, { ts: T0 + 2, deviceId: "t", goalId, moduleId: cellId });
    for (const e of [g, reprob, aprob]) await env.store.getState().dispatch(e, T0 + 30 * DAY_MS);
    vi.spyOn(Date, "now").mockReturnValue(T0 + 30 * DAY_MS);
    const item = realForgeItem("P2-06", "p206-ret-inventario", "retencion");
    render(<RetencionRunner item={item} cellCode="P2-06" cellId={cellId} readModel={env.store.getState().readModel} onClose={() => {}} />);
    expect(document.body.textContent, "al reabrir, la retención pintó un veredicto viejo").toContain("✓ Retención aprobada.");
    expect(document.body.textContent).not.toContain("✕ No aprobada.");
  });

  it("un rechazo pinta el detalle, no «invalid»", async () => {
    domEnv.submit.mockResolvedValue({ estado: "rechazado", error: "invalid", detalle: "retencion-desconocida" });
    await mountRet("p206-ret-inventario", T0 + 30 * DAY_MS);
    fireEvent.click(screen.getAllByRole("radio")[0]!);
    fireEvent.change(screen.getByLabelText("Tu respuesta"), { target: { value: "historia" } });
    fireEvent.click(screen.getByRole("button", { name: /Pedir veredicto/ }));
    await waitFor(() => expect(document.body.textContent).toContain("No se pudo pedir el veredicto (retencion-desconocida)."));
  });
});
