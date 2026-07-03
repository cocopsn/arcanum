import avlMd from "../../content/books/itc-c4-avl.md";
import fredMd from "../../content/books/fred-s2-anomalias.md";
import { parseBook, slugify } from "@/lib/book";
import { getBook, saveBook } from "@/lib/book-store";

// The bundled seed EXAMPLE books (content/books/*.md). They ship with the app so the reader can be
// tested end-to-end offline; they are marked "ejemplo" in their frontmatter and are meant to be
// replaced by real books the user generates externally (Sonnet 5) and imports.
export const SEED_BOOK_MD: string[] = [avlMd, fredMd];

/** Populate the offline book store with the seed books — IDEMPOTENT: only seeds a book id that has
 *  no entry yet, so a re-seed never clobbers a user's imported book. Best-effort (offline cache). */
export async function seedBooks(): Promise<void> {
  for (const md of SEED_BOOK_MD) {
    const parsed = parseBook(md);
    if (!parsed) continue;
    const id = parsed.meta.moduleId ?? slugify(parsed.meta.title);
    if (await getBook(id)) continue; // already present (seed or user import) → leave it
    await saveBook(md, "seed");
  }
}
