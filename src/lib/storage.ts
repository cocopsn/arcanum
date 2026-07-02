// Durable-storage helpers. persist() is best requested AFTER a user gesture (iOS grants it far more
// reliably once the PWA is engaged/installed). We NEVER claim a guarantee we don't have — getStorageStatus
// reports the REAL persisted flag (null when the browser doesn't support the query) so the UI is honest.
// The Supabase mirror remains the durable backup when there's network.

export interface StorageStatus {
  /** true = the browser guaranteed persistence; false = eviction possible; null = unknown/unsupported */
  persisted: boolean | null;
  usageMB: number | null;
  quotaMB: number | null;
}

/** Ask the browser to make IndexedDB persistent. Returns the resulting persisted state. Safe/no-op on SSR. */
export async function requestPersist(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function getStorageStatus(): Promise<StorageStatus> {
  if (typeof navigator === "undefined" || !navigator.storage) return { persisted: null, usageMB: null, quotaMB: null };
  let persisted: boolean | null = null;
  try {
    persisted = (await navigator.storage.persisted?.()) ?? null;
  } catch {
    persisted = null;
  }
  let usageMB: number | null = null;
  let quotaMB: number | null = null;
  try {
    const est = await navigator.storage.estimate?.();
    if (est) {
      usageMB = typeof est.usage === "number" ? Math.round((est.usage / 1e6) * 10) / 10 : null;
      quotaMB = typeof est.quota === "number" ? Math.round(est.quota / 1e6) : null;
    }
  } catch {
    /* estimate unsupported */
  }
  return { persisted, usageMB, quotaMB };
}
