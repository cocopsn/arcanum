import { describe, it, expect } from "vitest";
import { gradeForXp, gradeByIndex, gradesBetween, GRADES } from "@/core/grade";

describe("gradeForXp (AUCTORUM ladder, exact boundaries)", () => {
  it("Scintilla from 0 up to 499", () => {
    expect(gradeForXp(0).name).toBe("Scintilla");
    expect(gradeForXp(499).name).toBe("Scintilla");
    expect(gradeForXp(0).index).toBe(0);
  });

  it("steps up exactly at each threshold", () => {
    expect(gradeForXp(500).name).toBe("Faber");
    expect(gradeForXp(1499).name).toBe("Faber");
    expect(gradeForXp(1500).name).toBe("Artifex");
    expect(gradeForXp(3500).name).toBe("Dux");
    expect(gradeForXp(7000).name).toBe("Fundator");
    expect(gradeForXp(35999).name).toBe("Princeps");
    expect(gradeForXp(36000).name).toBe("Auctor");
  });

  it("tops out at Origo with null nextXp", () => {
    expect(gradeForXp(159999).name).toBe("Aeternus");
    const origo = gradeForXp(160000);
    expect(origo.name).toBe("Origo");
    expect(origo.index).toBe(10);
    expect(origo.nextXp).toBeNull();
  });

  it("carries identity: epithet, latin seal, color, ceremony phrase", () => {
    const faber = gradeForXp(800);
    expect(faber.name).toBe("Faber");
    expect(faber.epithet).toBe("el que forja a golpes");
    expect(faber.seal).toBe("Per ictus");
    expect(faber.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(faber.phrase).toContain("golpe");
    expect(faber.floorXp).toBe(500);
    expect(faber.nextXp).toBe(1500);
  });

  it("never decreases: thresholds strictly ascending → grade is monotonic in XP", () => {
    for (let i = 1; i < GRADES.length; i++) {
      expect(GRADES[i]!.xp).toBeGreaterThan(GRADES[i - 1]!.xp);
    }
    let prev = -1;
    for (const xp of [0, 250, 500, 6999, 7000, 90000, 160000, 999999]) {
      const idx = gradeForXp(xp).index;
      expect(idx).toBeGreaterThanOrEqual(prev);
      prev = idx;
    }
  });

  it("gradeByIndex clamps; gradesBetween lists the ascensions", () => {
    expect(gradeByIndex(-3).name).toBe("Scintilla");
    expect(gradeByIndex(99).name).toBe("Origo");
    expect(gradesBetween(0, 2).map((g) => g.name)).toEqual(["Faber", "Artifex"]);
    expect(gradesBetween(3, 3)).toEqual([]);
  });
});
