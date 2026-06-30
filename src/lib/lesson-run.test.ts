import { describe, it, expect } from "vitest";
import { initRun, reduceRun, type LessonRun } from "@/lib/lesson-run";

const start = (total = 3, hearts = 3) => initRun(total, hearts);

describe("lesson-run — init", () => {
  it("opens on the first step in 'answering' with full hearts", () => {
    const r = start(3, 3);
    expect([r.total, r.current, r.hearts, r.maxHearts, r.phase, r.insights, r.round]).toEqual([3, 0, 3, 3, "answering", 0, 1]);
  });
  it("clamps hearts to at least 1 and a 0-step lesson opens already passed", () => {
    expect(initRun(0, 0).phase).toBe("passed");
    expect(initRun(2, 0).hearts).toBe(1);
  });
});

describe("lesson-run — the happy path (advance step by step)", () => {
  it("a understood answer advances to the next step (sound: advance)", () => {
    const { next, effects } = reduceRun(start(3), { type: "graded", understood: true });
    expect(next.current).toBe(1);
    expect(next.phase).toBe("answering");
    expect(effects).toEqual(["advance"]);
  });

  it("clearing the LAST step passes the lesson (checkpoint.passed)", () => {
    let r = start(2);
    r = reduceRun(r, { type: "graded", understood: true }).next; // step 0 → 1
    const { next, effects } = reduceRun(r, { type: "graded", understood: true }); // step 1 (last) → passed
    expect(next.phase).toBe("passed");
    expect(next.current).toBe(2);
    expect(effects).toEqual(["passLesson"]);
  });
});

describe("lesson-run — amor fati (miss → correction → resolve → continue)", () => {
  it("a missed answer spends a heart AND enters correction", () => {
    const { next, effects } = reduceRun(start(3, 3), { type: "graded", understood: false });
    expect(next.hearts).toBe(2);
    expect(next.phase).toBe("correcting");
    expect(next.current).toBe(0); // SAME step — you don't skip the error
    expect(effects).toEqual(["loseHeart", "enterCorrection"]);
  });

  it("a landed correction banks an insight (error.resolved) and continues — heart already paid, not refunded", () => {
    let r = reduceRun(start(3, 3), { type: "graded", understood: false }).next; // hearts 2, correcting, step 0
    const { next, effects } = reduceRun(r, { type: "corrected", understood: true });
    expect(next.insights).toBe(1);
    expect(next.hearts).toBe(2); // the heart spent on the miss stays spent
    expect(next.current).toBe(1); // advanced past the corrected step
    expect(next.phase).toBe("answering");
    expect(effects).toEqual(["resolveInsight", "advance"]);
  });

  it("a correction on the LAST step resolves the insight AND passes the lesson", () => {
    let r = start(1, 3); // single step
    r = reduceRun(r, { type: "graded", understood: false }).next; // correcting on the only step
    const { next, effects } = reduceRun(r, { type: "corrected", understood: true });
    expect(next.phase).toBe("passed");
    expect(next.insights).toBe(1);
    expect(effects).toEqual(["resolveInsight", "passLesson"]);
  });

  it("a failed correction costs another heart but STAYS in correction (no escape, no insight)", () => {
    let r = reduceRun(start(3, 3), { type: "graded", understood: false }).next; // hearts 2, correcting
    const { next, effects } = reduceRun(r, { type: "corrected", understood: false });
    expect(next.hearts).toBe(1);
    expect(next.phase).toBe("correcting");
    expect(next.insights).toBe(0);
    expect(effects).toEqual(["loseHeart"]); // no enterCorrection (already there), no resolveInsight
  });
});

describe("lesson-run — total failure is another turn, not a wall", () => {
  it("spending the last heart fails the attempt", () => {
    let r = start(3, 1); // one heart
    const { next, effects } = reduceRun(r, { type: "graded", understood: false });
    expect(next.hearts).toBe(0);
    expect(next.phase).toBe("failed");
    expect(effects).toEqual(["loseHeart", "failLesson"]);
  });

  it("losing the last heart DURING a correction also fails", () => {
    let r = start(3, 2);
    r = reduceRun(r, { type: "graded", understood: false }).next; // hearts 1, correcting
    const { next, effects } = reduceRun(r, { type: "corrected", understood: false }); // hearts 0
    expect(next.phase).toBe("failed");
    expect(effects).toEqual(["loseHeart", "failLesson"]);
  });

  it("restart resets to step 0 with fresh hearts (== maxHearts) and bumps the round (the second turn)", () => {
    let r = start(3, 3);
    r = reduceRun(r, { type: "graded", understood: false }).next; // hearts 2, correcting
    r = reduceRun(r, { type: "corrected", understood: false }).next; // hearts 1, correcting
    r = reduceRun(r, { type: "corrected", understood: false }).next; // hearts 0, failed (round 1)
    expect(r.phase).toBe("failed");
    const { next, effects } = reduceRun(r, { type: "restart" });
    expect([next.current, next.hearts, next.maxHearts, next.phase, next.insights, next.round]).toEqual([0, 3, 3, "answering", 0, 2]);
    expect(effects).toEqual(["restart"]);
  });
});

describe("lesson-run — phase guards (inputs out of phase are no-ops)", () => {
  it("ignores a 'corrected' while answering", () => {
    const r = start(3);
    expect(reduceRun(r, { type: "corrected", understood: true })).toEqual({ next: r, effects: [] });
  });
  it("ignores a 'graded' while correcting", () => {
    const r = reduceRun(start(3, 3), { type: "graded", understood: false }).next; // correcting
    expect(reduceRun(r, { type: "graded", understood: true })).toEqual({ next: r, effects: [] });
  });
  it("ignores a 'restart' unless failed, and any input once passed", () => {
    const r = start(3);
    expect(reduceRun(r, { type: "restart" }).effects).toEqual([]);
    let passedRun: LessonRun = start(1);
    passedRun = reduceRun(passedRun, { type: "graded", understood: true }).next; // passed
    expect(reduceRun(passedRun, { type: "graded", understood: true }).effects).toEqual([]);
  });
});
