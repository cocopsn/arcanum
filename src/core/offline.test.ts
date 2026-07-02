import { describe, it, expect } from "vitest";
import { project } from "@/core/projector";
import { syncOnce, type SyncClient } from "@/sync/sync";
import { createDb } from "@/db/schema";
import { appendEvent, getAllEvents } from "@/db/repo";
import { makeEvent } from "@/core/event";
import { SEED_EVENTS } from "@/lib/seed";

// OFFLINE AUDIT (part 1): prove the TRUNK is fully derived from the LOCAL log with no network, and
// that a failed sync (network down) is non-destructive. The projector touches no fetch/network — it
// folds events from IndexedDB — so the map/grade/streak/mastery/notes are inherently offline-capable.

describe("OFFLINE — the trunk works with the network DOWN", () => {
  it("the whole trunk (goals, map, edges, grade, streak, mastery, notes) derives from the local log alone", () => {
    const rm = project(SEED_EVENTS);
    expect(rm.goals.length).toBeGreaterThan(0); // the worlds
    expect(rm.modules.length).toBeGreaterThan(0); // the map cells
    expect(rm.edges.length).toBeGreaterThan(0); // the DAG
    expect(rm.stats.grade).toBeTruthy(); // grade
    expect(typeof rm.stats.currentStreak).toBe("number"); // streak
    expect(rm.modules.every((m) => typeof m.S === "number" && typeof m.reinforceCount === "number")).toBe(true); // mastery + angle state
    expect(Array.isArray(rm.notes)).toBe(true); // notes graph
    expect(Array.isArray(rm.pendingAi)).toBe(true); // the offline AI queue is part of the derived model
  });

  it("a failed sync (network down) throws but leaves the LOCAL log intact — nothing is lost offline", async () => {
    const db = createDb(`offline-${Math.random().toString(36).slice(2)}`);
    await appendEvent(db, makeEvent("checkpoint.passed", { score: 0.9, kind: "checkpoint" }, { ts: 1, deviceId: "d" }));
    const before = await getAllEvents(db);
    const offline: SyncClient = {
      upsertEvents: async () => {
        throw new Error("offline");
      },
      fetchSince: async () => {
        throw new Error("offline");
      },
    };
    await expect(syncOnce(db, offline)).rejects.toThrow(/offline/);
    expect(await getAllEvents(db)).toEqual(before); // the event stays; a sync failure never corrupts local state
    await db.delete();
  });
});
