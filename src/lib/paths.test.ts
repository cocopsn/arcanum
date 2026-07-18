import { describe, it, expect } from "vitest";
import { project } from "@/core/projector";
import { makeEvent, type ArcanumEvent } from "@/core/event";
import { SEED_EVENTS } from "@/lib/seed";
import { SPINES, pathIdForCell } from "@/lib/spines";
import { nodeStatus, isMastered, crossPathEcho } from "@/core/roadmap";
import { buildGateContext, NATURE_STANCE } from "@/lib/gate";
import { resolveCellId } from "@/lib/cell-slugs";

// PATHS — parallel routes inside a goal, each with its OWN cells + fog-of-war. The load-bearing
// invariant: progress NEVER crosses a path. Mastering a concept in path A must not unseal or mark
// anything in path B — the learner re-earns that path's gate (honest spaced repetition, never a
// placebo of mastery not demonstrated there). The cross-path note is context ONLY.

const fred = SPINES.find((s) => s.goalTitle === "FrED Factory")!;
const rm = project(SEED_EVENTS);
const T0 = SEED_EVENTS[SEED_EVENTS.length - 1]!.ts + 10_000;
const dev = (ts: number) => ({ ts, deviceId: "test" });

describe("paths — the seed structure", () => {
  it("FrED declares two paths: Fundamentos (the existing cells) + Operativo (its seeded entry cell)", () => {
    const fredPaths = rm.paths.filter((p) => p.goalId === fred.goalId);
    expect(fredPaths.map((p) => p.slug)).toEqual(["fundamentos", "operativo"]);
    const fundamentos = fredPaths.find((p) => p.slug === "fundamentos")!;
    const operativo = fredPaths.find((p) => p.slug === "operativo")!;
    const cellsIn = (pid: string) => rm.modules.filter((m) => m.pathId === pid);
    // every existing FrED cell was RE-ASSIGNED to Fundamentos — nothing lost
    expect(cellsIn(fundamentos.id)).toHaveLength(fred.cells.length);
    // Operativo now carries the whole ORION track (9 nodes: op-0..op-8) — seeded, appended blocks
    expect(cellsIn(operativo.id)).toHaveLength(9);
  });

  it("the Operativo track: node 0 available + a_mano, the rest sealed behind the chain, all books resolve", () => {
    const operativo = rm.paths.find((p) => p.goalId === fred.goalId && p.slug === "operativo")!;
    const cells = rm.modules.filter((m) => m.pathId === operativo.id);
    expect(cells).toHaveLength(9);
    expect(cells.every((c) => c.nature === "a_mano" && c.kind === "cell")).toBe(true);
    const byId = new Map(rm.modules.map((m) => [m.id, m]));
    const op0 = byId.get("cb000000-0000-4000-8000-000000000009")!;
    const op1 = byId.get("cb000000-0000-4000-8000-00000000000a")!;
    const op8 = byId.get("cb000000-0000-4000-8000-000000000011")!;
    expect(op0.title).toBe("Arquitectura del ORION Bridge");
    expect(nodeStatus(op0, rm.edges, byId)).toBe("available"); // node 0 — no prereq, the path's root
    expect(nodeStatus(op1, rm.edges, byId)).toBe("sealed"); // op-1 gated behind op-0 (fog-of-war climbs)
    expect(nodeStatus(op8, rm.edges, byId)).toBe("sealed"); // op-8 (the tail) gated behind op-7
    // every fred-op-N book (and none is left loose) resolves to its seeded cell → "Leer" on the node
    expect(resolveCellId("fred-op-0-bridge")).toBe(op0.id);
    expect(resolveCellId("fred-op-1-transport")).toBe(op1.id);
    expect(resolveCellId("fred-op-6-modbus-plc")).toBe("cb000000-0000-4000-8000-000000000010");
    expect(resolveCellId("fred-op-8-cv-industrial")).toBe(op8.id);
  });

  it("op-6 slots BETWEEN op-5 and op-7: op-7's gate now includes op-6, and the op-5→op-7 edge is redundant-harmless", () => {
    const byId = new Map(rm.modules.map((m) => [m.id, m]));
    const OP5 = "cb000000-0000-4000-8000-00000000000e";
    const OP6 = "cb000000-0000-4000-8000-000000000010";
    const OP7 = "cb000000-0000-4000-8000-00000000000f";
    const prereqsOf = (to: string) => rm.edges.filter((e) => e.to === to).map((e) => e.from);
    expect(prereqsOf(OP6)).toEqual([OP5]); // op-6 gated behind op-5
    expect(prereqsOf(OP7).sort()).toEqual([OP5, OP6].sort()); // op-7 gated behind BOTH (op-6 subsumes op-5)
  });

  it("the FrED re-assignment is LOSSLESS — titles/kinds survive and every cell has a path", () => {
    for (const cell of fred.cells) {
      const m = rm.modules.find((x) => x.id === cell.id)!;
      expect(m.title).toBe(cell.title);
      expect(m.kind).toBe(cell.mission ? "mission" : "cell");
      expect(m.pathId).toBe(pathIdForCell(fred, cell));
    }
  });

  it("every spine has at least one path and every seeded cell is assigned to one", () => {
    for (const sp of SPINES) {
      expect(rm.paths.filter((p) => p.goalId === sp.goalId).length).toBeGreaterThan(0);
    }
    expect(rm.modules.every((m) => m.pathId !== null)).toBe(true);
    // edges carry the DERIVED path of their source cell
    expect(rm.edges.every((e) => e.pathId !== null)).toBe(true);
  });

  it("a re-upsert that omits pathId never DETACHES the cell (lossless rename)", () => {
    const cell = fred.cells[0]!;
    const events = [...SEED_EVENTS, makeEvent("module.upserted", { title: "renombrada", prereqs: [], kind: "cell" }, { ...dev(T0), goalId: fred.goalId, moduleId: cell.id })];
    const m = project(events).modules.find((x) => x.id === cell.id)!;
    expect(m.title).toBe("renombrada");
    expect(m.pathId).toBe(pathIdForCell(fred, cell)); // still in its path
  });
});

describe("paths — the MIGRATION of an existing log is lossless", () => {
  // an already-live device holds the ORIGINAL seed block (ids b0000000-…) plus real progress. On the next
  // hydrate it receives the appended blocks (paths b1000000-…, operativo b4000000-…). Nothing may be lost.
  // OLD models the TRUE pre-paths state: the original block only.
  const OLD = SEED_EVENTS.filter((e) => e.id.startsWith("b0000000"));
  const PATHS_BLOCK = SEED_EVENTS.filter((e) => e.id.startsWith("b1000000"));
  const cell = fred.cells[0]!;
  const TOLD = OLD[OLD.length - 1]!.ts + 10_000;
  const withProgress: ArcanumEvent[] = [
    ...OLD,
    makeEvent("module.started", {}, { ...dev(TOLD), goalId: fred.goalId, moduleId: cell.id }),
    makeEvent("checkpoint.passed", { score: 1, kind: "checkpoint" }, { ...dev(TOLD + 1), goalId: fred.goalId, moduleId: cell.id }),
    makeEvent("gate.evaluated", { passed: true, score: 1, summary: "ok", feedback: "", source: "ai", provider: "t" }, { ...dev(TOLD + 2), goalId: fred.goalId, moduleId: cell.id }),
  ];

  it("the old block really had no paths (precondition of the migration)", () => {
    const before = project(withProgress);
    expect(before.paths).toHaveLength(0);
    expect(before.modules.every((m) => m.pathId === null)).toBe(true);
  });

  it("after the paths block lands: the cell is RE-ASSIGNED to Fundamentos and its progress SURVIVES", () => {
    const before = project(withProgress);
    const after = project([...withProgress, ...PATHS_BLOCK]);
    const m = after.modules.find((x) => x.id === cell.id)!;
    // re-assigned…
    expect(m.pathId).toBe(pathIdForCell(fred, cell));
    // …and NOTHING was lost: hard-won mastery, status and XP are untouched
    expect(m.gatePassed).toBe(true);
    expect(isMastered(m)).toBe(true);
    expect(m.status).toBe("started");
    expect(m.reinforceCount).toBe(before.modules.find((x) => x.id === cell.id)!.reinforceCount);
    expect(after.stats.totalXp).toBe(before.stats.totalXp);
    expect(after.modules).toHaveLength(before.modules.length); // no phantom duplicates
  });

  it("the migration is IDEMPOTENT — applying the paths block twice changes nothing", () => {
    const once = project([...withProgress, ...PATHS_BLOCK]);
    const twice = project([...withProgress, ...PATHS_BLOCK, ...PATHS_BLOCK]);
    expect(twice.modules).toEqual(once.modules);
    expect(twice.paths).toEqual(once.paths);
    expect(twice.stats.totalXp).toBe(once.stats.totalXp);
  });

  it("the original seed ids were NOT renumbered (an existing log's history stays byte-identical)", () => {
    // every original event keeps its exact id+payload → hydrate sees them as already-present
    expect(OLD.every((e) => e.id.startsWith("b0000000"))).toBe(true);
    expect(PATHS_BLOCK.every((e) => e.id.startsWith("b1000000"))).toBe(true);
    expect(PATHS_BLOCK.length).toBeGreaterThan(0);
  });
});

describe("paths — progress is 100% INDEPENDENT (the load-bearing invariant)", () => {
  // two paths in one goal, each a 2-cell chain over the SAME concept
  const G = "g-sec";
  const PA = "p-auto";
  const PB = "p-comptia";
  const A1 = "a1", A2 = "a2", B1 = "b1", B2 = "b2";
  const base: ArcanumEvent[] = [
    makeEvent("goal.upserted", { title: "Ciberseguridad", priority: 1, color: "#fff", sigil: "x" }, { ...dev(1), goalId: G }),
    makeEvent("path.upserted", { path_id: PA, slug: "autodidacta", name: "Autodidacta", description: "" }, { ...dev(2), goalId: G }),
    makeEvent("path.upserted", { path_id: PB, slug: "comptia", name: "CompTIA Security+", description: "" }, { ...dev(3), goalId: G }),
    makeEvent("module.upserted", { title: "A1 · redes", prereqs: [], kind: "cell", pathId: PA, concept: "redes" }, { ...dev(4), goalId: G, moduleId: A1 }),
    makeEvent("module.upserted", { title: "A2 · cripto", prereqs: [], kind: "cell", pathId: PA, concept: "cripto" }, { ...dev(5), goalId: G, moduleId: A2 }),
    makeEvent("module.upserted", { title: "B1 · redes", prereqs: [], kind: "cell", pathId: PB, concept: "redes" }, { ...dev(6), goalId: G, moduleId: B1 }),
    makeEvent("module.upserted", { title: "B2 · cripto", prereqs: [], kind: "cell", pathId: PB, concept: "cripto" }, { ...dev(7), goalId: G, moduleId: B2 }),
    makeEvent("roadmap.edge.upserted", { from: A1, to: A2 }, { ...dev(8) }),
    makeEvent("roadmap.edge.upserted", { from: B1, to: B2 }, { ...dev(9) }),
  ];
  const pass = (id: string, ts: number) => makeEvent("gate.evaluated", { passed: true, score: 1, summary: "ok", feedback: "", source: "ai", provider: "t" }, { ...dev(ts), goalId: G, moduleId: id });
  const statusOf = (m: ReturnType<typeof project>, id: string) => {
    const byId = new Map(m.modules.map((x) => [x.id, x]));
    return nodeStatus(byId.get(id)!, m.edges, byId);
  };

  it("each path has its OWN fog-of-war: first cell available, second sealed — in BOTH paths", () => {
    const m = project(base);
    expect(statusOf(m, A1)).toBe("available");
    expect(statusOf(m, A2)).toBe("sealed");
    expect(statusOf(m, B1)).toBe("available");
    expect(statusOf(m, B2)).toBe("sealed");
  });

  it("passing the gate in path A unseals ONLY path A — path B stays sealed and unmastered", () => {
    const m = project([...base, pass(A1, 10)]);
    expect(statusOf(m, A2)).toBe("available"); // A advanced
    // …and NOTHING crossed: B1's twin concept is untouched, B2 still sealed
    const byId = new Map(m.modules.map((x) => [x.id, x]));
    expect(isMastered(byId.get(B1)!)).toBe(false);
    expect(byId.get(B1)!.gatePassed).toBe(false);
    expect(statusOf(m, B2)).toBe("sealed"); // the learner must earn THIS path's gate too
  });

  it("a stray CROSS-PATH edge is ignored by the fog-of-war (it can never leak progress)", () => {
    // an edge from a mastered A1 into B2 must NOT unseal B2 — different paths
    const m = project([...base, pass(A1, 10), makeEvent("roadmap.edge.upserted", { from: A1, to: B2 }, { ...dev(11) })]);
    expect(statusOf(m, B2)).toBe("sealed");
  });

  it("the cross-path note APPEARS when the twin concept was mastered elsewhere — but never unlocks", () => {
    const m = project([...base, pass(A1, 10)]);
    const byId = new Map(m.modules.map((x) => [x.id, x]));
    const echo = crossPathEcho(byId.get(B1)!, m.modules, m.paths);
    expect(echo).not.toBeNull();
    expect(echo!.pathName).toBe("Autodidacta"); // "ya lo viste en Autodidacta"
    expect(echo!.moduleTitle).toBe("A1 · redes");
    // it is CONTEXT ONLY — B1 is still not mastered, B2 still sealed, and the echo grants nothing:
    // crossPathEcho is a PURE read over the model, so it cannot move XP or mastery by construction.
    expect(isMastered(byId.get(B1)!)).toBe(false);
    expect(byId.get(B1)!.status).toBe("idle");
    expect(statusOf(m, B2)).toBe("sealed");
  });

  it("no note when the twin concept has NOT been mastered in the other path (nothing invented)", () => {
    const m = project(base); // nothing passed anywhere
    const byId = new Map(m.modules.map((x) => [x.id, x]));
    expect(crossPathEcho(byId.get(B1)!, m.modules, m.paths)).toBeNull();
  });

  it("no note from a cell in the SAME path (the echo is strictly cross-path)", () => {
    // A2 shares no concept with A1; give A1's concept to a same-path twin and master it
    const twin = "a3";
    const m = project([
      ...base,
      makeEvent("module.upserted", { title: "A3 · redes (misma ruta)", prereqs: [], kind: "cell", pathId: PA, concept: "redes" }, { ...dev(12), goalId: G, moduleId: twin }),
      pass(twin, 13),
    ]);
    const byId = new Map(m.modules.map((x) => [x.id, x]));
    expect(crossPathEcho(byId.get(A1)!, m.modules, m.paths)).toBeNull(); // same path → no echo
  });
});

describe("paths — a null-path (legacy/canvas) cell NEVER leaks progress across the migration", () => {
  // the exact defect the review caught: a user-created cell carries pathId:null; if it hangs off a
  // seeded (now path-assigned) cell, the cross-path filter must NOT drop that prereq and unseal it.
  const cell = fred.cells.find((c) => c.mission)!; // a seeded FrED cell that is NOT trivially mastered
  const U = "u-canvas";
  const withNull: ArcanumEvent[] = [
    ...SEED_EVENTS,
    // simulate the OLD roadmap-canvas gesture: module.upserted with NO pathId
    makeEvent("module.upserted", { title: "Mi celda del canvas", prereqs: [], kind: "core" }, { ...dev(T0), goalId: fred.goalId, moduleId: U }),
    makeEvent("roadmap.edge.upserted", { from: cell.id, to: U }, { ...dev(T0 + 1) }),
  ];
  const statusOf = (m: ReturnType<typeof project>, id: string) => {
    const byId = new Map(m.modules.map((x) => [x.id, x]));
    return nodeStatus(byId.get(id)!, m.edges, byId);
  };

  it("the seed cell is path-assigned but the canvas cell is null-path (precondition)", () => {
    const m = project(withNull);
    expect(m.modules.find((x) => x.id === cell.id)!.pathId).not.toBeNull();
    expect(m.modules.find((x) => x.id === U)!.pathId).toBeNull();
  });

  it("the null-path cell stays SEALED while its (unmastered) seed prereq is not mastered — no unearned unseal", () => {
    const m = project(withNull);
    expect(isMastered(m.modules.find((x) => x.id === cell.id)!)).toBe(false);
    expect(statusOf(m, U)).toBe("sealed"); // the leak the review caught would make this "available"
  });

  it("once the seed prereq is genuinely mastered, the null-path cell reveals (gating still works)", () => {
    const m = project([...withNull, makeEvent("mission.submitted", { notes: "x" }, { ...dev(T0 + 2), goalId: fred.goalId, moduleId: cell.id }), makeEvent("gate.evaluated", { passed: true, score: 1, summary: "", feedback: "", source: "ai", provider: "t" }, { ...dev(T0 + 3), goalId: fred.goalId, moduleId: cell.id })]);
    expect(statusOf(m, U)).toBe("available");
  });
});

describe("paths — nature reaches the mission interrogation (not cosmetic)", () => {
  const missionCell = SPINES.flatMap((s) => s.cells).find((c) => c.mission)!;
  it("a delegable mission folds its stance into the assignment the interrogator actually reads", async () => {
    const { buildInterrogationContext } = await import("@/lib/mission");
    const events = [...SEED_EVENTS, makeEvent("module.upserted", { title: missionCell.title, prereqs: [], kind: "mission", nature: "delegable" }, { ...dev(T0), moduleId: missionCell.id })];
    const ctx = buildInterrogationContext(project(events), missionCell.id, "mis notas")!;
    expect(ctx.nature).toBe("delegable");
    expect(ctx.assignment).toContain("NATURALEZA DE LA CELDA");
    expect(ctx.assignment).toContain("DELEGABLE"); // the stance is in the field the Edge interpolates
  });
  it("defaults to a_mano — the interrogation is never silently lightened", async () => {
    const { buildInterrogationContext } = await import("@/lib/mission");
    const ctx = buildInterrogationContext(rm, missionCell.id, "notas")!;
    expect(ctx.nature).toBe("a_mano");
    expect(ctx.assignment).toContain("A MANO");
  });
});

describe("paths — the projector VALIDATES nature/parts (forward-sync safe)", () => {
  it("a garbage nature from a future/foreign payload falls back to a_mano, never reaching the UI", () => {
    const events = [...SEED_EVENTS, makeEvent("module.upserted", { title: "x", prereqs: [], kind: "cell", nature: "sabotaje", parts: "no-array" }, { ...dev(T0), moduleId: "z1" })];
    const m = project(events).modules.find((x) => x.id === "z1")!;
    expect(m.nature).toBe("a_mano");
    expect(m.parts).toEqual([]);
  });
});

describe("paths — creating a new path (the Ciberseguridad case)", () => {
  it("path.upserted materializes a real path, and a cell assigned to it gets its own fog-of-war", () => {
    const G = "g2", P = "p-new";
    const m = project([
      makeEvent("goal.upserted", { title: "Nuevo", priority: 1, color: "#fff", sigil: "x" }, { ...dev(1), goalId: G }),
      makeEvent("path.upserted", { path_id: P, slug: "mi-ruta", name: "Mi ruta", description: "desc", order: 0 }, { ...dev(2), goalId: G }),
      makeEvent("module.upserted", { title: "c1", prereqs: [], kind: "cell", pathId: P }, { ...dev(3), goalId: G, moduleId: "c1" }),
    ]);
    const p = m.paths.find((x) => x.id === P)!;
    expect(p).toMatchObject({ slug: "mi-ruta", name: "Mi ruta", description: "desc", goalId: G, archived: false });
    expect(m.modules.find((x) => x.id === "c1")!.pathId).toBe(P);
  });

  it("a path is ARCHIVED, never deleted (its proven mastery stays in the log)", () => {
    const G = "g3", P = "p3";
    const m = project([
      makeEvent("goal.upserted", { title: "N", priority: 1, color: "#fff", sigil: "x" }, { ...dev(1), goalId: G }),
      makeEvent("path.upserted", { path_id: P, slug: "s", name: "S", description: "" }, { ...dev(2), goalId: G }),
      makeEvent("node.archived", { ref: P }, { ...dev(3) }),
    ]);
    expect(m.paths.find((x) => x.id === P)!.archived).toBe(true);
  });
});

describe("paths — NATURE decides which gate fires (structural, not a label)", () => {
  const gateCell = SPINES.flatMap((s) => s.cells).find((c) => c.gate)!;

  it("'a_mano' fires the full adversarial DEFENCE gate", () => {
    const events = [...SEED_EVENTS, makeEvent("module.upserted", { title: gateCell.title, prereqs: [], kind: "cell", nature: "a_mano" }, { ...dev(T0), moduleId: gateCell.id })];
    const ctx = buildGateContext(project(events), gateCell.id, "mi justificación")!;
    expect(ctx.nature).toBe("a_mano");
    expect(ctx.rubric[0]).toContain("A MANO");
    expect(ctx.rubric.join(" ")).toMatch(/DECISIONES DE DISEÑO|DEFENDERLO/);
    expect(ctx.rubric.join(" ")).not.toMatch(/DELEGABLE/);
  });

  it("'delegable' fires the lighter COMPREHENSION gate (direct + audit an assistant)", () => {
    const events = [...SEED_EVENTS, makeEvent("module.upserted", { title: gateCell.title, prereqs: [], kind: "cell", nature: "delegable" }, { ...dev(T0), moduleId: gateCell.id })];
    const ctx = buildGateContext(project(events), gateCell.id, "mi justificación")!;
    expect(ctx.nature).toBe("delegable");
    expect(ctx.rubric[0]).toContain("DELEGABLE");
    expect(ctx.rubric.join(" ")).toMatch(/AUDITAR/);
    // it must NOT demand from-scratch implementation — that's the whole point
    expect(ctx.rubric.join(" ")).toMatch(/NO penalices delegar/);
  });

  it("'mixto' spells out each sub-part's nature to the evaluator", () => {
    const events = [...SEED_EVENTS, makeEvent("module.upserted", { title: gateCell.title, prereqs: [], kind: "cell", nature: "mixto", parts: [{ name: "ingesta", nature: "delegable" }, { name: "loop de confianza", nature: "a_mano" }] }, { ...dev(T0), moduleId: gateCell.id })];
    const ctx = buildGateContext(project(events), gateCell.id, "x")!;
    expect(ctx.nature).toBe("mixto");
    const joined = ctx.rubric.join(" ");
    expect(joined).toContain("«ingesta» → DELEGABLE");
    expect(joined).toContain("«loop de confianza» → A MANO");
  });

  it("the cell's OWN rubric still rides after the nature stance (nature reshapes, never replaces)", () => {
    const ctx = buildGateContext(rm, gateCell.id, "x")!;
    for (const line of gateCell.gate!.rubric) expect(ctx.rubric).toContain(line);
  });

  it("defaults to 'a_mano' — a gate is never silently lightened", () => {
    expect(rm.modules.every((m) => m.nature === "a_mano" || m.nature === "delegable" || m.nature === "mixto")).toBe(true);
    const ctx = buildGateContext(rm, gateCell.id, "x")!;
    expect(ctx.nature).toBe("a_mano");
    expect(NATURE_STANCE.a_mano.label).toBe("A mano");
  });
});
