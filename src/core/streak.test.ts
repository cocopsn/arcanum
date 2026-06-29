import { describe, it, expect } from "vitest";
import { streakTimeline, streakAsOfDay } from "@/core/streak";

describe("streakTimeline (spec §6.3 pin-down cases)", () => {
  it("consecutive days build the streak", () => {
    const r = streakTimeline([0, 1, 2]);
    expect(r.closedStreakByDay.get(0)).toBe(1);
    expect(r.closedStreakByDay.get(1)).toBe(2);
    expect(r.closedStreakByDay.get(2)).toBe(3);
    expect(r.state.current).toBe(3);
    expect(r.state.longest).toBe(3);
    expect(r.state.shields).toBe(0);
  });

  it("earns a shield at 7 qualified days", () => {
    const r = streakTimeline([0, 1, 2, 3, 4, 5, 6]);
    expect(r.state.current).toBe(7);
    expect(r.state.shields).toBe(1);
  });

  it("absorbs a 1-day gap with a shield, without inflating the streak", () => {
    // 7 days (shield=1), then a 1-day gap (ord 7 missed), then ord 8
    const r = streakTimeline([0, 1, 2, 3, 4, 5, 6, 8]);
    expect(r.state.current).toBe(8); // day 8 increments; the gap day does NOT
    expect(r.state.shields).toBe(0); // shield consumed
    expect(r.state.longest).toBe(8);
  });

  it("breaks when gap exceeds shields (resets current/shields/qdCount)", () => {
    // 7 days (shield=1), then 3-day gap (ords 7,8,9 missed) → 3 > 1 → break
    const r = streakTimeline([0, 1, 2, 3, 4, 5, 6, 10]);
    expect(r.state.current).toBe(1); // fresh streak from day 10
    expect(r.state.shields).toBe(0);
    expect(r.state.qdCount).toBe(1);
    expect(r.state.longest).toBe(7); // record preserved
  });

  it("drops over-cap shield grants (max 2)", () => {
    // 21 consecutive days: grants at 7 and 14 → shields 2; grant at 21 dropped
    const r = streakTimeline(Array.from({ length: 21 }, (_, i) => i));
    expect(r.state.current).toBe(21);
    expect(r.state.shields).toBe(2);
  });

  it("resets the 7-counter on break (next shield needs 7 fresh days)", () => {
    // 7 days (shield at day6), big gap break, then 7 fresh days (days 20..26)
    const r = streakTimeline([0, 1, 2, 3, 4, 5, 6, 20, 21, 22, 23, 24, 25, 26]);
    // After break at day20, qdCount restarts; shield earned only at day26 (7th fresh)
    expect(r.state.current).toBe(7);
    expect(r.state.shields).toBe(1);
    expect(r.state.longest).toBe(7);
  });
});

describe("streakAsOfDay", () => {
  it("returns the day's closed streak for a qualified day", () => {
    const r = streakTimeline([0, 1, 2]);
    expect(streakAsOfDay(r, 1)).toBe(2);
    expect(streakAsOfDay(r, 2)).toBe(3);
  });

  it("returns 0 before the first qualified day", () => {
    const r = streakTimeline([5, 6]);
    expect(streakAsOfDay(r, 4)).toBe(0);
  });

  it("carries the streak onto a later non-qualified day within shield budget", () => {
    const r = streakTimeline([0, 1, 2, 3, 4, 5, 6]); // shields 1 after day 6
    expect(streakAsOfDay(r, 7)).toBe(7); // 1 day later, 1 shield → carried
    expect(streakAsOfDay(r, 8)).toBe(0); // 2 days later, only 1 shield → broken
  });

  it("breaks onto a non-qualified day when no shields", () => {
    const r = streakTimeline([0, 1, 2]); // shields 0
    expect(streakAsOfDay(r, 3)).toBe(0);
  });
});
