import { describe, it, expect } from "vitest";
import { foldLast24h, deriveSleepSignals, buildSleepContext } from "@/core/sleep-cycle";
import { makeEvent } from "@/core/event";
import { project } from "@/core/projector";
import { msToDays } from "@/core/time";
import type { ModuleRM, ReadModel } from "@/core/read-model";

const NOW = Date.UTC(2026, 5, 28, 18, 0, 0);
const H = 3_600_000;
const dev = (ts: number) => ({ ts, deviceId: "d" });

describe("foldLast24h", () => {
  it("counts the day's learning acts within the 24h window", () => {
    const events = [
      makeEvent("error.resolved", { insight: "a" }, dev(NOW - 2 * H)),
      makeEvent("error.resolved", { insight: "b" }, dev(NOW - 1 * H)),
      makeEvent("checkpoint.passed", { score: 0.9 }, dev(NOW - 3 * H)),
      makeEvent("module.completed", {}, dev(NOW - 4 * H)),
      makeEvent("session.ended", { duration_ms: 30 * 60000 }, dev(NOW - 5 * H)),
      makeEvent("note.created", { note_id: "n", title: "AVL", markdown: "x" }, dev(NOW - 6 * H)),
    ];
    const d = foldLast24h(events, NOW);
    expect(d.errorsResolved).toBe(2);
    expect(d.checkpointsPassed).toBe(1);
    expect(d.modulesCompleted).toBe(1);
    expect(d.sessionMinutes).toBe(30);
    expect(d.notesCreated).toBe(1);
    expect(d.noteTitles).toEqual(["AVL"]);
  });

  it("excludes events older than 24h", () => {
    const events = [
      makeEvent("error.resolved", { insight: "old" }, dev(NOW - 25 * H)),
      makeEvent("error.resolved", { insight: "recent" }, dev(NOW - 1 * H)),
    ];
    expect(foldLast24h(events, NOW).errorsResolved).toBe(1);
  });

  it("is pure (now is explicit) and deterministic", () => {
    const events = [makeEvent("error.resolved", { insight: "x" }, dev(NOW - H))];
    expect(foldLast24h(events, NOW)).toEqual(foldLast24h(events, NOW));
  });
});

const mod = (id: string, over: Partial<ModuleRM> = {}): ModuleRM => ({
  id,
  goalId: "g",
  title: id,
  status: "idle",
  kind: "core",
  prereqs: [],
  S: 1,
  lastReinforcedDays: 0,
  dueDays: 0,
  startedDays: null,
  archived: false,
  firetestRatio: null,
  x: null,
  y: null,
  sourceObligationId: null,
  gatePassed: false,
  reinforceCount: 0,
  ...over,
});

describe("deriveSleepSignals — actionable decay/risk context", () => {
  const nowDays = msToDays(NOW);
  const base = project([]);
  const rm: ReadModel = {
    ...base,
    modules: [
      mod("rev", { status: "completed", dueDays: nowDays - 2 }),
      mod("stall", { status: "started", lastReinforcedDays: nowDays - 5 }),
      mod("fresh", { status: "started", lastReinforcedDays: nowDays - 1 }), // not stalled (<4d)
      mod("prereq", { status: "completed", dueDays: nowDays + 1, S: 2, lastReinforcedDays: nowDays - 1 }),
      mod("dep", { status: "idle" }),
      mod("safe", { status: "completed", dueDays: nowDays + 30 }), // prereq but far from threshold
      mod("dep2", { status: "idle" }),
    ],
    edges: [
      { from: "prereq", to: "dep" },
      { from: "safe", to: "dep2" },
    ],
    reviewDue: [{ moduleId: "rev", dueDays: nowDays - 2 }],
  };

  it("surfaces overdue reviews with days overdue", () => {
    expect(deriveSleepSignals(rm, NOW).reviewQueue).toEqual([{ moduleId: "rev", title: "rev", daysOverdue: 2 }]);
  });

  it("surfaces started-but-cold modules (stalled ≥ stallDays), freshest excluded", () => {
    const stalled = deriveSleepSignals(rm, NOW).stalled;
    expect(stalled.map((s) => s.moduleId)).toEqual(["stall"]);
    expect(stalled[0]!.daysSinceReinforce).toBe(5);
  });

  it("flags at-risk prereqs crossing the threshold soon that gate unfinished work", () => {
    const atRisk = deriveSleepSignals(rm, NOW).atRisk;
    // 'prereq' crosses in 1d (≤ riskWindow 3) and blocks 'dep'; 'safe' is far (30d) → excluded
    expect(atRisk.map((a) => a.moduleId)).toEqual(["prereq"]);
    expect(atRisk[0]!.daysToThreshold).toBe(1);
    expect(atRisk[0]!.blocks).toEqual(["dep"]);
    expect(atRisk[0]!.retrievability).toBeCloseTo(Math.exp(-0.5), 4);
  });

  it("buildSleepContext composes the 24h fold with the signals", () => {
    const ctx = buildSleepContext([makeEvent("error.resolved", { insight: "x" }, dev(NOW - H))], rm, NOW);
    expect(ctx.digest.errorsResolved).toBe(1);
    expect(ctx.atRisk.map((a) => a.moduleId)).toEqual(["prereq"]);
  });
});
