import { describe, it, expect } from "vitest";
import { buildNoteGraph } from "@/lib/note-graph";
import type { NoteRM } from "@/core/read-model";

const note = (over: Partial<NoteRM>): NoteRM => ({
  id: "n", moduleId: null, goalId: null, title: "", markdown: "", links: [], backlinks: [], createdTs: 0, updatedTs: 0, ...over,
});

describe("buildNoteGraph", () => {
  it("links note → note by [[title]] (case-insensitive), skips unresolved + self", () => {
    const notes = [
      note({ id: "a", title: "AVL", links: ["Rotaciones", "Fantasma"] }),
      note({ id: "b", title: "rotaciones" }), // different case resolves
      note({ id: "c", title: "Solo", links: ["Solo"] }), // self-link skipped
    ];
    const { nodes, edges } = buildNoteGraph(notes, []);
    expect(nodes.filter((n) => n.kind === "note").map((n) => n.id).sort()).toEqual(["a", "b", "c"]);
    const wikis = edges.filter((e) => e.kind === "wikilink");
    expect(wikis).toEqual([{ id: "w:a->b", source: "a", target: "b", kind: "wikilink" }]);
  });

  it("anchors note → cell and adds ONLY anchored cells as nodes", () => {
    const notes = [note({ id: "a", title: "AVL", moduleId: "cell-avl" })];
    const cells = [{ id: "cell-avl", title: "C4 · AVL" }, { id: "cell-heaps", title: "C5 · Heaps" }];
    const { nodes, edges } = buildNoteGraph(notes, cells);
    expect(nodes.find((n) => n.id === "cell-avl")).toEqual({ id: "cell-avl", kind: "cell", label: "C4 · AVL" });
    expect(nodes.find((n) => n.id === "cell-heaps")).toBeUndefined(); // not anchored → not in graph
    expect(edges).toContainEqual({ id: "a:a->cell-avl", source: "a", target: "cell-avl", kind: "anchor" });
  });

  it("ignores an anchor to a non-existent cell (honest, no dangling node)", () => {
    const notes = [note({ id: "a", moduleId: "ghost" })];
    const { nodes, edges } = buildNoteGraph(notes, []);
    expect(nodes.every((n) => n.kind === "note")).toBe(true);
    expect(edges).toEqual([]);
  });

  it("dedupes repeated wikilinks", () => {
    const notes = [note({ id: "a", title: "A", links: ["B", "B"] }), note({ id: "b", title: "B" })];
    expect(buildNoteGraph(notes, []).edges.filter((e) => e.kind === "wikilink").length).toBe(1);
  });
});
