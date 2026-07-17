import { describe, it, expect } from "vitest";
import { saveBook, getBook, getBookForModule, deleteBook, setProgress, getProgress } from "@/lib/book-store";

const BOOK = (moduleId: string, title: string) =>
  ["---", `module_id: ${moduleId}`, "spine: ITC", `title: ${title}`, "reading_minutes: 10", "---", "", "> pregunta raíz de prueba", "", "## Prólogo", "cuerpo del libro de prueba con suficiente texto real"].join("\n");

// a real module_id anchor is a UUID (the shape of every roadmap cell id) — fixtures must use one, not
// free text, since the parser now rejects non-UUID anchors as loose books (book.ts UUID_RE).
const uuid = () => "cc000000-0000-4000-8000-" + Math.floor(Math.random() * 0xfffffffffff).toString(16).padStart(12, "0").slice(0, 12);

describe("book-store — offline storage + module anchor (Phase 1 reading)", () => {
  it("saves a valid book and retrieves it by id AND by module (bidirectional anchor)", async () => {
    const mid = uuid();
    const saved = await saveBook(BOOK(mid, "Libro de prueba"), "import");
    expect(saved?.id).toBe(mid);
    expect((await getBook(mid))?.title).toBe("Libro de prueba");
    expect((await getBookForModule(mid))?.moduleId).toBe(mid);
    await deleteBook(mid);
    expect(await getBook(mid)).toBeNull();
  });

  it("rejects an invalid .md — no faked book stored", async () => {
    expect(await saveBook("no frontmatter here, just text", "import")).toBeNull();
  });

  it("two distinct non-Latin-titled LOOSE books get distinct ids (no silent overwrite — data loss fix)", async () => {
    const a = await saveBook("---\ntitle: 本一\nspine: ITC\n---\n\n## X\ncontenido uno real", "import");
    const b = await saveBook("---\ntitle: 本二\nspine: ITC\n---\n\n## Y\ncontenido dos real", "import");
    expect(a?.id).not.toBe(b?.id); // distinct titles → distinct primary keys, both survive
    expect((await getBook(a!.id))?.title).toBe("本一");
    expect((await getBook(b!.id))?.title).toBe("本二");
    await deleteBook(a!.id);
    await deleteBook(b!.id);
  });

  it("tracks reading progress as device-local session state (never the log), purged on delete", async () => {
    const mid = uuid();
    await saveBook(BOOK(mid, "Prog"), "import");
    await setProgress(mid, { scrollPct: 0.5 });
    expect((await getProgress(mid))?.scrollPct).toBe(0.5);
    await setProgress(mid, { scrollPct: 0.95, completed: true });
    expect((await getProgress(mid))?.completed).toBe(true);
    await deleteBook(mid);
    expect(await getProgress(mid)).toBeNull();
  });
});
