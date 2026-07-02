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
export async function deleteSpineDownload(goalId: string, urls: string[]): Promise<void> {
  await db().sources.bulkDelete(urls);
  await db().spines.delete(goalId);
}
