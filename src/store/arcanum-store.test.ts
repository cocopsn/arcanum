import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDb, type ArcanumDB } from "@/db/schema";
import { createArcanumStore, type ArcanumStore } from "@/store/arcanum-store";
import { getAllEvents } from "@/db/repo";
import { project } from "@/core/projector";
import { makeEvent } from "@/core/event";
import { SEED_MODULE_ID } from "@/lib/seed";

const NOW = Date.UTC(2026, 5, 28, 18, 0, 0); // Monterrey 2026-06-28

let n = 0;
let db: ArcanumDB;
let store: ArcanumStore;

beforeEach(() => {
  db = createDb(`store-${++n}`);
  store = createArcanumStore(db);
});
afterEach(async () => {
  await db.delete();
});

describe("arcanum store", () => {
  it("hydrate seeds day-0 and goes ready", async () => {
    await store.getState().hydrate(NOW);
    const s = store.getState();
    expect(s.status).toBe("ready");
    expect(s.readModel.goals[0]!.title).toBe("ITC");
    expect(s.readModel.stats.totalXp).toBe(0);
    expect(s.viewModel.ritoPending).toBe(true); // nothing done today
  });

  it("dispatch appends an event and derives new XP", async () => {
    await store.getState().hydrate(NOW);
    const ev = makeEvent("error.resolved", { insight: "got it" }, { ts: NOW, deviceId: "d", moduleId: SEED_MODULE_ID });
    await store.getState().dispatch(ev, NOW);
    const s = store.getState();
    expect(s.readModel.stats.totalXp).toBe(26); // round(25 * 1.02)
    expect(s.readModel.stats.currentStreak).toBe(1);
    expect(s.viewModel.todayQualified).toBe(true);
    expect(s.viewModel.ritoPending).toBe(false);
  });

  it("dispatch result equals a full rebuild", async () => {
    await store.getState().hydrate(NOW);
    await store.getState().dispatch(makeEvent("error.resolved", { insight: "x" }, { ts: NOW, deviceId: "d" }), NOW);
    const incremental = store.getState().readModel;
    await store.getState().rebuild(NOW);
    expect(store.getState().readModel).toEqual(incremental);
    expect(incremental).toEqual(project(await getAllEvents(db)));
  });

  it("refreshPresent updates the now-dependent view only", async () => {
    await store.getState().hydrate(NOW);
    await store.getState().dispatch(makeEvent("error.resolved", { insight: "x" }, { ts: NOW, deviceId: "d" }), NOW);
    expect(store.getState().viewModel.streakAlive).toBe(true);
    const rmBefore = store.getState().readModel;
    store.getState().refreshPresent(Date.UTC(2026, 5, 30, 18, 0, 0)); // 2 days later
    expect(store.getState().viewModel.streakAlive).toBe(false); // gap > shields
    expect(store.getState().readModel).toBe(rmBefore); // read-model untouched
  });

  it("crossing a grade threshold fires the ceremony exactly once (idempotent under re-fold)", async () => {
    await store.getState().hydrate(NOW);
    expect(store.getState().readModel.stats.grade).toBe("Scintilla");
    expect(store.getState().ceremonyQueue).toHaveLength(0);

    // two fire tests = 600 XP (non-qualifying day → mult 1.0) → crosses 500 → Faber
    const ft = (ts: number) =>
      makeEvent("firetest.attempted", { reached: 10, ceiling: 10 }, { ts, deviceId: "d", moduleId: SEED_MODULE_ID });
    await store.getState().dispatch(ft(NOW), NOW);
    await store.getState().dispatch(ft(NOW + 1), NOW + 1);

    expect(store.getState().readModel.stats.totalXp).toBe(600);
    expect(store.getState().readModel.stats.grade).toBe("Faber");
    expect(store.getState().ceremonyQueue.map((g) => g.name)).toEqual(["Faber"]);

    // re-fold must NOT replay the ceremony
    await store.getState().rebuild(NOW);
    expect(store.getState().ceremonyQueue.map((g) => g.name)).toEqual(["Faber"]);

    // dismiss → queue empties and stays empty across re-fold
    store.getState().dismissCeremony();
    expect(store.getState().ceremonyQueue).toHaveLength(0);
    await store.getState().rebuild(NOW);
    expect(store.getState().ceremonyQueue).toHaveLength(0);
  });

  it("grade never decreases as XP accumulates", async () => {
    await store.getState().hydrate(NOW);
    let prev = store.getState().readModel.stats.gradeIndex;
    for (let i = 0; i < 5; i++) {
      await store.getState().dispatch(makeEvent("checkpoint.passed", { score: 1 }, { ts: NOW + i, deviceId: "d", moduleId: SEED_MODULE_ID }), NOW + i);
      const idx = store.getState().readModel.stats.gradeIndex;
      expect(idx).toBeGreaterThanOrEqual(prev);
      prev = idx;
    }
  });
});
