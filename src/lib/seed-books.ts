import { parseBook, slugify } from "@/lib/book";
import { getBook, saveBook } from "@/lib/book-store";
import { allBookMd } from "@/lib/all-books";

// EVERY .md in content/books/ (bundled at build via require.context) → the offline book store, so a book
// the user drops in the folder ships with the app, downloadable + persistent offline, exactly like the two
// original examples. Its CELL is created separately (event-sourced, see lib/book-cells.ts + the seed);
// this half is the reader's content, anchored by module_id and isolated from the log.
export const SEED_BOOK_MD: string[] = allBookMd();

/** Populate the offline book store with the folder books — IDEMPOTENT: only seeds a book id that has
 *  no entry yet, so a re-seed never clobbers a user's imported/edited book. Best-effort (offline cache). */
export async function seedBooks(): Promise<void> {
  for (const md of SEED_BOOK_MD) {
    const parsed = parseBook(md);
    if (!parsed) continue;
    const id = parsed.meta.moduleId ?? slugify(parsed.meta.title);
    if (await getBook(id)) continue; // already present (seed or user import) → leave it
    await saveBook(md, "seed");
  }
}
