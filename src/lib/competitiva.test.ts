import { describe, it, expect } from "vitest";
import { project } from "@/core/projector";
import { buildInterrogationContext } from "@/lib/mission";
import { SEED_EVENTS } from "@/lib/seed";
import { SPINES } from "@/lib/spines";
import { contentForModule } from "@/lib/subject-content";

const comp = SPINES.find((s) => s.goalTitle.startsWith("Competitiva"))!;
const itc = SPINES.find((s) => s.goalTitle === "ITC")!;
const rm = project(SEED_EVENTS);
const bsCell = comp.cells.find((c) => c.title.includes("Binary search"))!; // verification target
const relCell = comp.cells.find((c) => c.related)!; // graphs/DP — relates to ITC

describe("Competitiva (ICPC) — pattern-recognition spine (a DISTINCT nature)", () => {
  it("is built to depth: every cell is a heavy mission with interrogationMode 'pattern'", () => {
    expect(comp.cells.length).toBeGreaterThanOrEqual(7);
    expect(comp.cells.every((c) => c.mission && c.interrogationMode === "pattern")).toBe(true);
    expect(comp.cells.every((c) => c.sourceUrls.some((u) => u.startsWith("http")))).toBe(true);
  });

  it("buildInterrogationContext carries mode:'pattern' (the interrogator judges pattern + efficiency, not first principle)", () => {
    const ctx = buildInterrogationContext(rm, bsCell.id, "traje un accepted")!;
    expect(ctx.mode).toBe("pattern");
    expect(ctx.cellTitle).toMatch(/Binary search/);
  });

  it("graphs/DP RELATE to ITC (conceptual see-also, another nature) — NOT a dedup reference", () => {
    const itcIds = new Set(itc.cells.map((c) => c.id));
    expect(relCell.related!.every((id) => itcIds.has(id))).toBe(true); // resolves to a real ITC cell
    expect(relCell.mission).toBeTruthy(); // it is its OWN cell with its own mission + sources…
    expect(relCell.references ?? []).toEqual([]); // …NOT a references-style dedup
    const content = contentForModule(relCell.id)!;
    expect(content.related.length).toBe(relCell.related!.length); // surfaced as 'related', distinct from 'references'
    expect(content.references.length).toBe(0);
  });

  it("the binary-search cell is the verification target, anchored to USACO + Codeforces (verified 200)", () => {
    expect(bsCell.sourceUrls.some((u) => u.includes("usaco.guide/silver/binary-search"))).toBe(true);
    expect(bsCell.sourceUrls.some((u) => u.includes("codeforces.com/problemset"))).toBe(true);
    expect(rm.modules.find((m) => m.id === bsCell.id)!.kind).toBe("mission");
  });
});
