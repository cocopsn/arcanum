import { describe, it, expect } from "vitest";
import { ARCANUM_CONFIG } from "@/core/config";

describe("ARCANUM_CONFIG", () => {
  it("has 11 ascending grade thresholds Neophyte..Ipsissimus", () => {
    const g = ARCANUM_CONFIG.gradeThresholds;
    expect(g).toHaveLength(11);
    expect(g[0]!).toEqual({ name: "Neophyte", xp: 0 });
    expect(g[10]!).toEqual({ name: "Ipsissimus", xp: 160000 });
    for (let i = 1; i < g.length; i++) {
      expect(g[i]!.xp).toBeGreaterThan(g[i - 1]!.xp);
    }
  });

  it("xp constants per spec §6.1", () => {
    const x = ARCANUM_CONFIG.xp;
    expect(x.errorResolved).toBe(25);
    expect(x.sessionMin).toBe(10);
    expect(x.checkpoint).toBe(50);
    expect(x.moduleCompleted).toBe(150);
    expect(x.firetestMax).toBe(300);
    expect(x.note).toBe(5);
    expect(x.noteMinLen).toBe(140);
    expect(x.sessionMinMs).toBe(1_500_000);
    expect(x.streakMultPerDay).toBe(0.02);
    expect(x.streakMultCap).toBe(30);
  });

  it("mastery + streak + tz + rankAura present and complete", () => {
    expect(ARCANUM_CONFIG.mastery).toMatchObject({ S0: 1, reviewThreshold: 0.8 });
    expect(ARCANUM_CONFIG.streak).toMatchObject({ shieldEvery: 7, shieldMax: 2 });
    expect(ARCANUM_CONFIG.tz).toBe("America/Monterrey");
    expect(ARCANUM_CONFIG.rankAura.Neophyte).toBe("#9A93C8");
    expect(ARCANUM_CONFIG.rankAura.Ipsissimus).toBe("#F2E4FF");
    expect(Object.keys(ARCANUM_CONFIG.rankAura)).toHaveLength(11);
  });
});
