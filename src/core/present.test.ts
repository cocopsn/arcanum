import { describe, it, expect } from "vitest";
import { present } from "@/core/present";
import { project } from "@/core/projector";
import { makeEvent } from "@/core/event";

const DAY = (i: number) => Date.UTC(2026, 5, 28 + i, 15, 0, 0); // consecutive Monterrey days
const DAYS = 86_400_000;
const dev = (ts: number) => ({ ts, deviceId: "d" });

describe("present — retrievability (r(now))", () => {
  it("computes r(now) = exp(-(now-last)/S) per module", () => {
    const rm = project([
      makeEvent("module.upserted", { title: "EDD", prereqs: [], kind: "core" }, { ...dev(DAY(0)), moduleId: "m1" }),
      makeEvent("module.started", {}, { ...dev(DAY(0)), moduleId: "m1" }),
    ]);
    // half a day after start, S=1 → r = exp(-0.5)
    const vm = present(rm, DAY(0) + 0.5 * DAYS);
    expect(vm.modules[0]!.retrievability).toBeCloseTo(Math.exp(-0.5), 6);
  });
});

describe("present — review queue (overdue only, sorted)", () => {
  const completed = project([
    makeEvent("module.upserted", { title: "EDD", prereqs: [], kind: "core" }, { ...dev(DAY(0)), moduleId: "m1" }),
    makeEvent("module.started", {}, { ...dev(DAY(0)), moduleId: "m1" }),
    makeEvent("module.completed", {}, { ...dev(DAY(0)), moduleId: "m1" }),
  ]);

  it("excludes modules not yet due", () => {
    expect(present(completed, DAY(0)).reviewQueue).toHaveLength(0);
  });

  it("includes modules past their dueDays", () => {
    const vm = present(completed, DAY(0) + 1 * DAYS);
    expect(vm.reviewQueue).toHaveLength(1);
    expect(vm.reviewQueue[0]!.moduleId).toBe("m1");
  });
});

describe("present — streak alive (now-dependent)", () => {
  it("alive on the last qualified day", () => {
    const rm = project([makeEvent("error.resolved", { insight: "x" }, dev(DAY(0)))]);
    expect(present(rm, DAY(0)).streakAlive).toBe(true);
  });

  it("broken the next day with no shields", () => {
    const rm = project([makeEvent("error.resolved", { insight: "x" }, dev(DAY(0)))]);
    expect(present(rm, DAY(1)).streakAlive).toBe(false);
  });

  it("a shield keeps it alive across one missed day", () => {
    // 7 qualified days → shields 1, last qualified = DAY(6)
    const rm = project(Array.from({ length: 7 }, (_, i) => makeEvent("error.resolved", { insight: String(i) }, dev(DAY(i)))));
    expect(rm.stats.shields).toBe(1);
    expect(present(rm, DAY(7)).streakAlive).toBe(true); // 1 day later, 1 shield
    expect(present(rm, DAY(8)).streakAlive).toBe(false); // 2 days later, 1 shield
  });
});

describe("present — rito del día", () => {
  const rm = project([makeEvent("error.resolved", { insight: "x" }, dev(DAY(0)))]);

  it("done when today already qualified", () => {
    const vm = present(rm, DAY(0) + 3 * 3_600_000);
    expect(vm.todayQualified).toBe(true);
    expect(vm.ritoPending).toBe(false);
  });

  it("pending on a fresh day", () => {
    const vm = present(rm, DAY(1));
    expect(vm.todayQualified).toBe(false);
    expect(vm.ritoPending).toBe(true);
  });
});

describe("present — purity", () => {
  it("does not mutate the read-model; varies only with now", () => {
    const rm = project([makeEvent("error.resolved", { insight: "x" }, dev(DAY(0)))]);
    const snapshot = JSON.stringify(rm);
    const a = present(rm, DAY(0));
    const b = present(rm, DAY(2));
    expect(JSON.stringify(rm)).toBe(snapshot);
    expect(a.streakAlive).not.toBe(b.streakAlive);
  });
});
