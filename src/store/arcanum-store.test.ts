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
});
