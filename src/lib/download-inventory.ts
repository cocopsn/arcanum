import { listBooks } from "@/lib/book-store";
import { listBanks } from "@/lib/exercise-store";
import { listDownloadedSpines, sourceBytesByUrl } from "@/lib/offline-store";

// EXACT offline-download accounting. Every number is MEASURED from the store (byte length of what's stored),
// never estimated. The one place bytes are SHARED is the per-spine source cache: two spines can reference the
// SAME curated source url (e.g. the IoT cell builds on FrED sources), and that source is stored ONCE. So the
// honest total counts each stored source ONCE (never A+B naïve), while each spine still shows what it uses —
// split into EXCLUSIVE (only it) and SHARED (a sibling needs it too). This file is the source of truth for
// the panel and is unit-tested with a synthetic A/B overlap. Device-local cache only, never the event log.

export interface SpineAccount {
  goalId: string;
  title: string;
  /** bytes only THIS spine references — freed if you delete it */
  uniqueBytes: number;
  /** bytes it shares with another downloaded spine — stored once, NOT freed on delete (a sibling needs them) */
  sharedBytes: number;
  sharedWith: { goalId: string; title: string }[];
  /** what this spine occupies including its share (uniqueBytes + sharedBytes) */
  footprintBytes: number;
}

/**
 * PURE core: split every downloaded spine's footprint into exclusive vs shared bytes, and compute the DISTINCT
 * total (each source counted once — the number that never inflates). `sourceBytes` is url → its stored size.
 */
export function computeSpineAccounting(
  spines: { goalId: string; title: string; urls: string[] }[],
  sourceBytes: Map<string, number>,
): { accounts: SpineAccount[]; distinctSourceBytes: number } {
  // url → the goalIds that reference it (a source shared by ≥2 spines is a "shared" byte)
  const refs = new Map<string, Set<string>>();
  for (const s of spines) for (const u of new Set(s.urls)) {
    let set = refs.get(u);
    if (!set) refs.set(u, (set = new Set()));
    set.add(s.goalId);
  }
  const titleOf = new Map(spines.map((s) => [s.goalId, s.title]));
  const accounts: SpineAccount[] = spines.map((s) => {
    let uniqueBytes = 0;
    let sharedBytes = 0;
    const sharedGoals = new Set<string>();
    for (const u of new Set(s.urls)) {
      const holders = refs.get(u) ?? new Set<string>();
      const b = sourceBytes.get(u) ?? 0;
      if (holders.size >= 2) {
        sharedBytes += b;
        for (const g of holders) if (g !== s.goalId) sharedGoals.add(g);
      } else {
        uniqueBytes += b;
      }
    }
    return {
      goalId: s.goalId,
      title: s.title,
      uniqueBytes,
      sharedBytes,
      sharedWith: [...sharedGoals].map((g) => ({ goalId: g, title: titleOf.get(g) ?? g })),
      footprintBytes: uniqueBytes + sharedBytes,
    };
  });
  // DISTINCT = every referenced source once → total = Σ unique + Σ shared-once, NEVER the naïve Σ footprint
  let distinctSourceBytes = 0;
  for (const u of refs.keys()) distinctSourceBytes += sourceBytes.get(u) ?? 0;
  return { accounts, distinctSourceBytes };
}

export interface Inventory {
  /** the user-managed Spotify-style spine downloads (with the shared/unique split) */
  spines: SpineAccount[];
  distinctSourceBytes: number;
  /** bundled content, always present offline (seeds on load) — shown, not deletable (a delete would re-seed) */
  books: { count: number; bytes: number };
  banks: { count: number; bytes: number };
  /** the Python runtime (Pyodide) cached by the service worker — measured from the Cache API */
  runtime: { present: boolean; bytes: number };
  /** the precached app shell */
  shell: { bytes: number };
  /** honest grand total: distinct sources (each once) + books + banks + runtime + shell */
  grandTotal: number;
  /** the browser's own usage number, for a cross-check (may exceed grandTotal: the log DB, etc.) */
  storageUsageBytes: number | null;
}

/** Measure a service-worker Cache EXACTLY (Content-Length when present, else the blob size). Never CREATES
 *  the cache (caches.open would) — a missing cache reads as zero. */
async function measureCache(name: string): Promise<{ bytes: number; count: number }> {
  if (typeof caches === "undefined") return { bytes: 0, count: 0 };
  try {
    if (!(await caches.has(name))) return { bytes: 0, count: 0 };
    const c = await caches.open(name);
    const keys = await c.keys();
    let bytes = 0;
    for (const req of keys) {
      const res = await c.match(req);
      if (!res) continue;
      const len = res.headers.get("content-length");
      bytes += len ? Number(len) : (await res.clone().blob()).size;
    }
    return { bytes, count: keys.length };
  } catch {
    return { bytes: 0, count: 0 };
  }
}

async function storageUsage(): Promise<number | null> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
    const e = await navigator.storage.estimate();
    return typeof e.usage === "number" ? e.usage : null;
  } catch {
    return null;
  }
}

/** Gather the full offline inventory from the real stores + service-worker caches. */
export async function buildInventory(): Promise<Inventory> {
  const [books, banks, spines, sourceBytes] = await Promise.all([listBooks(), listBanks(), listDownloadedSpines(), sourceBytesByUrl()]);
  const { accounts, distinctSourceBytes } = computeSpineAccounting(
    spines.map((s) => ({ goalId: s.goalId, title: s.title, urls: s.urls ?? [] })),
    sourceBytes,
  );
  const bookBytes = books.reduce((n, b) => n + b.bytes, 0);
  const bankBytes = banks.reduce((n, b) => n + b.bytes, 0);
  const runtime = await measureCache("arcanum-pyodide");
  const shell = await measureCache("arcanum-shell");
  return {
    spines: accounts,
    distinctSourceBytes,
    books: { count: books.length, bytes: bookBytes },
    banks: { count: banks.length, bytes: bankBytes },
    runtime: { present: runtime.count > 0, bytes: runtime.bytes },
    shell: { bytes: shell.bytes },
    grandTotal: distinctSourceBytes + bookBytes + bankBytes + runtime.bytes + shell.bytes,
    storageUsageBytes: await storageUsage(),
  };
}
