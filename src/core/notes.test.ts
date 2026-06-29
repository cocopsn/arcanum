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
