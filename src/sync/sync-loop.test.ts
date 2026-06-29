import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDb, type ArcanumDB } from "@/db/schema";
import { createArcanumStore } from "@/store/arcanum-store";
import type { SyncClient } from "@/sync/sync";
import type { EventRow } from "@/sync/mapping";
import { makeEvent } from "@/core/event";
import { SEED_EVENTS, SEED_MODULE_ID } from "@/lib/seed";

/** One in-memory server shared by two devices' sync clients. */
class FakeServer {
  rows: EventRow[] = [];
  private seq = 0;
  client(): SyncClient {
    return {
      upsertEvents: async (rows) => {
        for (const r of rows) {
          if (!this.rows.some((x) => x.id === r.id)) {
            this.rows.push({ ...r, seq: ++this.seq, user_id: "u1", created_at: "t" });
          }
        }
        return { error: null };
      },
      fetchSince: async (cursor) => ({
        data: this.rows.filter((r) => (r.seq ?? 0) > cursor).sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0)),
        error: null,
      }),
    };
  }
}

const NOW = Date.UTC(2026, 5, 28, 18, 0, 0);
let n = 0;
let dbA: ArcanumDB;
let dbB: ArcanumDB;

beforeEach(() => {
  dbA = createDb(`loopA-${++n}`);
  dbB = createDb(`loopB-${n}`);
});
afterEach(async () => {
  await dbA.delete();
  await dbB.delete();
});

describe("sync loop — two devices", () => {
  it("event on A appears on B after sync, with deterministic re-fold on both", async () => {
    const server = new FakeServer();
    const A = createArcanumStore(dbA);
    const B = createArcanumStore(dbB);
    await A.getState().hydrate(NOW);
    await B.getState().hydrate(NOW);
    await A.getState().setAuth("me@arcanum.test");
    await B.getState().setAuth("me@arcanum.test");

    // share the day-0 seed (fixed UUIDs → idempotent across devices)
    await A.getState().sync(server.client(), NOW);
    await B.getState().sync(server.client(), NOW);

    // dispatch a real learning event on device A
    const ev = makeEvent("error.resolved", { insight: "amortized doubling" }, { ts: NOW, deviceId: "A" });
    await A.getState().dispatch(ev, NOW);
    expect(A.getState().pendingCount).toBe(1);

    await A.getState().sync(server.client(), NOW); // push
    expect(A.getState().syncState).toBe("synced");
    expect(A.getState().pendingCount).toBe(0);

    await B.getState().sync(server.client(), NOW); // pull

    // B now holds the event AND derives an identical read-model (deterministic re-fold)
    expect(B.getState().readModel.stats.totalXp).toBe(26); // round(25 * 1.02)
    expect(B.getState().readModel.stats.totalXp).toBe(A.getState().readModel.stats.totalXp);
    expect(B.getState().readModel).toEqual(A.getState().readModel);
    expect(B.getState().syncState).toBe("synced");
  });

  it("is idempotent — repeated syncs add nothing and keep the read-model stable", async () => {
    const server = new FakeServer();
    const A = createArcanumStore(dbA);
    await A.getState().hydrate(NOW);
    await A.getState().setAuth("me@arcanum.test");
    await A.getState().sync(server.client(), NOW);
    const before = A.getState().readModel;
    await A.getState().sync(server.client(), NOW);
    await A.getState().sync(server.client(), NOW);
    expect(A.getState().readModel).toEqual(before);
    expect(server.rows).toHaveLength(SEED_EVENTS.length); // only the seed events
  });

  it("a grade is celebrated exactly ONCE in the universe — the other device never re-fires", async () => {
    const server = new FakeServer();
    const A = createArcanumStore(dbA);
    const B = createArcanumStore(dbB);
    await A.getState().hydrate(NOW);
    await B.getState().hydrate(NOW);
    await A.getState().setAuth("me@arcanum.test");
    await B.getState().setAuth("me@arcanum.test");
    await A.getState().sync(server.client(), NOW);
    await B.getState().sync(server.client(), NOW);

    // A crosses 500 XP → Faber, celebrates locally (and records grade.celebrated)
    const ft = (ts: number) => makeEvent("firetest.attempted", { reached: 10, ceiling: 10 }, { ts, deviceId: "A", moduleId: SEED_MODULE_ID });
    await A.getState().dispatch(ft(NOW), NOW);
    await A.getState().dispatch(ft(NOW + 1), NOW + 1);
    expect(A.getState().readModel.stats.grade).toBe("Faber");
    expect(A.getState().ceremonyQueue.map((g) => g.name)).toEqual(["Faber"]);

    await A.getState().sync(server.client(), NOW); // push XP + grade.celebrated
    await B.getState().sync(server.client(), NOW); // B pulls them

    // B reaches Faber by XP too, but the synced grade.celebrated means it does NOT
    // re-fire the ceremony — celebrated once across the whole universe.
    expect(B.getState().readModel.stats.grade).toBe("Faber");
    expect(B.getState().readModel.celebratedGrade).toBe(1);
    expect(B.getState().ceremonyQueue).toHaveLength(0);
    expect(B.getState().readModel).toEqual(A.getState().readModel);
  });

  it("sync is a no-op without a session (stays local)", async () => {
    const server = new FakeServer();
    const A = createArcanumStore(dbA);
    await A.getState().hydrate(NOW);
    await A.getState().sync(server.client(), NOW); // authEmail null → returns early
    expect(A.getState().syncState).toBe("local");
    expect(server.rows).toHaveLength(0);
  });
});
