import { describe, it, expect } from "vitest";
import { makeEvent, type ArcanumEvent } from "@/core/event";
import { project } from "@/core/projector";
import { FORGE_GOAL_ID, type ForgeVerdictFields } from "@/core/forge-verdict";
import { competenceState, nativeDomain } from "@/forge/model/competence";
import { remediationRequired } from "@/forge/model/remediation";
import { presentForgeRetention } from "@/forge/model/retention";

// §8.4: only verdicts from the AI count; a heuristic verdict with approved Forge fields, or self-declared evidence,
// never moves the board, the native line, retention or remediation.
const CELL = "cf000000-0000-4000-8000-0050322d3036";
const T0 = Date.UTC(2026, 10, 10, 15, 0, 0);
let n = 0;
const ev = (type: Parameters<typeof makeEvent>[0], payload: unknown, ts: number): ArcanumEvent =>
  makeEvent(type, payload as never, { ts, deviceId: "t", goalId: FORGE_GOAL_ID, moduleId: CELL, id: `c5000000-0000-4000-8000-${String(++n).padStart(12, "0")}` });
const base = [
  makeEvent("goal.upserted", { title: "Engineering Forge", priority: 1, color: "#ffffff", sigil: "forge" }, { ts: T0, deviceId: "t", goalId: FORGE_GOAL_ID, id: "c5000000-0000-4000-8000-100000000001" }),
  makeEvent("module.upserted", { title: "P2-06", prereqs: [], kind: "mission" }, { ts: T0 + 1, deviceId: "t", goalId: FORGE_GOAL_ID, moduleId: CELL, id: "c5000000-0000-4000-8000-100000000002" }),
];
const approved = (scope: "local" | "nativa", over: Partial<ForgeVerdictFields> = {}): ForgeVerdictFields => ({
  v: 1, kind: "mision", essential: ["sistemas"], capabilities: { sistemas: 4 }, critical: [{ id: "consistencia", passed: true }],
  failureMode: null, scope, apoyo: "independiente", ...(scope === "nativa" ? { nativePassed: true } : {}), ...over,
});
const bank = [{ cellId: CELL, items: [{ id: "ret-1", type: "retencion", dias: 1 }] }];

describe("model-source: a verdict that is not from the AI changes nothing (§8.4)", () => {
  it("heuristic gate.evaluated with approved Forge fields: en_aprendizaje, native pending, no retention, no remediation", () => {
    const rm = project([
      ...base,
      ev("gate.evaluated", { passed: true, score: 1, summary: "", feedback: "", source: "heuristic", provider: null, forge: approved("local") }, T0 + 10),
      ev("gate.evaluated", { passed: false, score: 1, summary: "", feedback: "", source: "heuristic", provider: null, forge: approved("nativa") }, T0 + 11),
      ev("gate.evaluated", { passed: false, score: 0, summary: "", feedback: "", source: "heuristic", provider: null, forge: approved("local", { critical: [{ id: "c", passed: false }], failureMode: "ejecucion" }) }, T0 + 12),
      ev("gate.evaluated", { passed: false, score: 0, summary: "", feedback: "", source: "heuristic", provider: null, forge: approved("local", { critical: [{ id: "c", passed: false }], failureMode: "ejecucion" }) }, T0 + 13),
    ]);
    expect(competenceState(CELL, rm), "un veredicto que no es de IA cambió el estado de competencia").toBe("en_aprendizaje");
    expect(nativeDomain(CELL, rm)).toBe("pendiente");
    const ret = presentForgeRetention(rm, bank, T0 + 100 * 86_400_000);
    expect(ret.vencidos.length + ret.proximos.length).toBe(0);
    expect(remediationRequired(CELL, rm, [])).toBeNull();
  });

  it("the model itself ignores a non-AI verdict even if a read model claimed it passed (second layer)", () => {
    const rm = project(base);
    const forged = {
      ...rm,
      forgeVerdicts: [
        { moduleId: CELL, source: "heuristic" as const, passed: true, failureMode: null, scope: "local" as const, apoyo: "independiente" as const, kind: "mision" as const, ts: T0 + 10, eventId: "e1", queueId: null },
        { moduleId: CELL, source: "heuristic" as const, passed: true, failureMode: null, scope: "nativa" as const, apoyo: "independiente" as const, kind: "mision" as const, ts: T0 + 11, eventId: "e2", queueId: null },
      ],
    };
    expect(competenceState(CELL, forged), "un veredicto que no es de IA cambió el estado de competencia").toBe("en_aprendizaje");
    expect(nativeDomain(CELL, forged)).toBe("pendiente");
    expect(presentForgeRetention(forged, bank, T0 + 100 * 86_400_000).vencidos).toHaveLength(0);
  });

  it("evidence with source self and outcome aprobado changes nothing", () => {
    const rm0 = project(base);
    const rm = project([...base, ev("evidence.recorded", { itemId: "pasada-1", type: "retencion", phase: "respuesta", outcome: "aprobado", data: { forma: "codigo" }, source: "self", verdict: approved("local") }, T0 + 10)]);
    expect(competenceState(CELL, rm0)).toBe("no_evaluada");
    expect(competenceState(CELL, rm)).toBe("en_aprendizaje"); // there is a record, but it approves nothing
    expect(rm.evidence[0]!.passed).toBe(false);
    expect(rm.modules.find((m) => m.id === CELL)!.gatePassed).toBe(false);
  });
});
