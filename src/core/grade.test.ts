import { describe, it, expect } from "vitest";
import { gradeForXp } from "@/core/grade";

describe("gradeForXp (exact boundaries)", () => {
  it("Neophyte from 0 up to 499", () => {
    expect(gradeForXp(0).name).toBe("Neophyte");
    expect(gradeForXp(499).name).toBe("Neophyte");
    expect(gradeForXp(0).index).toBe(0);
  });

  it("steps up exactly at each threshold", () => {
    expect(gradeForXp(500).name).toBe("Zelator");
    expect(gradeForXp(1499).name).toBe("Zelator");
    expect(gradeForXp(1500).name).toBe("Theoricus");
    expect(gradeForXp(3500).name).toBe("Practicus");
    expect(gradeForXp(6999).name).toBe("Practicus");
    expect(gradeForXp(7000).name).toBe("Philosophus");
    expect(gradeForXp(12999).name).toBe("Philosophus");
    expect(gradeForXp(13000).name).toBe("Adeptus Minor");
  });

  it("tops out at Ipsissimus with null nextXp", () => {
    expect(gradeForXp(159999).name).toBe("Magus");
    const ip = gradeForXp(160000);
    expect(ip.name).toBe("Ipsissimus");
    expect(ip.index).toBe(10);
    expect(ip.nextXp).toBeNull();
  });

  it("reports floor + next thresholds", () => {
    const z = gradeForXp(700);
    expect(z.name).toBe("Zelator");
    expect(z.floorXp).toBe(500);
    expect(z.nextXp).toBe(1500);
  });
});
