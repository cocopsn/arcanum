import { describe, it, expect } from "vitest";
import { rankAuraVars } from "@/lib/rank-aura";
import { ARCANUM_CONFIG } from "@/core/config";

describe("rankAuraVars", () => {
  it("maps each grade to its aura hex (arcane-purple ramp)", () => {
    expect(rankAuraVars("Neophyte")["--rank"]).toBe("#9A93C8");
    expect(rankAuraVars("Adeptus Minor")["--rank"]).toBe("#A452F2");
    expect(rankAuraVars("Ipsissimus")["--rank"]).toBe("#F2E4FF");
  });

  it("derives soft + glow rgba from the same hex", () => {
    const v = rankAuraVars("Adeptus Minor"); // #A452F2 → 164,82,242
    expect(v["--rank-soft"]).toBe("rgba(164, 82, 242, 0.14)");
    expect(v["--rank-glow"]).toBe("rgba(164, 82, 242, 0.40)");
  });

  it("is defined for all 11 grades", () => {
    for (const g of ARCANUM_CONFIG.gradeThresholds) {
      expect(rankAuraVars(g.name)["--rank"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
