import type { ArcanumDB } from "@/db/schema";
import {
  getUnsynced,
  markSynced,
  getPullCursor,
  setPullCursor,
  appendEvent,
} from "@/db/repo";
import { toRow, fromRow, type EventRow } from "@/sync/mapping";

/** Minimal Supabase surface the sync uses — injectable so tests run offline. */
export interface SyncClient {
  upsertEvents(rows: EventRow[]): Promise<{ error: unknown }>;
  fetchSince(cursor: number): Promise<{ data: EventRow[]; error: unknown }>;
}

/** Push local unsynced events. Idempotent (server upsert ignores dup ids). */
export async function push(db: ArcanumDB, client: SyncClient): Promise<number> {
  const unsynced = await getUnsynced(db);
  if (unsynced.length === 0) return 0;
  const { error } = await client.upsertEvents(unsynced.map(toRow));
  if (error) throw error;
  await markSynced(db, unsynced.map((e) => e.id));
  return unsynced.length;
}

/** Pull events newer than the server-seq cursor; idempotent put by id. */
export async function pull(db: ArcanumDB, client: SyncClient): Promise<number> {
  const cursor = await getPullCursor(db);
  const { data, error } = await client.fetchSince(cursor);
  if (error) throw error;
  if (data.length === 0) return 0;
  let maxSeq = cursor;
  for (const row of data) {
    await appendEvent(db, fromRow(row), 1); // already on the server → synced
    if (typeof row.seq === "number" && row.seq > maxSeq) maxSeq = row.seq;
  }
  await setPullCursor(db, maxSeq);
  return data.length;
}

export interface SyncCounts {
  pushed: number;
  pulled: number;
}

export async function syncOnce(db: ArcanumDB, client: SyncClient): Promise<SyncCounts> {
  const pushed = await push(db, client);
  const pulled = await pull(db, client);
  return { pushed, pulled };
}

export interface BackoffOptions {
  retries?: number;
  baseMs?: number;
  sleep?: (ms: number) => Promise<void>;
  rand?: () => number;
}

/** syncOnce with exponential backoff + jitter on failure. */
export async function syncWithRetry(
  db: ArcanumDB,
  client: SyncClient,
  opts: BackoffOptions = {},
): Promise<SyncCounts> {
  const retries = opts.retries ?? 3;
  const baseMs = opts.baseMs ?? 200;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const rand = opts.rand ?? Math.random;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await syncOnce(db, client);
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await sleep(baseMs * 2 ** attempt + Math.floor(rand() * baseMs));
      }
    }
  }
  throw lastErr;
}
