import { parseBook, slugify } from "@/lib/book";
import { getBook, saveBook } from "@/lib/book-store";
import { allBookMd } from "@/lib/all-books";
import { resolveCellId } from "@/lib/cell-slugs";

// EVERY .md in content/books/ (bundled at build via require.context) → the offline book store, so a book
// the user drops in the folder ships with the app, downloadable + persistent offline. The book ANCHORS to
// an existing roadmap cell (its slug/UUID handle resolved, lib/cell-slugs.ts) or stays LOOSE — it never
// creates a cell (the reader content is isolated from the event log; the log is sacred).
export const SEED_BOOK_MD: string[] = allBookMd();

/** Populate the offline book store with the folder books. Refreshes SEED books to the latest bundled .md,
 *  but NEVER clobbers a user's own import (source === 'import'). Best-effort (offline cache). */
export async function seedBooks(): Promise<void> {
  for (const md of SEED_BOOK_MD) {
    const parsed = parseBook(md);
    if (!parsed) continue;
    const id = resolveCellId(parsed.meta.moduleId) ?? parsed.meta.moduleId ?? slugify(parsed.meta.title);
    const existing = await getBook(id);
    if (existing && existing.source === "import") continue; // never clobber a user's imported/edited book
    await saveBook(md, "seed"); // (re)seed — refreshes changed seed content
  }
}
