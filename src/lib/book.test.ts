import { describe, it, expect } from "vitest";
import { parseBook, slugify } from "@/lib/book";

const SAMPLE = [
  "---",
  "module_id: ca000000-0000-4000-8000-000000000005",
  "spine: ITC",
  "title: El árbol que se niega a inclinarse",
  "subtitle: Por qué un AVL garantiza O(log n)",
  "source_canonical: MIT 6.006 L6-L7; CLRS cap. 13",
  "depth: raiz",
  "structure: pregunta-raiz + prologo + nucleo + conexiones + sintesis",
  "generated_by: Sonnet 5",
  "version: 1.0",
  "reading_minutes: 22",
  "---",
  "",
  "> ¿Por qué un BST puede degenerar en una lista, y qué invariante lo impide?",
  "",
  "## Prólogo",
  "Un BST ingenuo puede volverse O(n).",
  "",
  "## La recurrencia de la altura",
  "El corazón: N(h) = 1 + N(h-1) + N(h-2).",
  "",
  "```python",
  "def height(node):",
  "    return -1 if node is None else 1 + max(height(node.left), height(node.right))",
  "```",
  "",
  "## Conexiones",
  "Se conecta con los heaps (otra estructura de altura acotada).",
  "",
  "## Síntesis",
  "La altura acotada ES la garantía.",
  "",
  "## Preguntas que deberías poder responder",
  "- ¿Por qué N(h) crece como Fibonacci?",
  "",
  "## Fuentes",
  "- MIT 6.006 Lecture 6",
].join("\n");

describe("parseBook — the ingest contract (any .md that satisfies it can be read)", () => {
  it("parses frontmatter, root question, sections, kinds, TOC, keeps code", () => {
    const b = parseBook(SAMPLE)!;
    expect(b.meta.moduleId).toBe("ca000000-0000-4000-8000-000000000005");
    expect(b.meta.spine).toBe("ITC");
    expect(b.meta.title).toContain("árbol");
    expect(b.meta.readingMinutes).toBe(22);
    expect(b.rootQuestion).toMatch(/degenerar en una lista/);
    const kinds = b.sections.map((s) => s.kind);
    expect(kinds).toEqual(["prologue", "core", "connections", "synthesis", "questions", "sources"]);
    const core = b.sections.find((s) => s.kind === "core")!;
    expect(core.markdown).toContain("```python");
    expect(core.markdown).toContain("def height");
    expect(b.toc).toHaveLength(b.sections.length);
    expect(b.toc[0]!.id).toBe(slugify(b.sections[0]!.title));
    expect(b.wordCount).toBeGreaterThan(20);
  });

  it("returns null without frontmatter or without a title (honest invalid, never faked)", () => {
    expect(parseBook("# just markdown\n\nno frontmatter")).toBeNull();
    expect(parseBook("---\nspine: ITC\n---\n\n## X\ntext")).toBeNull(); // no title
  });

  it("allows a LOOSE book (no module_id → not anchored to a cell)", () => {
    const b = parseBook("---\ntitle: Suelto\nspine: FrED\n---\n\n## X\nhola")!;
    expect(b.meta.moduleId).toBeNull();
    expect(b.meta.title).toBe("Suelto");
    expect(b.sections).toHaveLength(1);
  });
});

describe("parseBook — robust against adversarial .md (any file, the door for 100 books)", () => {
  it("does NOT split on ## or --- inside a fenced code block", () => {
    const md = ["---", "title: Fence", "spine: ITC", "---", "", "## Sección real", "```bash", "## esto es un comentario, no un heading", "echo hola", "---", "```", "prosa después", "", "## Segunda real", "más"].join("\n");
    const b = parseBook(md)!;
    expect(b.sections.map((s) => s.title)).toEqual(["Sección real", "Segunda real"]);
    expect(b.sections[0]!.markdown).toContain("## esto es un comentario"); // fence content intact, not a section
  });

  it("gives DISTINCT ids to distinct non-Latin titles/sections (no silent overwrite)", () => {
    const b = parseBook("---\ntitle: 深い本\nspine: ITC\n---\n\n## 第一\na\n\n## 第二\nb")!;
    const ids = b.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("dedupes identical Latin headings within a book (unique TOC anchors)", () => {
    const b = parseBook("---\ntitle: T\nspine: ITC\n---\n\n## Notas\na\n\n## Notas\nb")!;
    expect(new Set(b.sections.map((s) => s.id)).size).toBe(2);
  });

  it("preserves prose before the first ## (and a headingless body) as lead — never dropped", () => {
    const withLead = parseBook("---\ntitle: T\nspine: ITC\n---\n\n> raíz\n\nEste párrafo va antes de todo heading.\n\n## Uno\nx")!;
    expect(withLead.lead).toContain("antes de todo heading");
    expect(withLead.rootQuestion).toBe("raíz");
    const headingless = parseBook("---\ntitle: T\nspine: ITC\n---\n\nTodo el cuerpo sin un solo heading, pero real.")!;
    expect(headingless.sections).toHaveLength(0);
    expect(headingless.lead).toContain("sin un solo heading");
  });
});
