import { describe, it, expect, vi } from "vitest";
import { project, applyEvents } from "@/core/projector";
import { makeEvent, type ArcanumEvent } from "@/core/event";

const DAY0 = Date.UTC(2026, 5, 27, 15, 0, 0); // Monterrey 2026-06-27
const DAY1_A = Date.UTC(2026, 5, 28, 15, 0, 0); // Monterrey 2026-06-28 09:00
const DAY1_B = Date.UTC(2026, 5, 28, 20, 0, 0); // Monterrey 2026-06-28 14:00 (same day)
const DAY2 = Date.UTC(2026, 5, 29, 15, 0, 0); // Monterrey 2026-06-29

const dev = (ts: number) => ({ ts, deviceId: "d" });

describe("project — empty + domain", () => {
  it("empty log → zeroed read-model, Neophyte", () => {
    const rm = project([]);
    expect(rm.stats.totalXp).toBe(0);
    expect(rm.stats.grade).toBe("Neophyte");
    expect(rm.stats.currentStreak).toBe(0);
    expect(rm.goals).toEqual([]);
    expect(rm.modules).toEqual([]);
    expect(rm.cursor).toBeNull();
  });

  it("upserts goals and modules with status from started/completed", () => {
    const events: ArcanumEvent[] = [
      makeEvent(
        "goal.upserted",
        { title: "ITC", priority: 1, color: "#25B0C9", sigil: "itc" },
        { ...dev(DAY1_A), goalId: "g1" },
      ),
      makeEvent(
        "module.upserted",
        { title: "EDD", prereqs: [], kind: "core" },
        { ...dev(DAY1_A), goalId: "g1", moduleId: "m1" },
      ),
      makeEvent("module.started", {}, { ...dev(DAY1_A), goalId: "g1", moduleId: "m1" }),
    ];
    const rm = project(events);
    expect(rm.goals).toHaveLength(1);
    expect(rm.goals[0]!.title).toBe("ITC");
    expect(rm.modules).toHaveLength(1);
    expect(rm.modules[0]!.status).toBe("started");
    expect(rm.modules[0]!.startedDays).not.toBeNull();
  });
});

describe("project — XP two-phase", () => {
  it("one error.resolved on a qualified day → round(25*1.02) = 26", () => {
    const rm = project([makeEvent("error.resolved", { insight: "x" }, dev(DAY1_A))]);
    expect(rm.stats.totalXp).toBe(26);
    expect(rm.stats.currentStreak).toBe(1);
  });

  it("two error.resolved the SAME civil day share an identical multiplier", () => {
    const events = [
      makeEvent("error.resolved", { insight: "a" }, dev(DAY1_A)),
      makeEvent("error.resolved", { insight: "b" }, dev(DAY1_B)),
    ];
    // both see the day's closed streak (1) → round(25*1.02)=26 each
    expect(project(events).stats.totalXp).toBe(52);
  });

  it("is deterministic under input permutation (R5)", () => {
    const events = [
      makeEvent("goal.upserted", { title: "ITC", priority: 1, color: "#25B0C9", sigil: "s" }, { ...dev(DAY1_A), goalId: "g1" }),
      makeEvent("module.upserted", { title: "EDD", prereqs: [], kind: "core" }, { ...dev(DAY1_A), goalId: "g1", moduleId: "m1" }),
      makeEvent("error.resolved", { insight: "x" }, { ...dev(DAY1_B), moduleId: "m1" }),
      makeEvent("checkpoint.passed", { score: 0.8 }, { ...dev(DAY2), moduleId: "m1" }),
    ];
    const shuffled = [events[3]!, events[1]!, events[0]!, events[2]!];
    expect(project(shuffled)).toEqual(project(events));
  });

  it("does not mutate its input", () => {
    const events = [
      makeEvent("error.resolved", { insight: "b" }, dev(DAY2)),
      makeEvent("error.resolved", { insight: "a" }, dev(DAY1_A)),
    ];
    const snapshot = events.map((e) => e.id);
    project(events);
    expect(events.map((e) => e.id)).toEqual(snapshot);
  });
});

describe("project — mastery", () => {
  it("module.started + checkpoint reinforces S and clock-free dueDays", () => {
    const events = [
      makeEvent("module.upserted", { title: "EDD", prereqs: [], kind: "core" }, { ...dev(DAY1_A), moduleId: "m1" }),
      makeEvent("module.started", {}, { ...dev(DAY1_A), moduleId: "m1" }),
      makeEvent("checkpoint.passed", { score: 0.8 }, { ...dev(DAY2), moduleId: "m1" }),
    ];
    const m = project(events).modules[0]!;
    expect(m.S).toBeCloseTo(1.9, 10); // S0=1, bonus 0.5+0.5*0.8=0.9 → 1.9
    const lastDays = DAY2 / 86_400_000;
    expect(m.lastReinforcedDays).toBeCloseTo(lastDays, 8);
    expect(m.dueDays).toBeCloseTo(lastDays + -1.9 * Math.log(0.8), 6);
  });

  it("malformed reinforcing payload does not poison mastery/XP with NaN", () => {
    const events = [
      makeEvent("module.upserted", { title: "EDD", prereqs: [], kind: "core" }, { ...dev(DAY1_A), moduleId: "m1" }),
      makeEvent("module.started", {}, { ...dev(DAY1_A), moduleId: "m1" }),
      makeEvent("checkpoint.passed", {}, { ...dev(DAY2), moduleId: "m1" }), // missing score
    ];
    const rm = project(events);
    expect(Number.isFinite(rm.modules[0]!.S)).toBe(true);
    expect(Number.isFinite(rm.stats.totalXp)).toBe(true);
    // falls back to defaultQuality 0.7 → bonus 0.85 → S = 1.85
    expect(rm.modules[0]!.S).toBeCloseTo(1.85, 10);
  });

  it("completed modules populate reviewDue", () => {
    const events = [
      makeEvent("module.upserted", { title: "EDD", prereqs: [], kind: "core" }, { ...dev(DAY1_A), moduleId: "m1" }),
      makeEvent("module.started", {}, { ...dev(DAY1_A), moduleId: "m1" }),
      makeEvent("module.completed", {}, { ...dev(DAY2), moduleId: "m1" }),
    ];
    const rm = project(events);
    expect(rm.reviewDue).toHaveLength(1);
    expect(rm.reviewDue[0]!.moduleId).toBe("m1");
  });
});

describe("applyEvents — incremental vs rebuild", () => {
  const first = [makeEvent("error.resolved", { insight: "x" }, dev(DAY1_A))];

  it("strictly-newer day: rebuilt=false, fullProject NOT called, equals rebuild", () => {
    const prev = project(first);
    const second = [makeEvent("error.resolved", { insight: "y" }, dev(DAY2))];
    const all = [...first, ...second];
    const spy = vi.fn(project);
    const res = applyEvents(prev, second, all, { fullProject: spy });
    expect(res.rebuilt).toBe(false);
    expect(spy).toHaveBeenCalledTimes(0);
    expect(res.model).toEqual(project(all));
  });

  it("out-of-order event → rebuild, equals full project", () => {
    const prev = project(first);
    const earlier = [makeEvent("error.resolved", { insight: "z" }, dev(DAY0))];
    const all = [...earlier, ...first];
    const spy = vi.fn(project);
    const res = applyEvents(prev, earlier, all, { fullProject: spy });
    expect(res.rebuilt).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(res.model).toEqual(project(all));
  });

  it("same-day-as-cursor batch → rebuild", () => {
    const prev = project(first);
    const sameDay = [makeEvent("error.resolved", { insight: "w" }, dev(DAY1_B))];
    const all = [...first, ...sameDay];
    const res = applyEvents(prev, sameDay, all);
    expect(res.rebuilt).toBe(true);
    expect(res.model).toEqual(project(all));
  });

  it("no new events → prev unchanged", () => {
    const prev = project(first);
    const res = applyEvents(prev, [], first);
    expect(res.rebuilt).toBe(false);
    expect(res.model).toBe(prev);
  });
});
