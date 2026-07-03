import { getBookForModule } from "@/lib/book-store";
import { parseBook } from "@/lib/book";

// LAYER 3 — the "Preguntas que deberías poder responder" the book reader already parses from each .md,
// exposed as CONCEPTUAL self-check prompts anchored to the module. Offline they are NOT auto-graded (no
// test cases, no AI) — honest: they're for reflection and are "revisable con IA" in Phase 3. Never a
// faked verdict. Empty when there's no book / no such section for the cell.
export async function bookQuestionsForModule(moduleId: string): Promise<string[]> {
  const book = await getBookForModule(moduleId);
  if (!book) return [];
  const parsed = parseBook(book.md);
  const qs = parsed?.sections.find((s) => s.kind === "questions");
  if (!qs) return [];
  return qs.markdown
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*+]\s*/, "").trim())
    .filter((l) => l.length > 8);
}
