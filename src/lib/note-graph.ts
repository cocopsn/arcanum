import type { NoteRM } from "@/core/read-model";

// The notes graph — DERIVED (pure) from the notes + the cells they anchor to. Two edge kinds:
//   wikilink  note → note   ([[Title]] resolved to a note by title)
//   anchor    note → cell   (note.moduleId — knowledge tied to the learning cell)
// Nodes are every note + every cell that at least one note anchors to. No fog-of-war: the notes graph
// is its own territory. Pure (no clock, no I/O) → testable; the view just lays this out.

export interface GraphNode {
  id: string;
  kind: "note" | "cell";
  label: string;
}
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: "wikilink" | "anchor";
}

export interface NoteGraphCell {
  id: string;
  title: string;
}

export function buildNoteGraph(notes: NoteRM[], cells: NoteGraphCell[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const cellById = new Map(cells.map((c) => [c.id, c]));
  const titleToId = new Map<string, string>();
  for (const n of notes) titleToId.set(n.title.trim().toLowerCase(), n.id); // last wins on clash

  const nodes: GraphNode[] = notes.map((n) => ({ id: n.id, kind: "note", label: n.title || "(sin título)" }));
  const usedCells = new Set<string>();
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  for (const n of notes) {
    // note → note (wikilinks)
    for (const target of n.links) {
      const targetId = titleToId.get(target.trim().toLowerCase());
      if (!targetId || targetId === n.id) continue;
      const key = `w:${n.id}->${targetId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ id: key, source: n.id, target: targetId, kind: "wikilink" });
    }
    // note → cell (anchor)
    if (n.moduleId && cellById.has(n.moduleId)) {
      usedCells.add(n.moduleId);
      const key = `a:${n.id}->${n.moduleId}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push({ id: key, source: n.id, target: n.moduleId, kind: "anchor" });
      }
    }
  }

  for (const cellId of usedCells) {
    const c = cellById.get(cellId)!;
    nodes.push({ id: c.id, kind: "cell", label: c.title });
  }

  return { nodes, edges };
}
