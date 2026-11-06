import { describe, it, expect } from "vitest";
import { makeEvent, type ArcanumEvent } from "@/core/event";
import { project } from "@/core/projector";
import { FORGE_GOAL_ID, type ForgeVerdictFields } from "@/core/forge-verdict";
import { FAILURE_MODE_INFO, remediationRequired } from "@/forge/model/remediation";

// §8.5 / CA-37: two failures with the same mode ask for the §05 intervention before a third attempt; it is
// fulfilled only by a correct local bank item of a remedying type (or the light lesson when the bank has none),
// written after the second failure. Nothing depends on the clock.
const CELL = "cf000000-0000-4000-8000-0050322d3036";
const T0 = Date.UTC(2026, 10, 10, 15, 0, 0);
let n = 0;
const ev = (type: Parameters<typeof makeEvent>[0], payload: unknown, ts: number): ArcanumEvent =>
  makeEvent(type, payload as never, { ts, deviceId: "t", goalId: FORGE_GOAL_ID, moduleId: CELL, id: `c6000000-0000-4000-8000-${String(++n).padStart(12, "0")}` });
const base = [
  makeEvent("goal.upserted", { title: "Engineering Forge", priority: 1, color: "#ffffff", sigil: "forge" }, { ts: T0, deviceId: "t", goalId: FORGE_GOAL_ID, id: "c6000000-0000-4000-8000-100000000001" }),
  makeEvent("module.upserted", { title: "P2-06", prereqs: [], kind: "mission" }, { ts: T0 + 1, deviceId: "t", goalId: FORGE_GOAL_ID, moduleId: CELL, id: "c6000000-0000-4000-8000-100000000002" }),
];
const failed = (mode: ForgeVerdictFields["failureMode"]): ForgeVerdictFields => ({
  v: 1, kind: "mision", essential: ["sistemas"], capabilities: { sistemas: 2 }, critical: [{ id: "consistencia", passed: false }],
  failureMode: mode, scope: "local", apoyo: "independiente",
});
const fail = (ts: number, mode: ForgeVerdictFields["failureMode"] = "ejecucion", queueId?: string) =>
  ev("gate.evaluated", { passed: false, score: 0.2, summary: "", feedback: "", source: "ai", provider: "azure", forge: failed(mode), ...(queueId ? { queueId } : {}) }, ts);
const local = (ts: number, type: string, outcome = "correcto") =>
  ev("evidence.recorded", { itemId: "it-1", type, phase: "respuesta", outcome, data: {}, source: "local" }, ts);
const lesson = (ts: number) =>
  ev("evidence.recorded", { itemId: "leccion-ligera", type: "remediacion", phase: "leccion", outcome: "correcto", data: { score: 1 }, source: "ai" }, ts);

describe("remediation (§8.5, CA-37)", () => {
  it("two failures with the same mode require the intervention of §05; one failure or two different modes do not", () => {
    expect(remediationRequired(CELL, project([...base, fail(T0 + 10)]), ["code"])).toBeNull();
    expect(remediationRequired(CELL, project([...base, fail(T0 + 10, "ejecucion"), fail(T0 + 11, "concepto")]), ["code"])).toBeNull();
    const r = remediationRequired(CELL, project([...base, fail(T0 + 10), fail(T0 + 11)]), ["code", "production"]);
    expect(r).toMatchObject({ mode: "ejecucion", intervencion: FAILURE_MODE_INFO.ejecucion.intervencion, via: "banco", tipos: ["code"] });
  });

  it("a correct local item of a remedying type AFTER the second failure fulfils it; one before does not", () => {
    expect(remediationRequired(CELL, project([...base, fail(T0 + 10), fail(T0 + 11), local(T0 + 12, "code")]), ["code"])).toBeNull();
    expect(remediationRequired(CELL, project([...base, local(T0 + 9, "code"), fail(T0 + 10), fail(T0 + 11)]), ["code"])).not.toBeNull();
    expect(remediationRequired(CELL, project([...base, fail(T0 + 10), fail(T0 + 11), local(T0 + 12, "code", "incorrecto")]), ["code"])).not.toBeNull();
    expect(remediationRequired(CELL, project([...base, fail(T0 + 10), fail(T0 + 11), local(T0 + 12, "senal")]), ["code", "senal"])).not.toBeNull();
  });

  it("a production self-attestation (checkpoint.passed) after two failures does NOT fulfil it", () => {
    const rm = project([...base, fail(T0 + 10), fail(T0 + 11), ev("checkpoint.passed", { score: 1, kind: "checkpoint" }, T0 + 12)]);
    expect(remediationRequired(CELL, rm, ["production", "code"]), "una autoverificación cumplió la remediación").not.toBeNull();
  });

  it("with no remedying type in the bank, the completed light lesson fulfils it", () => {
    const pending = remediationRequired(CELL, project([...base, fail(T0 + 10), fail(T0 + 11)]), ["choice"]);
    expect(pending?.via).toBe("leccion");
    expect(remediationRequired(CELL, project([...base, fail(T0 + 10), fail(T0 + 11), lesson(T0 + 12)]), ["choice"])).toBeNull();
  });

  it("two failed gate.evaluated with the same queueId (two devices draining one submission) count as ONE failure", () => {
    const rm = project([...base, fail(T0 + 10, "ejecucion", "q-1"), fail(T0 + 11, "ejecucion", "q-1")]);
    expect(remediationRequired(CELL, rm, ["code"]), "un envío drenado por dos dispositivos contó dos reprobaciones").toBeNull();
  });

  it("after a fulfilled remediation, one new failure with the same mode does not ask again; two do", () => {
    const evs = [...base, fail(T0 + 10), fail(T0 + 11), local(T0 + 12, "code"), fail(T0 + 13)];
    expect(remediationRequired(CELL, project(evs), ["code"])).toBeNull();
    expect(remediationRequired(CELL, project([...evs, fail(T0 + 14)]), ["code"])).not.toBeNull();
  });
});
