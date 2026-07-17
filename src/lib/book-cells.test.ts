import { describe, it, expect } from "vitest";
import { deriveBookCellEvents, spineToGoalId, resolvePathId } from "@/lib/book-cells";
import { allBookMd } from "@/lib/all-books";
import { SPINES } from "@/lib/spines";
import { project } from "@/core/projector";
import { SEED_EVENTS } from "@/lib/seed";
import { nodeStatus } from "@/core/roadmap";
import { saveBook } from "@/lib/book-store";
import { getBookForModule } from "@/lib/book-store";

const FRED = "a0000000-0000-4000-8000-000000000002";
const OPERATIVO = "a1000000-0000-4000-8000-000000000003";
const FUNDAMENTOS = "a1000000-0000-4000-8000-000000000002";
const EXISTING_FRED_CELL = "cb000000-0000-4000-8000-000000000001";
const TS = 1_800_000_000_000;

// a folder book .md (fence-free frontmatter builder)
const book = (fm: Record<string, string>) =>
  ["---", ...Object.entries(fm).map(([k, v]) => `${k}: ${v}`), "---", "", "> pregunta raíz", "", "## Núcleo", "cuerpo real de la lectura."].join("\n");

describe("book-cells — folder ingestion derives path-aware cells", () => {
  it("resolves spine → goal (tolerant) and path slug → the real pathId (default when absent)", () => {
    expect(spineToGoalId("FrED", SPINES)).toBe(FRED);
    expect(spineToGoalId("Aleman", SPINES)).toBe("a0000000-0000-4000-8000-000000000003");
    expect(spineToGoalId("nope", SPINES)).toBeNull();
    expect(resolvePathId(FRED, "operativo", SPINES)).toBe(OPERATIVO); // closes the path-aware debt
    expect(resolvePathId(FRED, null, SPINES)).toBe(FUNDAMENTOS); // default = first path, no regression
    expect(resolvePathId(FRED, "no-existe", SPINES)).toBe(FUNDAMENTOS); // unknown slug → default
  });

  it("a NEW module_id creates the cell anchored to spine's goal + declared path + nature", () => {
    const M = "cc000000-0000-4000-8000-0000000000a1";
    const events = deriveBookCellEvents([book({ module_id: M, spine: "FrED", path: "operativo", nature: "delegable", title: "Orión · ingesta" })], SPINES, TS, "seed");
    const up = events.find((e) => e.type === "module.upserted")!;
    expect(up.module_id).toBe(M);
    expect(up.goal_id).toBe(FRED);
    const p = up.payload as Record<string, unknown>;
    expect(p.pathId).toBe(OPERATIVO);
    expect(p.nature).toBe("delegable");
    // project the whole thing → the cell lands in Operativo with that nature
    const rm = project([...SEED_EVENTS, ...events]);
    const m = rm.modules.find((x) => x.id === M)!;
    expect(m.pathId).toBe(OPERATIVO);
    expect(m.nature).toBe("delegable");
    expect(m.title).toBe("Orión · ingesta");
  });

  it("an EXISTING seed cell is NOT re-created (anchored via the reader, no duplicate cell)", () => {
    const events = deriveBookCellEvents([book({ module_id: EXISTING_FRED_CELL, spine: "FrED", title: "libro para S1" })], SPINES, TS, "seed");
    expect(events.filter((e) => e.type === "module.upserted")).toHaveLength(0);
    // and the seed cell count is unchanged
    const rm = project([...SEED_EVENTS, ...events]);
    expect(rm.modules.filter((m) => m.id === EXISTING_FRED_CELL)).toHaveLength(1);
  });

  it("explicit prereq → a DAG edge; the new cell is SEALED until the prereq is mastered (fog-of-war)", () => {
    const A = "cc000000-0000-4000-8000-0000000000b1";
    const B = "cc000000-0000-4000-8000-0000000000b2";
    const events = deriveBookCellEvents(
      [book({ module_id: A, spine: "FrED", path: "operativo", title: "A" }), book({ module_id: B, spine: "FrED", path: "operativo", prereq: A, title: "B" })],
      SPINES, TS, "seed",
    );
    expect(events.some((e) => e.type === "roadmap.edge.upserted" && (e.payload as { from: string }).from === A && (e.payload as { to: string }).to === B)).toBe(true);
    const rm = project([...SEED_EVENTS, ...events]);
    const byId = new Map(rm.modules.map((m) => [m.id, m]));
    expect(nodeStatus(byId.get(A)!, rm.edges, byId)).toBe("available"); // root of the path
    expect(nodeStatus(byId.get(B)!, rm.edges, byId)).toBe("sealed"); // gated behind A
  });

  it("order (no prereq) chains cells within a path in sequence", () => {
    const C1 = "cc000000-0000-4000-8000-0000000000c1";
    const C2 = "cc000000-0000-4000-8000-0000000000c2";
    const C3 = "cc000000-0000-4000-8000-0000000000c3";
    const events = deriveBookCellEvents(
      [book({ module_id: C3, spine: "FrED", path: "operativo", order: "3", title: "C3" }), book({ module_id: C1, spine: "FrED", path: "operativo", order: "1", title: "C1" }), book({ module_id: C2, spine: "FrED", path: "operativo", order: "2", title: "C2" })],
      SPINES, TS, "seed",
    );
    const edges = events.filter((e) => e.type === "roadmap.edge.upserted").map((e) => e.payload as { from: string; to: string });
    expect(edges).toContainEqual({ from: C1, to: C2 });
    expect(edges).toContainEqual({ from: C2, to: C3 });
    expect(edges.some((e) => e.from === C3)).toBe(false); // last has no outgoing chain edge
  });

  it("is IDEMPOTENT — deriving the same folder twice yields identical event ids (hydrate dedupes)", () => {
    const md = [book({ module_id: "cc000000-0000-4000-8000-0000000000d1", spine: "FrED", path: "operativo", order: "1", title: "D1" })];
    const a = deriveBookCellEvents(md, SPINES, TS, "seed").map((e) => e.id);
    const b = deriveBookCellEvents(md, SPINES, TS, "seed").map((e) => e.id);
    expect(a).toEqual(b);
    expect(a[0]!.length).toBe(36); // UUID-shaped (the seed test invariant)
  });

  it("absent path → the goal's DEFAULT path (no regression); unknown spine → no cell (book still readable)", () => {
    const M = "cc000000-0000-4000-8000-0000000000e1";
    const def = deriveBookCellEvents([book({ module_id: M, spine: "FrED", title: "sin path" })], SPINES, TS, "seed");
    expect((def.find((e) => e.type === "module.upserted")!.payload as Record<string, unknown>).pathId).toBe(FUNDAMENTOS);
    const unknown = deriveBookCellEvents([book({ module_id: "cc000000-0000-4000-8000-0000000000e2", spine: "Marte", title: "x" })], SPINES, TS, "seed");
    expect(unknown.filter((e) => e.type === "module.upserted")).toHaveLength(0);
  });

  it("N books → N distinct cells, all with unique deterministic ids", () => {
    const md = Array.from({ length: 5 }, (_, i) => book({ module_id: `cc000000-0000-4000-8000-0000000000f${i}`, spine: "FrED", path: "operativo", title: `libro ${i}` }));
    const cells = deriveBookCellEvents(md, SPINES, TS, "seed").filter((e) => e.type === "module.upserted");
    expect(cells).toHaveLength(5);
    expect(new Set(cells.map((e) => e.id)).size).toBe(5); // no id collisions
  });

  it("spine resolution is whole-WORD, not substring — garbage/typo spines fail safe to no goal", () => {
    const COMPETITIVA = "a0000000-0000-4000-8000-000000000004";
    expect(spineToGoalId("icpc", SPINES)).toBe(COMPETITIVA); // exact sigil
    expect(spineToGoalId("competitiva", SPINES)).toBe(COMPETITIVA); // whole-word title prefix
    expect(spineToGoalId("a", SPINES)).toBeNull(); // a mid-string substring must NOT mis-anchor
    expect(spineToGoalId("it", SPINES)).toBeNull(); // "it" is a partial of "itc" → no cell, not a wrong anchor
  });

  it("a non-UUID module_id derives NO cell (junk anchor rejected; the book still reads via Dexie)", () => {
    const events = deriveBookCellEvents([book({ module_id: "junk-id", spine: "FrED", path: "operativo", title: "malo" })], SPINES, TS, "seed");
    expect(events.filter((e) => e.type === "module.upserted")).toHaveLength(0);
  });

  it("a prereq pointing at an unknown id creates no edge (addEdge guards on known endpoints)", () => {
    const M = "cc000000-0000-4000-8000-0000000000c9";
    const events = deriveBookCellEvents([book({ module_id: M, spine: "FrED", path: "operativo", prereq: "cc000000-0000-4000-8000-000000000999", title: "x" })], SPINES, TS, "seed");
    expect(events.filter((e) => e.type === "roadmap.edge.upserted")).toHaveLength(0);
  });

  it("equal-order cells chain DETERMINISTICALLY by code point (locale-independent DAG across devices)", () => {
    const A = "cc000000-0000-4000-8000-0000000000a1";
    const B = "cc000000-0000-4000-8000-0000000000a2";
    // declared in reverse file order, SAME order value → the chain must still be A→B (code-point tiebreak,
    // never localeCompare, so two synced devices derive the identical edge).
    const events = deriveBookCellEvents(
      [book({ module_id: B, spine: "FrED", path: "operativo", order: "1", title: "B" }), book({ module_id: A, spine: "FrED", path: "operativo", order: "1", title: "A" })],
      SPINES, TS, "seed",
    );
    const edges = events.filter((e) => e.type === "roadmap.edge.upserted").map((e) => e.payload as { from: string; to: string });
    expect(edges).toContainEqual({ from: A, to: B });
  });
});

describe("book-cells — the folder bundle + offline persistence", () => {
  it("allBookMd() is empty under vitest (no webpack) so the seed stays byte-identical in tests", () => {
    expect(allBookMd()).toEqual([]);
  });

  it("a folder book persists in the offline reader store, anchored by module_id", async () => {
    const M = "cc000000-0000-4000-8000-0000000000ff";
    const md = book({ module_id: M, spine: "FrED", path: "operativo", title: "Libro offline" });
    const saved = await saveBook(md, "seed");
    expect(saved).not.toBeNull();
    const got = await getBookForModule(M);
    expect(got).not.toBeNull();
    expect(got!.title).toBe("Libro offline");
    expect(got!.moduleId).toBe(M); // readable offline, anchored to its cell
  });
});
