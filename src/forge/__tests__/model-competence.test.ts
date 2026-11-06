import { describe, it, expect } from "vitest";
import { makeEvent, type ArcanumEvent } from "@/core/event";
import { project } from "@/core/projector";
import { FORGE_GOAL_ID, type ForgeVerdictFields } from "@/core/forge-verdict";
import { COMPETENCE_LABELS, competenceCounts, competenceState, nativeDomain } from "@/forge/model/competence";
import { DAY_MS, presentForgeRetention } from "@/forge/model/retention";

const CELL = "cf000000-0000-4000-8000-0050322d3036";
const DIAG = "cf000000-0000-4000-8000-000000004431";
const T0 = Date.UTC(2026, 10, 10, 15, 0, 0);
let n = 0;
const ev = (type: Parameters<typeof makeEvent>[0], payload: unknown, ts: number, moduleId = CELL): ArcanumEvent =>
  makeEvent(type, payload as never, { ts, deviceId: "t", goalId: FORGE_GOAL_ID, moduleId, id: `c8000000-0000-4000-8000-${String(++n).padStart(12, "0")}` });
const base = [
  makeEvent("goal.upserted", { title: "Engineering Forge", priority: 1, color: "#ffffff", sigil: "forge" }, { ts: T0, deviceId: "t", goalId: FORGE_GOAL_ID, id: "c8000000-0000-4000-8000-100000000001" }),
  makeEvent("module.upserted", { title: "P2-06", prereqs: [], kind: "mission" }, { ts: T0 + 1, deviceId: "t", goalId: FORGE_GOAL_ID, moduleId: CELL, id: "c8000000-0000-4000-8000-100000000002" }),
  makeEvent("module.upserted", { title: "D1", prereqs: [], kind: "diagnostic" }, { ts: T0 + 2, deviceId: "t", goalId: FORGE_GOAL_ID, moduleId: DIAG, id: "c8000000-0000-4000-8000-100000000003" }),
];
const verdict = (over: Partial<ForgeVerdictFields> = {}): ForgeVerdictFields => ({
  v: 1, kind: "mision", essential: ["sistemas"], capabilities: { sistemas: 3 }, critical: [{ id: "consistencia", passed: true }],
  failureMode: null, scope: "local", apoyo: "independiente", ...over,
});
const gate = (ts: number, f: ForgeVerdictFields, moduleId = CELL) =>
  ev("gate.evaluated", { passed: true, score: 1, summary: "", feedback: "", source: "ai", provider: "azure", forge: f }, ts, moduleId);

describe("competence board (§8.4, CA-36)", () => {
  it("walks the five states from the log", () => {
    expect(competenceState(CELL, project(base))).toBe("no_evaluada");
    expect(COMPETENCE_LABELS.no_evaluada).toBe("no evaluada");
    const started = [...base, ev("mission.submitted", { notes: "n" }, T0 + 10)];
    expect(competenceState(CELL, project(started))).toBe("en_aprendizaje");
    const apoyo = [...started, gate(T0 + 11, verdict({ apoyo: "con_apoyo" }))];
    expect(competenceState(CELL, project(apoyo))).toBe("con_apoyo");
    const indep = [...apoyo, gate(T0 + 12, verdict())];
    expect(competenceState(CELL, project(indep))).toBe("independiente");
    const retained = [...indep, ev("evidence.recorded", { itemId: "ret-1", type: "retencion", phase: "respuesta", outcome: "correcto", data: { forma: "codigo" }, source: "local" }, T0 + 13)];
    expect(competenceState(CELL, project(retained))).toBe("retenida");
  });

  it("retention before the independent verdict, or a local retention not in forma codigo, does not retain", () => {
    const early = [...base, ev("evidence.recorded", { itemId: "ret-1", type: "retencion", phase: "respuesta", outcome: "correcto", data: { forma: "codigo" }, source: "local" }, T0 + 5), gate(T0 + 12, verdict())];
    expect(competenceState(CELL, project(early))).toBe("independiente");
    const defensaLocal = [...base, gate(T0 + 12, verdict()), ev("evidence.recorded", { itemId: "ret-1", type: "retencion", phase: "respuesta", outcome: "correcto", data: { forma: "defensa" }, source: "local" }, T0 + 13)];
    expect(competenceState(CELL, project(defensaLocal))).toBe("independiente");
  });

  it("a diagnostic cell never goes beyond en_aprendizaje; counts per state, never an average", () => {
    const rm = project([...base, gate(T0 + 12, verdict(), DIAG), ev("evidence.recorded", { itemId: "pasada-1", type: "observacion", phase: "pasada-1", outcome: "registrado", data: {}, source: "self" }, T0 + 13, DIAG)]);
    expect(competenceState(DIAG, rm)).toBe("en_aprendizaje");
    const counts = competenceCounts([CELL, DIAG], rm);
    expect(counts).toEqual({ no_evaluada: 1, en_aprendizaje: 1, con_apoyo: 0, independiente: 0, retenida: 0 });
  });

  it("CA-35: «dominio nativo» is pending until a native AI verdict passes, and stays verified after", () => {
    const nat = verdict({ scope: "nativa", nativePassed: true });
    expect(nativeDomain(CELL, project(base))).toBe("pendiente");
    const rm = project([...base, ev("gate.evaluated", { passed: false, score: 1, summary: "", feedback: "", source: "ai", provider: "azure", forge: nat }, T0 + 10)]);
    expect(nativeDomain(CELL, rm)).toBe("verificado");
    expect(rm.modules.find((m) => m.id === CELL)!.gatePassed).toBe(false);
    const later = project([...base, ev("gate.evaluated", { passed: false, score: 1, summary: "", feedback: "", source: "ai", provider: "azure", forge: nat }, T0 + 10), ev("gate.evaluated", { passed: false, score: 0, summary: "", feedback: "", source: "ai", provider: "azure", forge: { ...nat, nativePassed: false } }, T0 + 11)]);
    expect(nativeDomain(CELL, later)).toBe("verificado");
  });
});

describe("retention presenter (§8.7, CA-39) with a fake clock", () => {
  it("due = first independent local AI verdict + dias; overdue and upcoming split by now", () => {
    const rm = project([...base, gate(T0 + 10, verdict()), gate(T0 + 20, verdict())]);
    const bank = [{ cellId: CELL, items: [{ id: "ret-7", type: "retencion", dias: 7 }, { id: "ret-30", type: "retencion", dias: 30 }, { id: "otro", type: "code" }] }];
    const v = presentForgeRetention(rm, bank, T0 + 10 + 8 * DAY_MS);
    expect(v.vencidos.map((x) => x.itemId)).toEqual(["ret-7"]);
    expect(v.vencidos[0]!.dueMs).toBe(T0 + 10 + 7 * DAY_MS);
    expect(v.proximos.map((x) => x.itemId)).toEqual(["ret-30"]);
    expect(presentForgeRetention(project([...base, gate(T0 + 10, verdict({ apoyo: "con_apoyo" }))]), bank, T0 + 100 * DAY_MS).vencidos).toHaveLength(0);
  });
});
