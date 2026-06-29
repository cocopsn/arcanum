import { describe, it, expect } from "vitest";
import { gradeSigil } from "@/lib/grade-sigil";
import { GRADES } from "@/core/grade";

describe("gradeSigil", () => {
  it("produces a distinct, non-empty geometry per grade (not one shape recolored)", () => {
    const cores = GRADES.map((_, i) => gradeSigil(i).paths[0]!);
    expect(new Set(cores).size).toBe(GRADES.length); // 11 distinct core stars
    for (const c of cores) expect(c.length).toBeGreaterThan(0);
  });

  it("escalates: point count grows and higher grades accrue rings/rays", () => {
    expect(gradeSigil(0).points).toBe(3); // spark
    expect(gradeSigil(10).points).toBe(13); // source
    expect(gradeSigil(0).paths.length).toBeLessThan(gradeSigil(10).paths.length);
  });

  it("is deterministic", () => {
    expect(gradeSigil(4)).toEqual(gradeSigil(4));
  });
});
