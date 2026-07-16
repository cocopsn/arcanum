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
    expect(rm.stats.grade).toBe("Scintilla");
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

  it("strictly-newer day with firetest + node.moved: incremental == rebuild", () => {
    const base = [
      makeEvent("module.upserted", { title: "EDD", prereqs: [], kind: "core" }, { ...dev(DAY1_A), goalId: "g1", moduleId: "m1" }),
      makeEvent("firetest.attempted", { reached: 8, ceiling: 10 }, { ...dev(DAY1_A), moduleId: "m1" }),
    ];
    const prev = project(base);
    const next = [
      makeEvent("firetest.attempted", { reached: 3, ceiling: 10 }, { ...dev(DAY2), moduleId: "m1" }), // lower ratio
      makeEvent("roadmap.node.moved", { ref: "m1", x: 42, y: 99 }, dev(DAY2)),
    ];
    const all = [...base, ...next];
    const spy = vi.fn(project);
    const res = applyEvents(prev, next, all, { fullProject: spy });
    expect(res.rebuilt).toBe(false);
    expect(spy).toHaveBeenCalledTimes(0);
    expect(res.model).toEqual(project(all));
    const m = res.model.modules.find((x) => x.id === "m1")!;
    expect(m.firetestRatio).toBe(0.8); // best ratio wins incrementally, not overwritten by 0.3
    expect([m.x, m.y]).toEqual([42, 99]);
  });
});

describe("project — Phase 3 roadmap invariants", () => {
  it("re-upsert without goal_id preserves the prior goal association", () => {
    const events = [
      makeEvent("module.upserted", { title: "EDD", prereqs: [], kind: "core" }, { ...dev(DAY1_A), goalId: "g1", moduleId: "m1" }),
      makeEvent("module.upserted", { title: "EDD v2", prereqs: [], kind: "core" }, { ...dev(DAY2), moduleId: "m1" }), // goal_id omitted
    ];
    const m = project(events).modules.find((x) => x.id === "m1")!;
    expect(m.title).toBe("EDD v2");
    expect(m.goalId).toBe("g1");
  });

  it("a cycle-creating edge (incl. self-loop) never materializes — DAG enforced on every fold", () => {
    const events = [
      makeEvent("module.upserted", { title: "A", prereqs: [], kind: "core" }, { ...dev(DAY1_A), moduleId: "a" }),
      makeEvent("module.upserted", { title: "B", prereqs: [], kind: "core" }, { ...dev(DAY1_A), moduleId: "b" }),
      makeEvent("roadmap.edge.upserted", { from: "a", to: "b" }, dev(DAY1_A)),
      makeEvent("roadmap.edge.upserted", { from: "b", to: "a" }, dev(DAY2)), // would close a→b→a
      makeEvent("roadmap.edge.upserted", { from: "a", to: "a" }, dev(DAY2)), // self-loop
    ];
    // edges now carry a DERIVED pathId (null here — these cells declare no path)
    expect(project(events).edges).toEqual([{ from: "a", to: "b", pathId: null }]);
  });
});

describe("project — Phase 4 Canvas obligations", () => {
  const O = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    course: "C",
    title: `T-${id}`,
    due_ts: null,
    status: "pending",
    ...over,
  });
  const snap = (ts: number, ok: boolean, obs: unknown[]) =>
    makeEvent("canvas.synced", { fetched_ts: ts, ok, obligations: obs } as unknown as ArcanumEvent["payload"], dev(ts));

  it("an ok snapshot projects obligations + canvas health", () => {
    const rm = project([snap(DAY1_A, true, [O("a"), O("b", { due_ts: 123, status: "graded" })])]);
    expect(rm.obligations.map((o) => o.id).sort()).toEqual(["a", "b"]);
    expect(rm.canvas).toEqual({ lastSyncTs: DAY1_A, lastOkTs: DAY1_A, cookieStale: false });
    const b = rm.obligations.find((o) => o.id === "b")!;
    expect([b.dueTs, b.status, b.source, b.fetchedTs]).toEqual([123, "graded", "canvas", DAY1_A]);
    // a null due date must stay null — NOT become 0 (Number(null)===0 → false "overdue")
    expect(rm.obligations.find((o) => o.id === "a")!.dueTs).toBeNull();
  });

  it("a failed scrape (cookie expired) keeps the last good data and flags stale — failure is normal", () => {
    const rm = project([snap(DAY1_A, true, [O("a")]), snap(DAY2, false, [])]);
    expect(rm.obligations.map((o) => o.id)).toEqual(["a"]); // last GOOD set survives
    expect(rm.canvas).toEqual({ lastSyncTs: DAY2, lastOkTs: DAY1_A, cookieStale: true });
  });

  it("a later ok scrape replaces the set and clears stale", () => {
    const rm = project([snap(DAY1_A, true, [O("a")]), snap(DAY2, true, [O("c"), O("d")])]);
    expect(rm.obligations.map((o) => o.id).sort()).toEqual(["c", "d"]);
    expect(rm.canvas).toEqual({ lastSyncTs: DAY2, lastOkTs: DAY2, cookieStale: false });
  });

  it("ascending an obligation (module.upserted w/ sourceObligationId) marks it promoted — derived + idempotent", () => {
    const events = [
      snap(DAY1_A, true, [O("a"), O("b")]),
      makeEvent("goal.upserted", { title: "G", priority: 1, color: "#fff", sigil: "s" }, { ...dev(DAY1_A), goalId: "g" }),
      makeEvent("module.upserted", { title: "T-a", prereqs: [], kind: "core", sourceObligationId: "a" }, { ...dev(DAY2), goalId: "g", moduleId: "m1" }),
    ];
    const rm = project(events);
    expect(rm.obligations.find((o) => o.id === "a")!.promotedModuleId).toBe("m1");
    expect(rm.obligations.find((o) => o.id === "b")!.promotedModuleId).toBeNull();
    expect(rm.modules.find((m) => m.id === "m1")!.sourceObligationId).toBe("a"); // real module, linked
    expect(project(events)).toEqual(rm); // idempotent under re-fold
  });

  it("archiving the ascended module un-marks the obligation as promoted", () => {
    const events = [
      snap(DAY1_A, true, [O("a")]),
      makeEvent("module.upserted", { title: "T-a", prereqs: [], kind: "core", sourceObligationId: "a" }, { ...dev(DAY1_A), moduleId: "m1" }),
      makeEvent("node.archived", { ref: "m1" }, dev(DAY2)),
    ];
    expect(project(events).obligations.find((o) => o.id === "a")!.promotedModuleId).toBeNull();
  });

  it("drops malformed rows and ignores a snapshot with non-finite fetched_ts", () => {
    const rm = project([snap(DAY1_A, true, [O("a"), { id: "", title: "x" }, { id: "b", title: "" }, null])]);
    expect(rm.obligations.map((o) => o.id)).toEqual(["a"]);
    const bad = makeEvent("canvas.synced", { fetched_ts: "nope", ok: true, obligations: [O("z")] } as unknown as ArcanumEvent["payload"], dev(DAY2));
    const rm2 = project([snap(DAY1_A, true, [O("a")]), bad]);
    expect(rm2.obligations.map((o) => o.id)).toEqual(["a"]); // junk snapshot ignored
    expect(rm2.canvas.lastSyncTs).toBe(DAY1_A); // not advanced by junk
  });

  it("incremental == rebuild for canvas.synced (newer day)", () => {
    const base = [snap(DAY1_A, true, [O("a")])];
    const prev = project(base);
    const next = [snap(DAY2, true, [O("a"), O("b")])];
    const all = [...base, ...next];
    const spyP = vi.fn(project);
    const res = applyEvents(prev, next, all, { fullProject: spyP });
    expect(res.rebuilt).toBe(false);
    expect(spyP).toHaveBeenCalledTimes(0);
    expect(res.model).toEqual(project(all));
    expect(res.model.obligations.map((o) => o.id).sort()).toEqual(["a", "b"]);
  });

  it("module.evaluated folds the latest evaluation per module (last wins), auditable", () => {
    const events = [
      makeEvent("module.upserted", { title: "M", prereqs: [], kind: "core" }, { ...dev(DAY1_A), moduleId: "m1" }),
      makeEvent("module.evaluated", { summary: "v1", strengths: ["a"], gaps: ["b"], challenge: "c", score: 0.4, source: "heuristic", provider: null }, { ...dev(DAY1_A), moduleId: "m1" }),
      makeEvent("module.evaluated", { summary: "v2", strengths: ["x"], gaps: [], challenge: "deriva", score: 0.8, source: "ai", provider: "openai" }, { ...dev(DAY2), moduleId: "m1" }),
    ];
    const rm = project(events);
    expect(rm.evaluations).toHaveLength(1);
    const ev = rm.evaluations[0]!;
    expect([ev.summary, ev.score, ev.source, ev.provider]).toEqual(["v2", 0.8, "ai", "openai"]);
    expect(project(events)).toEqual(rm); // idempotent under re-fold
  });

  it("gate.evaluated: a PASS opens the cell's gate (monotonic) and reveals the next cell", () => {
    const base = [
      makeEvent("module.upserted", { title: "Cell A", prereqs: [], kind: "cell" }, { ...dev(DAY1_A), goalId: "g", moduleId: "a" }),
      makeEvent("module.upserted", { title: "Cell B", prereqs: [], kind: "cell" }, { ...dev(DAY1_A), goalId: "g", moduleId: "b" }),
      makeEvent("roadmap.edge.upserted", { from: "a", to: "b" }, dev(DAY1_A)),
    ];
    // before: B is sealed (A not mastered)
    const before = project(base);
    const byId0 = new Map(before.modules.map((m) => [m.id, m]));
    expect(byId0.get("a")!.gatePassed).toBe(false);

    const passed = [
      ...base,
      makeEvent("gate.evaluated", { passed: true, score: 0.9, summary: "ok", feedback: "defendible", source: "ai", provider: "openai" }, { ...dev(DAY2), moduleId: "a" }),
    ];
    const rm = project(passed);
    const a = rm.modules.find((m) => m.id === "a")!;
    expect(a.gatePassed).toBe(true);
    expect(rm.gates).toHaveLength(1);
    expect(rm.gates[0]!.passed).toBe(true);

    // a later FAIL does NOT re-seal what was demonstrated (monotonic)
    const thenFail = [
      ...passed,
      makeEvent("gate.evaluated", { passed: false, score: 0.2, summary: "x", feedback: "y", source: "heuristic", provider: null }, { ...dev(DAY2 + 1000), moduleId: "a" }),
    ];
    const rm2 = project(thenFail);
    expect(rm2.modules.find((m) => m.id === "a")!.gatePassed).toBe(true); // still open
    expect(rm2.gates[0]!.passed).toBe(false); // but the latest verdict is the fail
    expect(project(thenFail)).toEqual(rm2); // idempotent
  });

  it("mission.submitted folds the LATEST evidence per cell (last wins), auditable + idempotent", () => {
    const events = [
      makeEvent("module.upserted", { title: "Mission", prereqs: [], kind: "mission" }, { ...dev(DAY1_A), goalId: "g", moduleId: "m1" }),
      makeEvent("mission.submitted", { notes: "primer intento" }, { ...dev(DAY1_A), moduleId: "m1" }),
      makeEvent("mission.submitted", { notes: "evidencia más completa, segundo intento" }, { ...dev(DAY2), moduleId: "m1" }),
    ];
    const rm = project(events);
    expect(rm.missions).toHaveLength(1);
    expect(rm.missions[0]!.notes).toBe("evidencia más completa, segundo intento");
    expect(project(events)).toEqual(rm); // idempotent under re-fold
  });

  it("reviewDue (Capa C) is fed by a gate-passed mission, not only by completed modules", () => {
    const events = [
      makeEvent("module.upserted", { title: "Mission", prereqs: [], kind: "mission" }, { ...dev(DAY1_A), goalId: "g", moduleId: "m1" }),
      makeEvent("gate.evaluated", { passed: true, score: 0.9, summary: "ok", feedback: "f", source: "ai", provider: "openai" }, { ...dev(DAY2), moduleId: "m1" }),
    ];
    const rm = project(events);
    expect(rm.reviewDue.map((r) => r.moduleId)).toContain("m1"); // resurfaces for review as it decays
  });

  it("a heavy mission cell's kind is MONOTONIC — a later upsert(kind:'cell') can't demote it (fail-closed)", () => {
    const events = [
      makeEvent("module.upserted", { title: "Mission", prereqs: [], kind: "mission" }, { ...dev(DAY1_A), goalId: "g", moduleId: "m1" }),
      makeEvent("module.completed", {}, { ...dev(DAY2), moduleId: "m1" }),
      // a stray / out-of-band / synced re-upsert tries to demote the heavy cell to a plain cell
      makeEvent("module.upserted", { title: "Mission", prereqs: [], kind: "cell" }, { ...dev(DAY2 + 1000), goalId: "g", moduleId: "m1" }),
    ];
    const rm = project(events);
    const m = rm.modules.find((x) => x.id === "m1")!;
    expect(m.kind).toBe("mission"); // demotion refused → the gate cannot be dissolved by a non-interrogation event
    expect(m.status).toBe("completed");
    expect(m.gatePassed).toBe(false); // completed but never interrogated
    expect(project(events)).toEqual(rm); // idempotent under re-fold
  });

  it("gate.evaluated carries the interrogator's generated questions into the gate read-model", () => {
    const events = [
      makeEvent("module.upserted", { title: "Mission", prereqs: [], kind: "mission" }, { ...dev(DAY1_A), goalId: "g", moduleId: "m1" }),
      makeEvent(
        "gate.evaluated",
        { passed: true, score: 0.9, summary: "ok", feedback: "f", questions: ["¿por qué desborda un int?", "¿qué hace clang?"], source: "ai", provider: "openai" },
        { ...dev(DAY2), moduleId: "m1" },
      ),
    ];
    const rm = project(events);
    expect(rm.gates[0]!.questions).toEqual(["¿por qué desborda un int?", "¿qué hace clang?"]);
    // a pre-authored justify-gate (no questions field) folds to an empty array, not undefined
    const plain = project([
      makeEvent("module.upserted", { title: "Cell", prereqs: [], kind: "cell" }, { ...dev(DAY1_A), goalId: "g", moduleId: "c1" }),
      makeEvent("gate.evaluated", { passed: false, score: 0.2, summary: "x", feedback: "y", source: "heuristic", provider: null }, { ...dev(DAY2), moduleId: "c1" }),
    ]);
    expect(plain.gates[0]!.questions).toEqual([]);
  });

  it("celebratedGrade derives the max acknowledged grade from the log; null when none", () => {
    expect(project([]).celebratedGrade).toBeNull();
    const rm = project([
      makeEvent("grade.celebrated", { index: 1 }, dev(DAY1_A)),
      makeEvent("grade.celebrated", { index: 3 }, dev(DAY2)),
      makeEvent("grade.celebrated", { index: 2 }, dev(DAY2)), // out-of-order index → max still wins
    ]);
    expect(rm.celebratedGrade).toBe(3);
  });
});

describe("reinforceCount — advances the lesson angle so course/depth/review never repeat", () => {
  const mk = (mid: string) => makeEvent("module.upserted", { title: "M", prereqs: [], kind: "core" }, { ...dev(DAY0), goalId: "g", moduleId: mid });
  it("increments on checkpoint.passed but NOT on error.resolved (mid-lesson fix ≠ a new lesson)", () => {
    const rm = project([
      mk("m"),
      makeEvent("error.resolved", { insight: "x" }, { ...dev(DAY1_A), moduleId: "m" }),
      makeEvent("checkpoint.passed", { score: 0.9, kind: "checkpoint" }, { ...dev(DAY1_B), moduleId: "m" }),
      makeEvent("checkpoint.passed", { score: 0.8, kind: "checkpoint" }, { ...dev(DAY2), moduleId: "m" }),
    ]);
    expect(rm.modules.find((x) => x.id === "m")!.reinforceCount).toBe(2);
  });
  it("a fresh module starts at 0 (the first lesson takes the first-principle angle)", () => {
    expect(project([mk("m2")]).modules.find((x) => x.id === "m2")!.reinforceCount).toBe(0);
  });
});
