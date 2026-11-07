import { describe, it, expect } from "vitest";
import { ENTREGA_KEYS, makeEvent, type ArcanumEvent, type Json } from "@/core/event";
import { buildForgeJudgeContext, mintTargetFor } from "@/forge/ai";
import { fixtureRoute } from "@/forge/__tests__/helpers/flow-envelope";

// §9.5 / §22.4: the context builder (pure). A gate needs a mission.submitted with the 9 keys and a declared
// apoyo; with a giro in the bank it also needs the answer recorded AFTER that submission; an evidence submission
// needs apoyo. The apoyo of a gate comes from the mission event, never from the caller.

const route = fixtureRoute({ code: "P2-06", compuerta: "mision", flujo: "mision" });
const cell = route.cells[0]!;
let t = 1_000;
const ev = (type: ArcanumEvent["type"], payload: Record<string, unknown>): ArcanumEvent =>
  makeEvent(type, payload as Json, { ts: ++t, deviceId: "d", goalId: null, moduleId: cell.id });
const entrega = Object.fromEntries(ENTREGA_KEYS.map((k) => [k, `texto de ${k}`]));

describe("buildForgeJudgeContext", () => {
  it("entrega-pendiente without a mission.submitted, with fewer than 9 keys, or without apoyo", () => {
    expect(buildForgeJudgeContext({ route, cell, kind: "mision", scope: "local", events: [], giro: null })).toEqual({ error: "entrega-pendiente" });
    const partial = ev("mission.submitted", { notes: "x", entrega: { problema: "p" }, apoyo: "independiente" });
    expect(buildForgeJudgeContext({ route, cell, kind: "mision", scope: "local", events: [partial], giro: null, missionEventId: partial.id })).toEqual({ error: "entrega-pendiente" });
    const noApoyo = ev("mission.submitted", { notes: "x", entrega });
    expect(buildForgeJudgeContext({ route, cell, kind: "mision", scope: "local", events: [noApoyo], giro: null, missionEventId: noApoyo.id }), "se pidió la compuerta sin una entrega con apoyo").toEqual({ error: "entrega-pendiente" });
  });

  it("the apoyo of a gate comes from the mission even if the caller sends another", () => {
    const m = ev("mission.submitted", { notes: "x", entrega, apoyo: "con_apoyo" });
    const r = buildForgeJudgeContext({ route, cell, kind: "mision", scope: "local", apoyo: "independiente", events: [m], giro: null, missionEventId: m.id });
    expect("context" in r && r.context.apoyo).toBe("con_apoyo");
    expect("context" in r && Object.keys(r.context.evidence.entrega as object).length).toBe(9);
  });

  it("giro-pendiente when the bank has a giro and no answer was recorded after the submission", () => {
    const before = ev("evidence.recorded", { itemId: "giro-1", type: "giro", phase: "respuesta", outcome: "registrado", source: "local", data: { respuesta: "vieja" } });
    const m = ev("mission.submitted", { notes: "x", entrega, apoyo: "independiente" });
    const giro = { texto: "se elimina una fuente" };
    expect(buildForgeJudgeContext({ route, cell, kind: "mision", scope: "local", events: [before, m], giro, missionEventId: m.id })).toEqual({ error: "giro-pendiente" });
    const after = ev("evidence.recorded", { itemId: "giro-1", type: "giro", phase: "respuesta", outcome: "registrado", source: "local", data: { respuesta: "nueva" } });
    const r = buildForgeJudgeContext({ route, cell, kind: "mision", scope: "local", events: [before, m, after], giro, missionEventId: m.id });
    expect("context" in r && r.context.evidence.giro).toEqual({ texto: "se elimina una fuente", respuesta: "nueva" });
  });

  it("apoyo-pendiente for an evidence submission without apoyo", () => {
    expect(mintTargetFor(cell, "retencion")).toBe("evidence");
    expect(buildForgeJudgeContext({ route, cell, kind: "retencion", scope: "local", events: [], giro: null })).toEqual({ error: "apoyo-pendiente" });
    const r = buildForgeJudgeContext({ route, cell, kind: "retencion", scope: "local", apoyo: "independiente", events: [], giro: null, retencionItemId: "r1", retencion: { enunciado: "v", rubrica: ["r"] }, respuesta: "x" });
    expect("context" in r && r.context.apoyo).toBe("independiente");
    expect("context" in r && r.context.evidence.retencion).toEqual({ itemId: "r1", enunciado: "v", rubrica: ["r"], respuesta: "x" });
  });

  it("retencion-desconocida when a retention submission arrives without the variant and rubric", () => {
    const r = buildForgeJudgeContext({ route, cell, kind: "retencion", scope: "local", apoyo: "independiente", events: [], giro: null, retencionItemId: "r1", respuesta: "x" });
    expect(r, "una retención sin su variante llegó al juez").toEqual({ error: "retencion-desconocida" });
  });

  it("clips a context above 90,000 characters, marking «[recortado]»", () => {
    const big = { ...entrega, implementacion: "a".repeat(95_000) };
    const m = ev("mission.submitted", { notes: "x", entrega: big, apoyo: "independiente" });
    const r = buildForgeJudgeContext({ route, cell, kind: "mision", scope: "local", events: [m], giro: null, missionEventId: m.id });
    expect("context" in r).toBe(true);
    if ("context" in r) {
      expect(JSON.stringify(r.context).length).toBeLessThanOrEqual(90_000);
      expect((r.context.evidence.entrega as Record<string, string>).implementacion).toContain("[recortado]");
    }
  });
});
