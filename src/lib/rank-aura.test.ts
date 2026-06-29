import { describe, it, expect } from "vitest";
import { rankAuraVars } from "@/lib/rank-aura";
import { ARCANUM_CONFIG } from "@/core/config";

describe("rankAuraVars", () => {
  it("maps each grade to its ramp hex (spark → source)", () => {
    expect(rankAuraVars("Scintilla")["--rank"]).toBe("#9A93C8");
    expect(rankAuraVars("Faber")["--rank"]).toBe("#A79FD0");
    expect(rankAuraVars("Origo")["--rank"]).toBe("#F2E4FF");
  });

  it("derives soft + glow rgba from the same hex", () => {
    const v = rankAuraVars("Faber"); // #A79FD0 → 167,159,208
    expect(v["--rank-soft"]).toBe("rgba(167, 159, 208, 0.14)");
    expect(v["--rank-glow"]).toBe("rgba(167, 159, 208, 0.40)");
  });

  it("is defined for all 11 grades", () => {
    for (const g of ARCANUM_CONFIG.gradeThresholds) {
      expect(rankAuraVars(g.name)["--rank"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
