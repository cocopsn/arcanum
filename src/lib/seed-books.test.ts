import { describe, it, expect } from "vitest";
import { seedBooks } from "@/lib/seed-books";
import { saveBook, getBook, listBooks, deleteBook } from "@/lib/book-store";
import { slugify } from "@/lib/book";

// Alemán A1.1 — the ENTRY cell that `de-a1` (and any `de-a1-…` handle) resolves to.
const A1_CELL = "cc000000-0000-4000-8000-000000000001";

const BOOK = (moduleId: string, title: string, depth: string) =>
  ["---", `module_id: ${moduleId}`, "spine: Alemán", `title: ${title}`, `depth: ${depth}`, "version: 1", "reading_minutes: 30", "---", "", "> raíz de prueba", "", "## Prólogo", `cuerpo real de ${title} con suficiente texto`].join("\n");

describe("seed-books — deepest reading anchors per cell; the shallower twin stays LOOSE (the German-twins case)", () => {
  it("two books resolving to the SAME cell: the DEEP one anchors, the STANDARD one stays loose — both persist", async () => {
    const deep = BOOK("de-a1-fundamentos", "A1 — la arquitectura del alemán", "deep");
    const std = BOOK("de-a1-fundamentos", "A1 — el sistema del alemán", "standard");
    // order must NOT matter — seed the standard one FIRST
    await seedBooks([std, deep]);

    const anchored = await getBook(A1_CELL);
    expect(anchored, "the cell has an anchored reading").toBeTruthy();
    expect(anchored!.title).toContain("arquitectura"); // the DEEP reading won the cell
    expect(anchored!.moduleId).toBe(A1_CELL);

    const looseId = slugify("A1 — el sistema del alemán");
    const loose = await getBook(looseId);
    expect(loose, "the shallower twin persists as a loose readable").toBeTruthy();
    expect(loose!.title).toContain("sistema");
    expect(loose!.moduleId).toBeNull(); // loose = not anchored to any cell

    // NOTHING was overwritten — both books survive
    const titles = (await listBooks()).map((b) => b.title);
    expect(titles).toContain("A1 — la arquitectura del alemán");
    expect(titles).toContain("A1 — el sistema del alemán");

    await deleteBook(A1_CELL);
    await deleteBook(looseId);
  });

  it("is order-independent + idempotent — re-seeding does not duplicate the anchor", async () => {
    const deep = BOOK("de-a1-fundamentos", "A1 deep", "deep");
    const std = BOOK("de-a1-fundamentos", "A1 std", "standard");
    await seedBooks([deep, std]);
    await seedBooks([std, deep]); // reversed order, again
    const anchored = await getBook(A1_CELL);
    expect(anchored!.title).toBe("A1 deep");
    expect((await listBooks()).filter((b) => b.title === "A1 deep").length).toBe(1); // no dup
    await deleteBook(A1_CELL);
    await deleteBook(slugify("A1 std"));
  });

  it("STRICT total order: twins that SHARE a handle AND tie on depth still anchor deterministically (by title)", async () => {
    const cleanup = async () => {
      await deleteBook(A1_CELL);
      await deleteBook(slugify("Aaa mismo nivel"));
      await deleteBook(slugify("Zzz mismo nivel"));
    };
    const a = BOOK("de-a1-fundamentos", "Aaa mismo nivel", "deep"); // same handle + same depth → a real tie
    const b = BOOK("de-a1-fundamentos", "Zzz mismo nivel", "deep");
    await seedBooks([a, b]);
    const w1 = (await getBook(A1_CELL))!.title;
    await cleanup();
    await seedBooks([b, a]); // reversed input order
    const w2 = (await getBook(A1_CELL))!.title;
    expect(w1).toBe("Aaa mismo nivel"); // smaller title slug wins the tie
    expect(w2).toBe(w1); // …regardless of input order (no order-dependence)
    await cleanup();
  });

  it("MIGRATION: a twin that WAS loose-by-handle but now resolves + is demoted drops its stale handle row (no duplicate)", async () => {
    // release N (cell not mapped yet): the standard twin lived LOOSE, keyed by its own handle
    const std = BOOK("de-a1-std", "Gemela estándar", "standard");
    await saveBook(std, "seed", { id: "de-a1-std", anchored: false });
    expect((await getBook("de-a1-std"))?.moduleId).toBeNull(); // loose-by-handle

    // release N+1 (de-a1 now maps): re-seed with its deeper twin → deep anchors, std is demoted to its title slug
    const deep = BOOK("de-a1-deep", "Gemela profunda", "deep");
    await seedBooks([deep, std]);

    expect(await getBook("de-a1-std"), "the stale handle-keyed row is cleaned up").toBeNull();
    const looseId = slugify("Gemela estándar");
    expect((await getBook(looseId))?.title).toBe("Gemela estándar"); // now keyed by title slug, still readable
    expect((await getBook(A1_CELL))?.title).toBe("Gemela profunda"); // deep won the cell
    // exactly one loose copy of the standard twin — no orphan duplicate
    expect((await listBooks()).filter((x) => x.title === "Gemela estándar").length).toBe(1);
    await deleteBook(A1_CELL);
    await deleteBook(looseId);
  });
});
