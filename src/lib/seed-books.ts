import { parseBook, slugify, type ParsedBook } from "@/lib/book";
import { getBook, saveBook, deleteBook } from "@/lib/book-store";
import { allBookMd } from "@/lib/all-books";
import { resolveCellId } from "@/lib/cell-slugs";

// EVERY .md in content/books/ (bundled at build via require.context) → the offline book store, so a book
// the user drops in the folder ships with the app, downloadable + persistent offline. The book ANCHORS to
// an existing roadmap cell (its slug/UUID handle resolved, lib/cell-slugs.ts) or stays LOOSE — it never
// creates a cell (the reader content is isolated from the event log; the log is sacred).
export const SEED_BOOK_MD: string[] = allBookMd();

// ONE canonical (anchored) reading per cell: when several bundled books resolve to the SAME cell — e.g. two
// drafts of the same level, a "deep" rewrite next to its "standard" original — the DEEPER one anchors and the
// rest stay LOOSE (kept + readable, never overwritten). The winner is derived PURELY from metadata (depth ▸
// version ▸ length ▸ handle) so a re-seed is deterministic + idempotent. No clock, no order dependence.
const DEPTH_RANK: Record<string, number> = { deep: 3, standard: 2, quick: 1, brief: 1 };
const depthRank = (d: string): number => DEPTH_RANK[d.trim().toLowerCase()] ?? 0;

type Prepared = { md: string; parsed: ParsedBook; handle: string; cellId: string | null };

/** Total order: does `a` outrank `b` for anchoring the cell they both resolve to? Deeper first, then higher
 *  version, then more complete body, then handle asc (a deterministic final tiebreak). Pure. */
function outranks(a: Prepared, b: Prepared): boolean {
  const ra = depthRank(a.parsed.meta.depth);
  const rb = depthRank(b.parsed.meta.depth);
  if (ra !== rb) return ra > rb;
  const va = Number.parseInt(a.parsed.meta.version, 10) || 0;
  const vb = Number.parseInt(b.parsed.meta.version, 10) || 0;
  if (va !== vb) return va > vb;
  if (a.parsed.wordCount !== b.parsed.wordCount) return a.parsed.wordCount > b.parsed.wordCount;
  if (a.handle !== b.handle) return a.handle < b.handle;
  // STRICT total order even for twins that SHARE a handle (the shipped German case): fall back to the
  // title slug — the same key a demoted twin is stored under, so it is guaranteed distinct. Without this
  // the tiebreak is false in both directions → the winner would be input-order-dependent (non-deterministic).
  return slugify(a.parsed.meta.title) < slugify(b.parsed.meta.title);
}

/** Populate the offline book store with the folder books. Refreshes SEED books to the latest bundled .md,
 *  but NEVER clobbers a user's own import (source === 'import'). Best-effort (offline cache). `mds`
 *  defaults to the bundled folder books; it is injectable so the deepest-per-cell dedup is unit-testable. */
export async function seedBooks(mds: string[] = SEED_BOOK_MD): Promise<void> {
  const prepared: Prepared[] = [];
  for (const md of mds) {
    const parsed = parseBook(md);
    if (!parsed) continue;
    prepared.push({ md, parsed, handle: parsed.meta.moduleId ?? slugify(parsed.meta.title), cellId: resolveCellId(parsed.meta.moduleId) });
  }

  // pick the anchor winner per cell (deepest); everyone else — unresolved OR out-ranked — is loose.
  const winner = new Map<string, Prepared>();
  for (const p of prepared) {
    if (!p.cellId) continue;
    const cur = winner.get(p.cellId);
    if (!cur || outranks(p, cur)) winner.set(p.cellId, p);
  }

  for (const p of prepared) {
    const anchored = p.cellId != null && winner.get(p.cellId) === p;
    if (anchored) {
      // MIGRATION: a book that USED to be loose (keyed by its handle) but now RESOLVES to a cell — drop the
      // stale loose row so it doesn't duplicate the linked copy. (A demoted twin keys by its title slug, not
      // the handle, so this never deletes it.)
      if (p.cellId !== p.handle) {
        const stale = await getBook(p.handle);
        if (stale && stale.source !== "import") await deleteBook(p.handle);
      }
      const existing = await getBook(p.cellId!);
      if (existing && existing.source === "import") continue; // never clobber a user's imported/edited book
      await saveBook(p.md, "seed"); // resolves → keyed by its cell, anchored
    } else {
      // LOOSE: unresolved → key by its handle (unchanged); resolved-but-demoted twin → key by its TITLE slug
      // (distinct, so it never collides with the winner's vacated handle). Both persist + stay readable.
      const looseId = p.cellId != null ? slugify(p.parsed.meta.title) : p.handle;
      // MIGRATION (mirror of the anchored branch): a book that USED to be loose-by-handle but now RESOLVES
      // and is DEMOTED re-keys to its title slug — drop the stale handle-keyed row so it doesn't duplicate.
      if (p.cellId != null && p.handle !== looseId) {
        const stale = await getBook(p.handle);
        if (stale && stale.source !== "import") await deleteBook(p.handle);
      }
      const existing = await getBook(looseId);
      if (existing && existing.source === "import") continue;
      await saveBook(p.md, "seed", { id: looseId, anchored: false });
    }
  }
}
