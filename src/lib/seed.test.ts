import { describe, it, expect, afterEach } from "vitest";
import { SEED_EVENTS, SEED_GOAL_ID, SEED_MODULE_ID } from "@/lib/seed";
import { project } from "@/core/projector";
import { nodeStatus } from "@/core/roadmap";
import { createDb } from "@/db/schema";
import { appendEvents, getAllEvents } from "@/db/repo";

describe("seed", () => {
  it("uses fixed UUIDs (stable across imports)", () => {
    expect(SEED_EVENTS.every((e) => e.id.length === 36)).toBe(true);
    expect(SEED_GOAL_ID.length).toBe(36);
    expect(SEED_MODULE_ID.length).toBe(36);
  });

  it("projects to 3 goals, 7 idle modules, 4 prereq edges, zero XP", () => {
    const rm = project(SEED_EVENTS);
    expect(rm.goals.map((g) => g.title).sort()).toEqual(["Alemán", "FrED Factory", "ITC"]);
    expect(rm.modules).toHaveLength(7);
    expect(rm.modules.every((m) => m.status === "idle")).toBe(true);
    expect(rm.edges).toHaveLength(4);
    expect(rm.stats.totalXp).toBe(0);
    expect(rm.stats.grade).toBe("Scintilla");
  });

  it("forms a DAG: roots available, downstream sealed (fog-of-war)", () => {
    const rm = project(SEED_EVENTS);
    const byId = new Map(rm.modules.map((m) => [m.id, m]));
    const status = (title: string) => {
      const m = rm.modules.find((x) => x.title === title)!;
      return nodeStatus(m, rm.edges, byId);
    };
    expect(status("Estructuras de datos: fundamentos")).toBe("available"); // root
    expect(status("Árboles balanceados")).toBe("sealed"); // prereq not met
    expect(status("Grafos y rutas")).toBe("sealed");
    expect(status("Prototipado rápido")).toBe("available"); // root
    expect(status("Manufactura aditiva")).toBe("sealed");
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
