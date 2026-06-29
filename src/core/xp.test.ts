import { describe, it, expect } from "vitest";
import { xpBase, streakMultiplier } from "@/core/xp";
import { makeEvent } from "@/core/event";

const opts = { ts: 1000, deviceId: "d" };

describe("xpBase (unrounded)", () => {
  it("error.resolved → 25", () => {
    expect(xpBase(makeEvent("error.resolved", { insight: "x" }, opts))).toBe(25);
  });

  it("checkpoint.passed → 50 for both kinds", () => {
    expect(xpBase(makeEvent("checkpoint.passed", { score: 0.9 }, opts))).toBe(50);
    expect(
      xpBase(makeEvent("checkpoint.passed", { score: 0.9, kind: "project", quality: 0.8 }, opts)),
    ).toBe(50);
  });

  it("module.completed → 150", () => {
    expect(xpBase(makeEvent("module.completed", {}, opts))).toBe(150);
  });

  it("session.ended ≥25min and kind≠review → 10; review or short → 0", () => {
    expect(xpBase(makeEvent("session.ended", { duration_ms: 1_500_000 }, opts))).toBe(10);
    expect(
      xpBase(makeEvent("session.ended", { duration_ms: 1_500_000, kind: "review" }, opts)),
    ).toBe(0);
    expect(xpBase(makeEvent("session.ended", { duration_ms: 1_499_999 }, opts))).toBe(0);
  });

  it("firetest.attempted → reached/ceiling*300 UNROUNDED; ceiling≤0 → 0", () => {
    expect(xpBase(makeEvent("firetest.attempted", { reached: 6, ceiling: 10 }, opts))).toBe(180);
    expect(xpBase(makeEvent("firetest.attempted", { reached: 5, ceiling: 0 }, opts))).toBe(0);
    // clamps reached to ceiling
    expect(xpBase(makeEvent("firetest.attempted", { reached: 20, ceiling: 10 }, opts))).toBe(300);
    // floors negative reached at 0 — malformed jsonb must NOT subtract XP
    expect(xpBase(makeEvent("firetest.attempted", { reached: -5, ceiling: 10 }, opts))).toBe(0);
  });

  it("note.created pays only when substantive (markdown length ≥ 140)", () => {
    expect(xpBase(makeEvent("note.created", { note_id: "n", title: "t", markdown: "x".repeat(140) }, opts))).toBe(5);
    expect(xpBase(makeEvent("note.created", { note_id: "n", title: "t", markdown: "x".repeat(139) }, opts))).toBe(0);
  });

  it("error.logged and non-XP events → 0", () => {
    expect(xpBase(makeEvent("error.logged", { description: "wall" }, opts))).toBe(0);
    expect(xpBase(makeEvent("module.started", {}, opts))).toBe(0);
  });

  it("tolerates malformed payloads without producing NaN (jsonb robustness)", () => {
    expect(xpBase(makeEvent("firetest.attempted", {}, opts))).toBe(0);
    expect(xpBase(makeEvent("note.created", {}, opts))).toBe(0);
    expect(Number.isFinite(xpBase(makeEvent("session.ended", {}, opts)))).toBe(true);
  });
});

describe("streakMultiplier", () => {
  it("1 at streak 0; +60% capped at 30", () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(10)).toBeCloseTo(1.2, 10);
    expect(streakMultiplier(30)).toBeCloseTo(1.6, 10);
    expect(streakMultiplier(45)).toBeCloseTo(1.6, 10);
  });
});
