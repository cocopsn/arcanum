import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseBook } from "@/lib/book";
import { resolveCellId, CELL_SLUG_TO_ID } from "@/lib/cell-slugs";

// BOOK ANCHOR INVENTORY — the whole shelf, verified. Every bundled book must PARSE (a book that
// stops parsing ships a silent hole in the reader), and its match-or-loose status must be the
// DECLARED one: the only intentionally-loose books are the two standard-depth German twins (their
// deep siblings win the cell — the depth rule). The 14 OA books anchor 1:1 onto the 14 OA cells via
// the published slug contract. If someone drops a book whose handle silently resolves nowhere, this
// test names it instead of letting it vanish into the "Sueltos" shelf unnoticed.

const DIR = join(process.cwd(), "content", "books");
const files = readdirSync(DIR).filter((f) => f.endsWith(".md"));

describe("content/books — the shelf parses and anchors as declared", () => {
  it("every bundled book satisfies the contract (parses, has a title)", () => {
    for (const f of files) {
      const parsed = parseBook(readFileSync(join(DIR, f), "utf8"));
      expect(parsed, `${f} parses`).not.toBeNull();
      expect(parsed!.meta.title.trim().length, `${f} has a title`).toBeGreaterThan(0);
    }
  });

  it("match-or-loose, HANDLE level: every bundled book RESOLVES to a real cell (zero silent Sueltos)", () => {
    // Two layers, not one: resolveCellId answers "does this handle name a cell?" — and today every
    // bundled book does. The DEPTH rule (a standard twin losing its cell to the deep sibling and
    // listing loose) is seed-books' shelf decision, tested in seed-books.test.ts — not this layer.
    const loose: string[] = [];
    for (const f of files) {
      const parsed = parseBook(readFileSync(join(DIR, f), "utf8"))!;
      if (resolveCellId(parsed.meta.moduleId) === null) loose.push(f);
    }
    expect(loose).toEqual([]);
  });

  it("the German depth-twins share their level cell (the depth rule demotes the standard one at seed)", () => {
    const cellOf = (f: string) => resolveCellId(parseBook(readFileSync(join(DIR, f), "utf8"))!.meta.moduleId);
    expect(cellOf("de-a1-fundamentos.md")).toBe(cellOf("de-a1-fundamentos-standard.md"));
    expect(cellOf("de-a2-conversacion.md")).toBe(cellOf("de-a2-conversacion-standard.md"));
  });

  it("the 14 OA books anchor 1:1 onto the 14 OA cells (full temario slugs → ce cells)", () => {
    const oaFiles = files.filter((f) => f.startsWith("oa-"));
    expect(oaFiles).toHaveLength(14);
    const targets = new Set<string>();
    for (const f of oaFiles) {
      const parsed = parseBook(readFileSync(join(DIR, f), "utf8"))!;
      const cell = resolveCellId(parsed.meta.moduleId);
      expect(cell, `${f} anchors`).toMatch(/^ce000000-/);
      expect(parsed.meta.spine, `${f} declares the OA spine`).toBe("OA Amazon");
      targets.add(cell!);
    }
    expect(targets.size).toBe(14); // one book per cell, no two books fighting for the same cell
    // and the registry's OA side is exactly the 14 cells
    const oaSlugCells = Object.entries(CELL_SLUG_TO_ID)
      .filter(([slug]) => slug.startsWith("oa-"))
      .map(([, id]) => id);
    expect(new Set(oaSlugCells).size).toBe(14);
  });
});
