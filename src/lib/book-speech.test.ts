import { describe, it, expect } from "vitest";
import { bookToSpeech, normalizeNotation, stripMarkdown, INTRO_SECTION } from "@/lib/book-speech";
import { parseBook } from "@/lib/book";

const BOOK = (body: string, extra = "") =>
  parseBook(`---\nmodule_id: cb000000-0000-4000-8000-000000000009\nspine: FrED\ntitle: Prueba\nsubtitle: sub\n${extra}---\n\n> la pregunta raíz\n\n${body}`)!;

describe("book-speech — preprocessing for the audiobook (never read tech markdown literally)", () => {
  it("a code block is NEVER read literally — it is announced with language + line count", () => {
    const b = BOOK("## Núcleo\ntexto antes.\n\n```python\nx = 1\ny = 2\nprint(x + y)\n```\n\ntexto después.");
    const items = bookToSpeech(b, { codeMode: "announce" });
    const texts = items.map((i) => i.text);
    // the code lines never appear
    expect(texts.some((t) => /print\(x \+ y\)|x = 1/.test(t))).toBe(false);
    // instead: a brief announce with the language and 3 lines
    const note = items.find((i) => i.kind === "note");
    expect(note?.text).toBe("Bloque de código en Python, 3 líneas. Se omite en el audio.");
    // the surrounding prose IS read
    expect(texts).toContain("texto antes.");
    expect(texts).toContain("texto después.");
  });

  it("codeMode 'skip' emits NOTHING for the code (still never literal)", () => {
    const b = BOOK("## X\n```js\nconst a = 1;\n```\nprosa.");
    const items = bookToSpeech(b, { codeMode: "skip" });
    expect(items.some((i) => i.kind === "note")).toBe(false);
    expect(items.some((i) => /const a = 1/.test(i.text))).toBe(false);
    expect(items.some((i) => i.text === "prosa.")).toBe(true);
  });

  it("strips markdown syntax — reads the words, not the symbols", () => {
    expect(stripMarkdown("**negrita** y *cursiva* y `codigo`")).toBe("negrita y cursiva y codigo");
    expect(stripMarkdown("un [[wikilink]] y un [enlace](http://x.com)")).toBe("un wikilink y un enlace");
    expect(stripMarkdown("[[celda-avl|AVL]]")).toBe("AVL");
    expect(stripMarkdown("- item uno\n- item dos")).toBe("item uno\nitem dos");
    expect(stripMarkdown("> una cita")).toBe("una cita");
  });

  it("normalizes inline notation to something pronounceable", () => {
    expect(normalizeNotation("es O(n log n) siempre")).toBe("es O de n log n siempre");
    expect(normalizeNotation("cuesta O(1)")).toBe("cuesta O de 1");
    expect(normalizeNotation("n² operaciones")).toBe("n al cuadrado operaciones");
    expect(normalizeNotation("a ≤ b → c")).toBe("a  menor o igual que  b  lleva a  c");
  });

  it("a table is mentioned, not read cell by cell", () => {
    const b = BOOK("## Datos\n| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n\nfin.");
    const items = bookToSpeech(b, { codeMode: "announce" });
    expect(items.some((i) => i.text === "Tabla de 2 filas. Se omite en el audio.")).toBe(true);
    expect(items.some((i) => /\| 1 \| 2 \|/.test(i.text))).toBe(false); // never the raw row
    expect(items.some((i) => i.text === "fin.")).toBe(true);
  });

  it("produces an intro (title + root question) then section-tagged items for highlight/scroll sync", () => {
    const b = BOOK("## Prólogo\ncuerpo del prólogo.\n\n## Núcleo\ncuerpo del núcleo.");
    const items = bookToSpeech(b, { codeMode: "announce" });
    // intro items carry INTRO_SECTION; the title utterance leads
    expect(items[0]!.sectionId).toBe(INTRO_SECTION);
    expect(items[0]!.kind).toBe("title");
    expect(items[0]!.text).toBe("Prueba. sub.");
    expect(items.some((i) => i.sectionId === INTRO_SECTION && /Pregunta raíz\. la pregunta raíz/.test(i.text))).toBe(true);
    // each section's items are tagged with the section's DOM id (for scroll)
    const secIds = new Set(items.map((i) => i.sectionId));
    expect(secIds.has(b.sections[0]!.id)).toBe(true);
    expect(secIds.has(b.sections[1]!.id)).toBe(true);
    // the section title is spoken as a `title` item
    const nucleoTitle = items.find((i) => i.sectionId === b.sections[1]!.id && i.kind === "title");
    expect(nucleoTitle?.text).toBe("Núcleo");
    // every item has non-empty preprocessed text
    expect(items.every((i) => i.text.trim().length > 0)).toBe(true);
  });
});
