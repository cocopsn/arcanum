import { describe, it, expect } from "vitest";
import { project } from "@/core/projector";
import { makeEvent } from "@/core/event";

const dev = (ts: number) => ({ ts, deviceId: "d" });
const T = 1_000_000;

describe("notes projection (content reconstructed from the log)", () => {
  it("reconstructs note content; note.updated wins; keeps anchor + createdTs", () => {
    const events = [
      makeEvent("note.created", { note_id: "n1", title: "Árboles", markdown: "borrador" }, { ...dev(T), moduleId: "m1" }),
      makeEvent("note.updated", { note_id: "n1", title: "Árboles binarios", markdown: "# Árboles binarios\nbalanceo" }, dev(T + 10)),
    ];
    const rm = project(events);
    expect(rm.notes).toHaveLength(1);
    const n = rm.notes[0]!;
    expect(n.title).toBe("Árboles binarios");
    expect(n.markdown).toContain("balanceo");
    expect(n.moduleId).toBe("m1");
    expect(n.createdTs).toBe(T);
    expect(n.updatedTs).toBe(T + 10);
  });

  it("derives links and bidirectional backlinks from [[wikilinks]]", () => {
    const events = [
      makeEvent("note.created", { note_id: "a", title: "A", markdown: "enlazo a [[B]] y [[C]]" }, dev(T)),
      makeEvent("note.created", { note_id: "b", title: "B", markdown: "sin enlaces" }, dev(T + 1)),
    ];
    const rm = project(events);
    const a = rm.notes.find((n) => n.id === "a")!;
    const b = rm.notes.find((n) => n.id === "b")!;
    expect(a.links).toEqual(["B", "C"]);
    expect(b.backlinks).toEqual(["a"]); // B is linked from A
    expect(a.backlinks).toEqual([]);
    expect(b.links).toEqual([]);
  });

  it("re-anchors a note to a cell via note.updated.moduleId (reconstructed from the log)", () => {
    const events = [
      makeEvent("note.created", { note_id: "n", title: "AVL", markdown: "x" }, dev(T)), // born loose (no module ref)
      makeEvent("note.updated", { note_id: "n", title: "AVL", markdown: "x", moduleId: "cell-avl" }, dev(T + 5)), // anchor
    ];
    const rm = project(events);
    expect(rm.notes[0]!.moduleId).toBe("cell-avl");
    // detaching is explicit (null), and absence leaves the anchor as-is
    const detached = project([...events, makeEvent("note.updated", { note_id: "n", title: "AVL", markdown: "x", moduleId: null }, dev(T + 8))]);
    expect(detached.notes[0]!.moduleId).toBeNull();
    const untouched = project([...events, makeEvent("note.updated", { note_id: "n", title: "AVL+", markdown: "y" }, dev(T + 9))]);
    expect(untouched.notes[0]!.moduleId).toBe("cell-avl"); // moduleId absent → kept
  });

  it("resolves backlinks case-INSENSITIVELY (matches the graph + navigation)", () => {
    const events = [
      makeEvent("note.created", { note_id: "a", title: "A", markdown: "enlazo a [[Introduction]]" }, dev(T)),
      makeEvent("note.created", { note_id: "b", title: "introduction", markdown: "x" }, dev(T + 1)), // lower-case title
    ];
    const rm = project(events);
    expect(rm.notes.find((n) => n.id === "b")!.backlinks).toEqual(["a"]); // [[Introduction]] → "introduction"
  });

  it("a duplicate/replayed note.created does NOT revert content set by an update (idempotent fold)", () => {
    const events = [
      makeEvent("note.created", { note_id: "n", title: "T", markdown: "borrador" }, dev(T)),
      makeEvent("note.updated", { note_id: "n", title: "T", markdown: "contenido real" }, dev(T + 5)),
      makeEvent("note.created", { note_id: "n", title: "T", markdown: "borrador" }, dev(T + 9)), // stray re-emit
    ];
    const n = project(events).notes[0]!;
    expect(n.markdown).toBe("contenido real"); // the update survives the later create
  });

  it("note.created pays XP only for substantive markdown", () => {
    const rm = project([makeEvent("note.created", { note_id: "n", title: "t", markdown: "x".repeat(140) }, dev(T))]);
    expect(rm.stats.totalXp).toBe(5); // non-qualifying day → mult 1.0
    expect(rm.notes).toHaveLength(1);
  });

  it("is deterministic under permutation (notes included)", () => {
    const events = [
      makeEvent("note.created", { note_id: "a", title: "A", markdown: "[[B]]" }, dev(T)),
      makeEvent("note.created", { note_id: "b", title: "B", markdown: "hola" }, dev(T + 1)),
      makeEvent("note.updated", { note_id: "a", title: "A", markdown: "[[B]] editado" }, dev(T + 2)),
    ];
    const shuffled = [events[2]!, events[0]!, events[1]!];
    expect(project(shuffled)).toEqual(project(events));
  });
});
