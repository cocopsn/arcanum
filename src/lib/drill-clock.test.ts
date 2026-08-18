import { describe, it, expect } from "vitest";
import { formatClock, clockVerdict } from "@/lib/drill-clock";

// DRILL CLOCK — the pure half of the timed-drill feature (the OA is a timed exam; a stated
// "meta: 25 min" without a real measurement would be dead text). The clock MEASURES, it never
// judges mastery: the verdict is an honest within/over statement about elapsed vs the target.

describe("formatClock — stopwatch mm:ss (h:mm:ss past the hour)", () => {
  it("formats seconds with zero-pad, minutes without", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(5_000)).toBe("0:05");
    expect(formatClock(65_000)).toBe("1:05");
    expect(formatClock(600_000)).toBe("10:00");
    expect(formatClock(25 * 60_000 + 7_000)).toBe("25:07");
  });

  it("rolls into h:mm:ss past the hour", () => {
    expect(formatClock(3_600_000)).toBe("1:00:00");
    expect(formatClock(3_600_000 + 62_000)).toBe("1:01:02");
  });

  it("clamps negatives and truncates sub-second noise (never a fake negative clock)", () => {
    expect(formatClock(-1)).toBe("0:00");
    expect(formatClock(999)).toBe("0:00");
    expect(formatClock(1_001)).toBe("0:01");
  });
});

describe("clockVerdict — elapsed vs the exercise's declared target", () => {
  it("within the target: exact labels, no over label", () => {
    const v = clockVerdict(12 * 60_000 + 40_000, 25);
    expect(v.within).toBe(true);
    expect(v.elapsedLabel).toBe("12:40");
    expect(v.targetLabel).toBe("25:00");
    expect(v.overLabel).toBeNull();
  });

  it("exactly on the target counts as within (the meta is a ceiling, inclusive)", () => {
    const v = clockVerdict(25 * 60_000, 25);
    expect(v.within).toBe(true);
    expect(v.overLabel).toBeNull();
  });

  it("over the target: honest overBy label", () => {
    const v = clockVerdict(28 * 60_000 + 30_000, 25);
    expect(v.within).toBe(false);
    expect(v.overLabel).toBe("3:30");
  });
});
