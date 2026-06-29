import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDb, type ArcanumDB } from "@/db/schema";
import { appendEvent, getAllEvents, getUnsynced, getPullCursor } from "@/db/repo";
import { push, pull, syncOnce, syncWithRetry, type SyncClient } from "@/sync/sync";
import type { EventRow } from "@/sync/mapping";
import { makeEvent } from "@/core/event";

class FakeClient implements SyncClient {
  store: EventRow[] = [];
  private seq = 0;
  lastUpserted: EventRow[] = [];
  upsertCalls = 0;

  async upsertEvents(rows: EventRow[]): Promise<{ error: unknown }> {
    this.upsertCalls++;
    this.lastUpserted = rows;
    for (const r of rows) {
      if (!this.store.some((x) => x.id === r.id)) {
        this.store.push({ ...r, seq: ++this.seq, user_id: "u1", created_at: "t" });
      }
    }
    return { error: null };
  }

  async fetchSince(cursor: number): Promise<{ data: EventRow[]; error: unknown }> {
    const data = this.store
      .filter((r) => (r.seq ?? 0) > cursor)
      .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
    return { data, error: null };
  }

  // Simulate a server row authored by another device.
  seed(row: EventRow): void {
    this.store.push({ ...row, seq: ++this.seq, user_id: "u1", created_at: "t" });
  }
}

let n = 0;
let db: ArcanumDB;
beforeEach(() => {
  db = createDb(`sync-${++n}`);
});
afterEach(async () => {
  await db.delete();
});

const ev = (id: string) =>
  makeEvent("error.resolved", { insight: id }, { ts: 1000, deviceId: "d", id });

describe("push", () => {
  it("uploads unsynced events without user_id, then marks them synced", async () => {
    await appendEvent(db, ev("a"));
    await appendEvent(db, ev("b"));
    const client = new FakeClient();
    const pushed = await push(db, client);
    expect(pushed).toBe(2);
    expect(client.store.map((r) => r.id).sort()).toEqual(["a", "b"]);
    for (const row of client.lastUpserted) expect("user_id" in row).toBe(false);
    expect(await getUnsynced(db)).toHaveLength(0);
  });
});

describe("pull", () => {
  it("downloads server events into the local log and advances the seq cursor", async () => {
    const client = new FakeClient();
    client.seed({ id: "x", type: "error.resolved", ts: 5, device_id: "other", goal_id: null, module_id: null, payload: { insight: "x" }, v: 1 });
    const pulled = await pull(db, client);
    expect(pulled).toBe(1);
    expect((await getAllEvents(db)).map((e) => e.id)).toEqual(["x"]);
    expect(await getPullCursor(db)).toBe(1);
    expect(await getUnsynced(db)).toHaveLength(0); // pulled rows are already synced
  });
});

describe("syncOnce idempotency", () => {
  it("double sync produces no duplicates locally or remotely", async () => {
    await appendEvent(db, ev("a"));
    const client = new FakeClient();
    await syncOnce(db, client);
    await syncOnce(db, client);
    expect(await getAllEvents(db)).toHaveLength(1);
    expect(client.store).toHaveLength(1);
    expect(client.upsertCalls).toBe(1); // 2nd push had nothing unsynced
  });
});

describe("syncWithRetry backoff", () => {
  it("retries with increasing delays and eventually succeeds", async () => {
    await appendEvent(db, ev("a"));
    let attempts = 0;
    const flaky: SyncClient = {
      async upsertEvents(rows) {
        attempts++;
        if (attempts < 3) throw new Error("network");
        return new FakeClient().upsertEvents(rows);
      },
      async fetchSince() {
        return { data: [], error: null };
      },
    };
    const delays: number[] = [];
    const res = await syncWithRetry(db, flaky, {
      baseMs: 100,
      rand: () => 0,
      sleep: async (ms) => {
        delays.push(ms);
      },
    });
    expect(res.pushed).toBe(1);
    expect(delays).toEqual([100, 200]); // base*2^0, base*2^1 (jitter 0)
  });
});
