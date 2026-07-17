import { describe, it, expect } from "vitest";
import { SEED_EVENTS, SEED_GOAL_ID, SEED_MODULE_ID } from "@/lib/seed";
import { SPINES } from "@/lib/spines";
import { project } from "@/core/projector";
import { nodeStatus } from "@/core/roadmap";
import { createDb } from "@/db/schema";
import { appendEvents, getAllEvents } from "@/db/repo";

const totalCells = SPINES.reduce((n, s) => n + s.cells.length, 0);
const totalEdges = SPINES.reduce((n, s) => n + Math.max(0, s.cells.length - 1), 0);

describe("seed — the curricular spines (WHITE ROOM)", () => {
  it("uses fixed UUIDs (stable across imports)", () => {
    expect(SEED_EVENTS.every((e) => e.id.length === 36)).toBe(true);
    expect(SEED_GOAL_ID.length).toBe(36);
    expect(SEED_MODULE_ID.length).toBe(36);
  });

  it("projects to the spine goals, every cell idle, course-order edges, zero XP", () => {
    const rm = project(SEED_EVENTS);
    expect(rm.goals.map((g) => g.title).sort()).toEqual(["Alemán", "Competitiva (ICPC)", "FrED Factory", "ITC"]);
    expect(rm.modules).toHaveLength(totalCells + 1); // + the seeded FrED Operativo entry cell (node 0)
    expect(rm.modules.every((m) => m.status === "idle" && !m.gatePassed)).toBe(true);
    expect(rm.edges).toHaveLength(totalEdges);
    expect(rm.stats.totalXp).toBe(0);
    expect(rm.stats.grade).toBe("Scintilla");
  });

  it("forms a linear DAG per spine: cell 1 available, cell 2 sealed (fog-of-war)", () => {
    const rm = project(SEED_EVENTS);
    const byId = new Map(rm.modules.map((m) => [m.id, m]));
    const status = (id: string) => nodeStatus(byId.get(id)!, rm.edges, byId);
    for (const sp of SPINES) {
      expect(status(sp.cells[0]!.id)).toBe("available"); // ramp cell, no prereq
      if (sp.cells.length > 1) expect(status(sp.cells[1]!.id)).toBe("sealed"); // gated by cell 1
    }
  });

  it("every authored heavy cell (gate OR directed mission) is anchored to a REAL source", () => {
    const heavy = SPINES.flatMap((s) => s.cells).filter((c) => c.gate || c.mission);
    expect(heavy.length).toBeGreaterThan(0);
    for (const c of heavy) {
      expect(c.sourceUrls.some((u) => u.startsWith("http"))).toBe(true); // never invented
      if (c.gate) expect(c.gate.rubric.length).toBeGreaterThan(0);
      if (c.mission) {
        expect(c.mission.assignment.length).toBeGreaterThan(0);
        expect(c.mission.deliverable.length).toBeGreaterThan(0);
      }
    }
  });

  it("the FrED spine is built to depth — 8 heavy mission cells (S1-S4 software / H1-H4 hardware)", () => {
    const fred = SPINES.find((s) => s.goalTitle === "FrED Factory")!;
    expect(fred.cells).toHaveLength(8);
    expect(fred.cells.every((c) => c.mission)).toBe(true);
  });

  it("all three deep spines are built — every Competitiva cell is a heavy pattern mission", () => {
    const comp = SPINES.find((s) => s.goalTitle.startsWith("Competitiva"))!;
    expect(comp.cells.length).toBeGreaterThanOrEqual(7);
    expect(comp.cells.every((c) => c.mission && c.interrogationMode === "pattern")).toBe(true);
    expect(comp.cells.every((c) => c.sourceUrls.some((u) => u.startsWith("http")))).toBe(true);
  });

  it("is idempotent — appending twice does not duplicate", async () => {
    const db = createDb(`seed-${Math.round(performance.now())}-${SEED_EVENTS.length}`);
    try {
      await appendEvents(db, SEED_EVENTS);
      await appendEvents(db, SEED_EVENTS);
      expect(await getAllEvents(db)).toHaveLength(SEED_EVENTS.length);
    } finally {
      await db.delete();
    }
  });
});
