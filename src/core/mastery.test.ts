import { describe, it, expect } from "vitest";
import { bonusFor, dueDaysFor, initialMastery, reinforce, retrievability } from "@/core/mastery";

describe("mastery decay (spec §6.4)", () => {
  it("dueDaysFor inverts r=threshold (clock-free)", () => {
    expect(dueDaysFor(1, 0, 0.8)).toBeCloseTo(0.22314, 5);
    expect(dueDaysFor(1.85, 2, 0.8)).toBeCloseTo(2 + 1.85 * 0.22314, 4);
  });

  it("bonusFor = 0.5 + 0.5*quality, clamped", () => {
    expect(bonusFor(0.7)).toBeCloseTo(0.85, 10);
    expect(bonusFor(1)).toBeCloseTo(1.0, 10);
    expect(bonusFor(0)).toBeCloseTo(0.5, 10);
    expect(bonusFor(5)).toBeCloseTo(1.0, 10); // clamped
  });

  it("reinforce grows S by (1+bonus) and resets last/due", () => {
    const m = reinforce({ S: 1, lastDays: 0 }, 0.7, 2);
    expect(m.S).toBeCloseTo(1.85, 10);
    expect(m.lastDays).toBe(2);
    expect(m.dueDays).toBeCloseTo(2 + 1.85 * 0.22314, 4);
  });

  it("quality 1 doubles S", () => {
    expect(reinforce({ S: 1, lastDays: 0 }, 1, 0).S).toBeCloseTo(2, 10);
    expect(reinforce({ S: 3, lastDays: 0 }, 1, 0).S).toBeCloseTo(6, 10);
  });

  it("initialMastery uses S0 and start time", () => {
    const m = initialMastery(10);
    expect(m.S).toBe(1);
    expect(m.lastDays).toBe(10);
    expect(m.dueDays).toBeCloseTo(10 + 0.22314, 5);
  });

  it("retrievability is 1 at the reinforcement instant and decays", () => {
    expect(retrievability(1, 0, 0)).toBeCloseTo(1, 10);
    expect(retrievability(1, 5, 5)).toBeCloseTo(1, 10);
    expect(retrievability(1, 0, 1)).toBeCloseTo(Math.exp(-1), 10);
  });
});
