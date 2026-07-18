import { describe, it, expect } from "vitest";
import { saveBook, getBook, getBookForModule, deleteBook, setProgress, getProgress } from "@/lib/book-store";

const BOOK = (moduleId: string, title: string) =>
  ["---", `module_id: ${moduleId}`, "spine: ITC", `title: ${title}`, "reading_minutes: 10", "---", "", "> pregunta raíz de prueba", "", "## Prólogo", "cuerpo del libro de prueba con suficiente texto real"].join("\n");

// a device-unique LOOSE handle (matches no cell slug) for fixtures that only need a stable primary key.
const looseId = () => "loose-libro-" + Math.floor(Math.random() * 0xffffffffffff).toString(16);

describe("book-store — offline storage + module anchor (Phase 1 reading)", () => {
  it("a book whose handle RESOLVES anchors to that cell (retrievable by id AND by module)", async () => {
    const CELL = "ca000000-0000-4000-8000-000000000002"; // ITC C1
    const saved = await saveBook(BOOK("itc-c1-mi-libro", "Libro de prueba"), "import");
    expect(saved?.id).toBe(CELL); // the resolved handle keys the book by the real cell id
    expect((await getBook(CELL))?.title).toBe("Libro de prueba");
    expect((await getBookForModule(CELL))?.moduleId).toBe(CELL); // anchored to the cell → shows "Leer"
    await deleteBook(CELL);
    expect(await getBook(CELL)).toBeNull();
  });

  it("a book whose handle matches NOTHING stays LOOSE (stored + readable, moduleId null, kept by spine)", async () => {
    const saved = await saveBook(BOOK("no-match-xyz", "Libro suelto"), "import");
    expect(saved?.id).toBe("no-match-xyz"); // keyed by its own handle
    const row = await getBook("no-match-xyz");
    expect(row?.title).toBe("Libro suelto");
    expect(row?.moduleId).toBeNull(); // not anchored to any cell
    expect(row?.spine).toBe("ITC"); // still grouped under its spine section
    await deleteBook("no-match-xyz");
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
    const mid = looseId();
    await saveBook(BOOK(mid, "Prog"), "import");
    await setProgress(mid, { scrollPct: 0.5 });
    expect((await getProgress(mid))?.scrollPct).toBe(0.5);
    await setProgress(mid, { scrollPct: 0.95, completed: true });
    expect((await getProgress(mid))?.completed).toBe(true);
    await deleteBook(mid);
    expect(await getProgress(mid)).toBeNull();
  });

  it("LISTENING progress (audiobook position) is device-local too — round-trips, never the log, purged on delete", async () => {
    const mid = looseId();
    await saveBook(BOOK(mid, "Audio"), "import");
    await setProgress(mid, { listenIndex: 12 }); // where the audiobook was reading
    expect((await getProgress(mid))?.listenIndex).toBe(12);
    // it coexists with reading progress without clobbering it (same device-local row, different field)
    await setProgress(mid, { scrollPct: 0.3 });
    const p = await getProgress(mid);
    expect(p?.listenIndex).toBe(12);
    expect(p?.scrollPct).toBe(0.3);
    await deleteBook(mid);
    expect(await getProgress(mid)).toBeNull(); // listening is input, not mastery — nothing survives in the log
  });
});
