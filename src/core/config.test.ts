import { describe, it, expect } from "vitest";
import { ARCANUM_CONFIG } from "@/core/config";

describe("ARCANUM_CONFIG", () => {
  it("has 11 ascending AUCTORUM grades Scintilla..Origo with full identity", () => {
    const g = ARCANUM_CONFIG.gradeThresholds;
    expect(g).toHaveLength(11);
    expect(g[0]!.name).toBe("Scintilla");
    expect(g[0]!.xp).toBe(0);
    expect(g[10]!.name).toBe("Origo");
    expect(g[10]!.xp).toBe(160000);
    for (let i = 1; i < g.length; i++) {
      expect(g[i]!.xp).toBeGreaterThan(g[i - 1]!.xp);
    }
    // each grade carries epithet, latin seal, color, ceremony phrase
    for (const grade of g) {
      expect(grade.epithet.length).toBeGreaterThan(0);
      expect(grade.seal.length).toBeGreaterThan(0);
      expect(grade.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(grade.phrase.length).toBeGreaterThan(0);
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

  it("mastery + streak + tz + grade ramp present", () => {
    expect(ARCANUM_CONFIG.mastery).toMatchObject({ S0: 1, reviewThreshold: 0.8 });
    expect(ARCANUM_CONFIG.streak).toMatchObject({ shieldEvery: 7, shieldMax: 2 });
    expect(ARCANUM_CONFIG.tz).toBe("America/Monterrey");
    const g = ARCANUM_CONFIG.gradeThresholds;
    expect(g[0]!.color).toBe("#9A93C8"); // Scintilla
    expect(g[10]!.color).toBe("#F2E4FF"); // Origo
  });
});
