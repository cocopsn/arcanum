import { describe, it, expect } from "vitest";
import { project, applyEvents } from "@/core/projector";
import { makeEvent } from "@/core/event";

const dev = (ts: number) => ({ ts, deviceId: "d" });
const T = 1_000_000;
const mk = (mid: string) => makeEvent("module.upserted", { title: "M", prereqs: [], kind: "core" }, { ...dev(T), goalId: "g", moduleId: mid });
const queued = (qid: string, ts: number, input: Record<string, string> = {}) =>
  makeEvent("ai.queued", { queueId: qid, kind: "gate", input }, { ...dev(ts), goalId: "g", moduleId: "m" });
const verdict = (qid: string | undefined, passed: boolean, ts: number) =>
  makeEvent("gate.evaluated", { passed, score: passed ? 0.9 : 0.1, summary: "", feedback: "", source: "ai", provider: "openai", ...(qid ? { queueId: qid } : {}) }, { ...dev(ts), moduleId: "m" });

describe("AI pending queue — offline, event-sourced, ZERO placebo", () => {
  it("ai.queued enqueues the work but NEVER opens the gate", () => {
    const rm = project([mk("m"), queued("q1", T + 1, { justification: "mi porqué" })]);
    expect(rm.pendingAi).toHaveLength(1);
    expect(rm.pendingAi[0]).toMatchObject({ queueId: "q1", kind: "gate", moduleId: "m", input: { justification: "mi porqué" } });
    expect(rm.modules.find((x) => x.id === "m")!.gatePassed).toBe(false); // the CRITICAL invariant
  });

  it("a REAL verdict (gate.evaluated w/ queueId, passed) resolves the pending AND opens the gate", () => {
    const rm = project([mk("m"), queued("q1", T + 1), verdict("q1", true, T + 2)]);
    expect(rm.pendingAi).toHaveLength(0);
    expect(rm.modules.find((x) => x.id === "m")!.gatePassed).toBe(true);
  });

  it("a FAIL verdict resolves the pending but does NOT open the gate (real adversarial eval, just deferred)", () => {
    const rm = project([mk("m"), queued("q1", T + 1), verdict("q1", false, T + 2)]);
    expect(rm.pendingAi).toHaveLength(0);
    expect(rm.modules.find((x) => x.id === "m")!.gatePassed).toBe(false);
  });

  it("idempotent: a duplicate ai.queued stays ONE pending; a duplicate resolution stays resolved once", () => {
    const q = queued("q1", T + 1);
    const r = verdict("q1", true, T + 2);
    expect(project([mk("m"), q, q]).pendingAi).toHaveLength(1);
    const twice = project([mk("m"), q, r, r]);
    expect(twice.pendingAi).toHaveLength(0);
    expect(twice.modules.find((x) => x.id === "m")!.gatePassed).toBe(true);
    expect(project([mk("m"), q, r])).toEqual(twice); // re-fold + dup resolution = same state
  });

  it("permutation-invariant (resolves regardless of fold order)", () => {
    const q = queued("q1", T + 1);
    const r = verdict("q1", true, T + 2);
    expect(project([r, mk("m"), q])).toEqual(project([mk("m"), q, r]));
  });

  it("INCREMENTAL fold (accFromModel): a later-day verdict resolves the carried pending", () => {
    const DAY = 86_400_000;
    const m0 = mk("m");
    const q0 = queued("q1", T + 1);
    const prev = project([m0, q0]);
    expect(prev.pendingAi).toHaveLength(1);
    const v = verdict("q1", true, T + 2 * DAY); // a later civil day → true incremental path (not full rebuild)
    const all = [m0, q0, v];
    const next = applyEvents(prev, [v], all).model;
    expect(next.pendingAi).toHaveLength(0);
    expect(next.modules.find((x) => x.id === "m")!.gatePassed).toBe(true);
    expect(next.pendingAi).toEqual(project(all).pendingAi); // incremental == full re-fold
  });

  it("an unrelated verdict (no queueId) leaves the pending untouched", () => {
    const rm = project([mk("m"), queued("q1", T + 1), verdict(undefined, true, T + 2)]);
    expect(rm.pendingAi).toHaveLength(1); // not resolved — this verdict wasn't for the queued item
  });
});
