import type { ArcanumEvent } from "@/core/event";
import type { ReadModel } from "@/core/read-model";
import type { ArcanumDB, StoredEvent } from "@/db/schema";

function stripStored(e: StoredEvent): ArcanumEvent {
  const { synced: _synced, ...envelope } = e;
  return envelope;
}

/** Append (idempotent by id — put). New local events start unsynced. */
export async function appendEvent(
  db: ArcanumDB,
  event: ArcanumEvent,
  synced: 0 | 1 = 0,
): Promise<void> {
  await db.events.put({ ...event, synced });
}

export async function appendEvents(
  db: ArcanumDB,
  events: ArcanumEvent[],
  synced: 0 | 1 = 0,
): Promise<void> {
  await db.events.bulkPut(events.map((e) => ({ ...e, synced })));
}

export async function getAllEvents(db: ArcanumDB): Promise<ArcanumEvent[]> {
  return (await db.events.toArray()).map(stripStored);
}

export async function getUnsynced(db: ArcanumDB): Promise<ArcanumEvent[]> {
  return (await db.events.where("synced").equals(0).toArray()).map(stripStored);
}

export async function markSynced(db: ArcanumDB, ids: string[]): Promise<void> {
  await db.transaction("rw", db.events, async () => {
    for (const id of ids) await db.events.update(id, { synced: 1 });
  });
}

export async function saveReadModel(db: ArcanumDB, model: ReadModel): Promise<void> {
  await db.projection.put({ key: "current", model });
}

export async function loadReadModel(db: ArcanumDB): Promise<ReadModel | null> {
  return (await db.projection.get("current"))?.model ?? null;
}

export async function getPullCursor(db: ArcanumDB): Promise<number> {
  return (await db.sync_meta.get("sync"))?.pullCursor ?? 0;
}

export async function setPullCursor(db: ArcanumDB, cursor: number): Promise<void> {
  await db.sync_meta.put({ key: "sync", pullCursor: cursor });
}

/** Highest grade index already celebrated; null if never set (first run baseline). */
export async function getAckGrade(db: ArcanumDB): Promise<number | null> {
  const row = await db.sync_meta.get("grade_ack");
  return row?.ackGrade ?? null;
}

export async function setAckGrade(db: ArcanumDB, ackGrade: number): Promise<void> {
  await db.sync_meta.put({ key: "grade_ack", ackGrade });
}
