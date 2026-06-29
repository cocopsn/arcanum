import { describe, it, expect } from "vitest";
import { buildEvaluationContext, heuristicEvaluation } from "@/core/evaluation";
import { project } from "@/core/projector";
import { makeEvent } from "@/core/event";

const D0 = Date.UTC(2026, 5, 28, 12, 0, 0);
const dev = (ts: number, moduleId?: string) => ({ ts, deviceId: "d", moduleId });

describe("buildEvaluationContext — derived from the log", () => {
  const events = [
    makeEvent("module.upserted", { title: "Test", prereqs: [], kind: "core" }, { ...dev(D0), goalId: "g", moduleId: "m1" }),
    makeEvent("module.started", {}, dev(D0, "m1")),
    makeEvent("checkpoint.passed", { score: 0.9 }, dev(D0, "m1")),
    makeEvent("error.resolved", { insight: "a" }, dev(D0, "m1")),
    makeEvent("error.resolved", { insight: "b" }, dev(D0, "m1")),
    makeEvent("error.resolved", { insight: "c" }, dev(D0, "m1")),
    makeEvent("firetest.attempted", { reached: 8, ceiling: 10 }, dev(D0, "m1")),
  ];
  const rm = project(events);

  it("aggregates the module's real signals", () => {
    const ctx = buildEvaluationContext(rm, events, "m1", D0 + 3_600_000)!;
    expect(ctx.title).toBe("Test");
    expect(ctx.checkpointCount).toBe(1);
    expect(ctx.checkpointAvg).toBeCloseTo(0.9, 6);
    expect(ctx.errorsResolved).toBe(3);
    expect(ctx.firetestBest).toBeCloseTo(0.8, 6);
    expect(ctx.retrievability).toBeGreaterThan(0);
    expect(ctx.daysActive).toBe(0);
  });

  it("returns null for an unknown module", () => {
    expect(buildEvaluationContext(rm, events, "ghost", D0)).toBeNull();
  });
});

describe("heuristicEvaluation — adversarial-but-fair, no invented praise", () => {
  it("credits only what the data supports and always pushes a challenge", () => {
    const ctx = {
      moduleId: "m1",
      title: "Árboles AVL",
      status: "started" as const,
      retrievability: 0.9,
      checkpointCount: 2,
      checkpointAvg: 0.85,
      errorsResolved: 4,
      firetestBest: 0.8,
      daysActive: 3,
    };
    const v = heuristicEvaluation(ctx);
    expect(v.strengths.length).toBeGreaterThan(0);
    expect(v.score).toBeGreaterThan(0.8);
    expect(v.challenge).toContain("Árboles AVL");
  });

  it("a fresh idle module gets no fake praise and a reto-first challenge", () => {
    const ctx = {
      moduleId: "m2",
      title: "Grafos",
      status: "idle" as const,
      retrievability: 0.1,
      checkpointCount: 0,
      checkpointAvg: null,
      errorsResolved: 0,
      firetestBest: null,
      daysActive: null,
    };
    const v = heuristicEvaluation(ctx);
    expect(v.strengths).toEqual(["Apenas empiezas aquí — todo por construir, sin vicios todavía."]);
    expect(v.gaps.join(" ")).toMatch(/no inicias/i);
    expect(v.challenge).toMatch(/sin abrir un solo recurso/i);
    expect(v.score).toBeLessThan(0.3);
  });
});
