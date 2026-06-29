import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDb, type ArcanumDB } from "@/db/schema";
import {
  appendEvent,
  appendEvents,
  getAllEvents,
  getUnsynced,
  markSynced,
  saveReadModel,
  loadReadModel,
  getPullCursor,
  setPullCursor,
} from "@/db/repo";
import { makeEvent } from "@/core/event";
import { project } from "@/core/projector";

let n = 0;
let db: ArcanumDB;

beforeEach(() => {
  db = createDb(`test-${++n}`);
});
afterEach(async () => {
  await db.delete();
});

const ev = (id: string) =>
  makeEvent("error.resolved", { insight: id }, { ts: 1000, deviceId: "d", id });

describe("repo — events", () => {
  it("appends and reads back; put is idempotent by id", async () => {
    await appendEvent(db, ev("a"));
    await appendEvent(db, ev("a")); // same id → no dup
    await appendEvent(db, ev("b"));
    const all = await getAllEvents(db);
    expect(all).toHaveLength(2);
    expect(all.map((e) => e.id).sort()).toEqual(["a", "b"]);
    // stored shape is the clean envelope (no `synced`)
    expect(all[0]).not.toHaveProperty("synced");
  });

  it("tracks synced flag: getUnsynced + markSynced", async () => {
    await appendEvents(db, [ev("a"), ev("b"), ev("c")]);
    expect((await getUnsynced(db)).map((e) => e.id).sort()).toEqual(["a", "b", "c"]);
    await markSynced(db, ["a", "b"]);
    expect((await getUnsynced(db)).map((e) => e.id)).toEqual(["c"]);
  });
});

describe("repo — projection cache", () => {
  it("round-trips the read-model", async () => {
    const model = project([ev("a")]);
    await saveReadModel(db, model);
    expect(await loadReadModel(db)).toEqual(model);
  });

  it("returns null before any projection saved", async () => {
    expect(await loadReadModel(db)).toBeNull();
  });
});

describe("repo — sync meta", () => {
  it("round-trips the pull cursor (default 0)", async () => {
    expect(await getPullCursor(db)).toBe(0);
    await setPullCursor(db, 42);
    expect(await getPullCursor(db)).toBe(42);
  });
});
