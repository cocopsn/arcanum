// ANCHOR SLUGS — friendly, stable handles for roadmap cells so a book can name the cell it belongs to
// WITHOUT knowing its UUID. A book's `module_id` may be one of these slugs (exact, OR with a descriptive
// suffix like "itc-c1-asintotico") OR a raw cell UUID. Ingestion RESOLVES it to the cell and anchors the
// book there for reading; a value that matches NOTHING → the book stays LOOSE (still readable, listed in
// its spine's section). This is NEVER a second identity — the UUID in spines.ts stays the cell's id; this
// only maps a friendly handle → that id. It IS the published contract the user names books against.
//
// MATCHING: a book slug matches a key when it EQUALS it or starts with `${key}-` — so "itc-c1",
// "itc-c1-asintotico", "itc-c1-lo-que-sea" all anchor to ITC C1. Keys carry the spine prefix (itc-/fred-)
// so there is no cross-spine collision. To anchor a NEW cell's books, add its slug here (single source).

export const CELL_SLUG_TO_ID: Record<string, string> = {
  // ITC (goal a0000000-…-001)
  "itc-0": "ca000000-0000-4000-8000-000000000001",
  "itc-c1": "ca000000-0000-4000-8000-000000000002",
  "itc-c2": "ca000000-0000-4000-8000-000000000003",
  "itc-c3": "ca000000-0000-4000-8000-000000000004",
  "itc-c4": "ca000000-0000-4000-8000-000000000005",
  "itc-c5": "ca000000-0000-4000-8000-000000000006",
  "itc-c6": "ca000000-0000-4000-8000-000000000007",
  "itc-c7": "ca000000-0000-4000-8000-000000000008",
  "itc-c8": "ca000000-0000-4000-8000-000000000009",
  "itc-iot": "ca000000-0000-4000-8000-000000000010",
  // FrED (goal a0000000-…-002)
  "fred-s1": "cb000000-0000-4000-8000-000000000001",
  "fred-s2": "cb000000-0000-4000-8000-000000000002",
  "fred-s3": "cb000000-0000-4000-8000-000000000003",
  "fred-s4": "cb000000-0000-4000-8000-000000000004",
  "fred-h1": "cb000000-0000-4000-8000-000000000005",
  "fred-h2": "cb000000-0000-4000-8000-000000000006",
  "fred-h3": "cb000000-0000-4000-8000-000000000007",
  "fred-h4": "cb000000-0000-4000-8000-000000000008",
  // FrED · Operativo (path a1000000-…-003) — the ORION Bridge track, seeded in lib/seed.ts.
  "fred-op-0": "cb000000-0000-4000-8000-000000000009",
  "fred-op-1": "cb000000-0000-4000-8000-00000000000a",
  "fred-op-2": "cb000000-0000-4000-8000-00000000000b",
  "fred-op-3": "cb000000-0000-4000-8000-00000000000c",
  "fred-op-4": "cb000000-0000-4000-8000-00000000000d",
  "fred-op-5": "cb000000-0000-4000-8000-00000000000e",
  "fred-op-7": "cb000000-0000-4000-8000-00000000000f",
};

const KNOWN_IDS = new Set(Object.values(CELL_SLUG_TO_ID));
// longest key first → a single unambiguous match even if two keys ever share a boundary prefix
const SLUGS_BY_LEN = Object.keys(CELL_SLUG_TO_ID).sort((a, b) => b.length - a.length);

/**
 * Resolve a book's raw `module_id` (a slug OR a raw cell UUID) → the cell UUID it anchors to, or null
 * when it matches nothing (the book is LOOSE). Pure + deterministic — no clock, no I/O.
 */
export function resolveCellId(moduleIdRaw: string | null | undefined): string | null {
  if (!moduleIdRaw) return null;
  const s = moduleIdRaw.trim().toLowerCase();
  if (!s) return null;
  if (KNOWN_IDS.has(s)) return s; // already a real cell UUID
  for (const slug of SLUGS_BY_LEN) {
    if (s === slug || s.startsWith(slug + "-")) return CELL_SLUG_TO_ID[slug]!;
  }
  return null;
}
