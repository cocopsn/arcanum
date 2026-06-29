import { describe, it, expect } from "vitest";
import { buildGateContext, heuristicGate } from "@/lib/gate";
import { project } from "@/core/projector";
import { SEED_EVENTS } from "@/lib/seed";
import { SPINES } from "@/lib/spines";

const rm = project(SEED_EVENTS);
const demoCell = SPINES[0]!.cells.find((c) => c.gate)!; // AVL

describe("buildGateContext", () => {
  it("builds the gate context from the cell's authored gate + canonical source", () => {
    const ctx = buildGateContext(rm, demoCell.id, "  mi justificación  ")!;
    expect(ctx.cellTitle).toContain("AVL");
    expect(ctx.question.length).toBeGreaterThan(0);
    expect(ctx.rubric.length).toBeGreaterThan(0);
    expect(ctx.sourceRefs.some((u) => u.startsWith("http"))).toBe(true);
    expect(ctx.justification).toBe("mi justificación"); // trimmed
  });

  it("returns null for a cell without a gate", () => {
    const noGate = SPINES[0]!.cells.find((c) => !c.gate)!;
    expect(buildGateContext(rm, noGate.id, "x")).toBeNull();
  });
});

describe("heuristicGate — honest, NEVER auto-passes", () => {
  const ctx = { cellTitle: "AVL", question: "q", rubric: ["r"], justification: "", sourceRefs: [] };

  it("rejects a trivially short justification (anti-gaming)", () => {
    const v = heuristicGate({ ...ctx, justification: "porque sí" });
    expect(v.passed).toBe(false);
    expect(v.summary).toMatch(/insuficiente/i);
  });

  it("a substantive answer still does NOT open the gate — it requires the evaluator", () => {
    const long = Array.from({ length: 20 }, (_, i) => `palabra${i}`).join(" ");
    const v = heuristicGate({ ...ctx, justification: long });
    expect(v.passed).toBe(false); // local heuristic can NEVER open the gate (no placebo)
    expect(v.feedback).toMatch(/evaluador/i);
  });
});
