// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/react";
import { noteExtensions, serializeProse, unescapeWikilinks } from "@/lib/note-editor";

// The explicit requirement: WYSIWYG → md → WYSIWYG with NO loss. We test it at the markdown layer:
// md → editor (parse) → md (serialize) must preserve the construct (canonicalized whitespace).
function roundTrip(md: string): string {
  const editor = new Editor({ element: document.createElement("div"), extensions: noteExtensions(() => {}), content: md });
  const out = serializeProse(editor);
  editor.destroy();
  return out;
}
// collapse blank-line differences (tiptap-markdown puts a blank line between task items — valid + stable)
const canon = (s: string) => s.replace(/\n{2,}/g, "\n").trim();

describe("note-editor — WYSIWYG ↔ markdown round-trip", () => {
  const cases: [string, string][] = [
    ["heading", "# Encabezado"],
    ["bold+italic", "Texto **negrita** y *itálica*."],
    ["bullets", "- uno\n- dos\n- tres"],
    ["ordered", "1. uno\n2. dos"],
    ["quote", "> una cita"],
    ["inline code", "usa `const`"],
    ["code block", "```js\nconst x = 1;\n```"],
    ["checkboxes", "- [ ] pendiente\n- [x] hecho"],
    ["link", "[Arcanum](https://x.com)"],
  ];
  for (const [name, md] of cases) {
    it(`preserves ${name}`, () => {
      expect(canon(roundTrip(md))).toBe(canon(md));
    });
  }

  it("preserves [[wikilinks]] verbatim (the critical Obsidian-compat case)", () => {
    expect(roundTrip("Mira [[Árbol AVL]] y [[Heaps|montículos]].")).toBe("Mira [[Árbol AVL]] y [[Heaps|montículos]].");
  });

  it("a full note with mixed content round-trips", () => {
    const md = "# AVL\n\nUn árbol **balanceado**. Ver [[Rotaciones]].\n\n- [ ] derivar O(log n)\n- [x] N(h) = N(h-1)+N(h-2)";
    expect(canon(roundTrip(md))).toBe(canon(md));
  });
});

describe("note-editor — unescapeWikilinks", () => {
  it("un-escapes only the double brackets tiptap-markdown escapes", () => {
    expect(unescapeWikilinks("a \\[\\[X\\]\\] b")).toBe("a [[X]] b");
    expect(unescapeWikilinks("un \\[corchete\\] solo")).toBe("un \\[corchete\\] solo"); // single brackets untouched
  });
});
