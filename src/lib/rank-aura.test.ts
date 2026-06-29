import { describe, it, expect } from "vitest";
import { rankAuraVars } from "@/lib/rank-aura";
import { ARCANUM_CONFIG } from "@/core/config";

describe("rankAuraVars", () => {
  it("maps each grade to its aura hex", () => {
    expect(rankAuraVars("Neophyte")["--rank"]).toBe("#8C90A0");
    expect(rankAuraVars("Adeptus Minor")["--rank"]).toBe("#5A4FE0");
    expect(rankAuraVars("Ipsissimus")["--rank"]).toBe("#E3DCF5");
  });

  it("derives soft + glow rgba from the same hex", () => {
    const v = rankAuraVars("Adeptus Minor"); // #5A4FE0 → 90,79,224
    expect(v["--rank-soft"]).toBe("rgba(90, 79, 224, 0.14)");
    expect(v["--rank-glow"]).toBe("rgba(90, 79, 224, 0.40)");
  });

  it("is defined for all 11 grades", () => {
    for (const g of ARCANUM_CONFIG.gradeThresholds) {
      expect(rankAuraVars(g.name)["--rank"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
