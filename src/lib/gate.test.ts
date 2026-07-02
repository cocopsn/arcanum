import { describe, it, expect } from "vitest";
import { buildGateContext } from "@/lib/gate";
import { project } from "@/core/projector";
import { SEED_EVENTS } from "@/lib/seed";
import { SPINES } from "@/lib/spines";

const rm = project(SEED_EVENTS);
// the remaining authored pre-written exit-gate demo cell (German A1.2 — ITC's AVL and FrED's
// backprop gates became heavy mission cells; the gate machinery is still exercised here).
const demoCell = SPINES.flatMap((s) => s.cells).find((c) => c.gate)!;

describe("buildGateContext", () => {
  it("builds the gate context from the cell's authored gate + canonical source", () => {
    const ctx = buildGateContext(rm, demoCell.id, "  mi justificación  ")!;
    expect(ctx.cellTitle).toBe(demoCell.title);
    expect(ctx.question.length).toBeGreaterThan(0);
    expect(ctx.rubric.length).toBeGreaterThan(0);
    expect(ctx.sourceRefs.some((u) => u.startsWith("http"))).toBe(true);
    expect(ctx.justification).toBe("mi justificación"); // trimmed
  });

  it("returns null for a cell without a gate", () => {
    const noGate = SPINES.flatMap((s) => s.cells).find((c) => !c.gate)!;
    expect(buildGateContext(rm, noGate.id, "x")).toBeNull();
  });
});
