import { afterEach, describe, expect, it, vi } from "vitest";
import { makeEvent, type ArcanumEvent } from "@/core/event";
import { project } from "@/core/projector";
import { FORGE_GOAL_ID, type ForgeVerdictFields } from "@/core/forge-verdict";
import { DAY_MS } from "@/forge/model/retention";
import { gradeRetentionCode, retentionStatus } from "@/forge/eval/retention-grade";
import { realForgeItem } from "@/forge/__tests__/fixtures/evaluator-blocks";
import { execRunner } from "@/forge/__tests__/helpers/exec-runner";

// i · retencion (design §5.5, §11.1). This file grows with the feature: the AI context and the drain (4.2) and the
// DOM of the runner (4.3) come later. Here: the due gate over the presenter (fake clock) and the code grade.

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
