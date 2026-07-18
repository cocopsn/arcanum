import Dexie, { type Table } from "dexie";

// A SEPARATE Dexie DB for the offline DOWNLOAD cache (the Spotify-style "download for offline"). It is
// NOT the event log — it caches the extracted text of curated Layer-A sources so a downloaded spine
// reads inside Arcanum with the network off. Keeping it apart from the event DB means zero versioning
// risk to the log. This is device-local cache (not synced, not the source of truth) → Date.now() is fine.

export interface OfflineSourceRow {
  /** the source URL (primary key) */
  url: string;
  /** the /api/fetch-source result (mode, title, blocks, …) */
  data: unknown;
  bytes: number;
  ts: number;
}
export interface OfflineSpineRow {
  goalId: string;
  title: string;
  /** how many page sources were cached */
  sourceCount: number;
  /** the EXACT source urls this spine cached — the basis for honest shared-vs-unique accounting and for a
   *  delete that only frees the sources no OTHER downloaded spine still needs. (Legacy rows may lack it →
   *  treated as [] / all-unique until re-downloaded.) */
  urls?: string[];
  bytes: number;
  ts: number;
}

class OfflineDB extends Dexie {
  sources!: Table<OfflineSourceRow, string>;
  spines!: Table<OfflineSpineRow, string>;
  constructor(name = "arcanum-offline") {
    super(name);
    this.version(1).stores({ sources: "url", spines: "goalId" });
  }
}

let _db: OfflineDB | null = null;
function db(): OfflineDB {
  return (_db ??= new OfflineDB());
}

export async function saveOfflineSource(url: string, data: unknown): Promise<number> {
  const bytes = JSON.stringify(data ?? {}).length;
  await db().sources.put({ url, data, bytes, ts: Date.now() });
  return bytes;
}
export async function getOfflineSource(url: string): Promise<unknown | null> {
  try {
    return (await db().sources.get(url))?.data ?? null;
  } catch {
    return null;
  }
}
export async function saveSpineIndex(row: OfflineSpineRow): Promise<void> {
  await db().spines.put(row);
}
export async function listDownloadedSpines(): Promise<OfflineSpineRow[]> {
  try {
    return await db().spines.toArray();
  } catch {
    return [];
  }
}
/** Every cached source's exact byte size, keyed by url — the raw material for the honest inventory. */
export async function sourceBytesByUrl(): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  try {
    for (const s of await db().sources.toArray()) m.set(s.url, s.bytes);
  } catch {
    /* offline / private mode → empty */
  }
  return m;
}

/**
 * Delete a spine download WITHOUT breaking another. A source url is removed ONLY when NO other still-downloaded
 * spine references it (its EXCLUSIVE bytes are freed); a source that a sibling spine still needs is KEPT (its
 * SHARED bytes stay). Returns the real freed vs kept bytes so the UI can show the true space reclaimed — never
 * a phantom number. (Falls back to the spine's own url list; legacy rows without `urls` free only their index.)
 */
export async function deleteSpineDownloadSafe(goalId: string): Promise<{ freedBytes: number; keptSharedBytes: number }> {
  const spines = await listDownloadedSpines();
  const target = spines.find((s) => s.goalId === goalId);
  if (!target) return { freedBytes: 0, keptSharedBytes: 0 };
  const mine = new Set(target.urls ?? []);
  // urls any OTHER downloaded spine still needs — those must survive
  const stillNeeded = new Set<string>();
  for (const s of spines) if (s.goalId !== goalId) for (const u of s.urls ?? []) stillNeeded.add(u);
  const bytes = await sourceBytesByUrl();
  const toDelete: string[] = [];
  let freedBytes = 0;
  let keptSharedBytes = 0;
  for (const u of mine) {
    if (stillNeeded.has(u)) keptSharedBytes += bytes.get(u) ?? 0; // a sibling needs it → keep
    else {
      toDelete.push(u);
      freedBytes += bytes.get(u) ?? 0; // exclusive → free it
    }
  }
  if (toDelete.length) await db().sources.bulkDelete(toDelete);
  await db().spines.delete(goalId);
  return { freedBytes, keptSharedBytes };
}
