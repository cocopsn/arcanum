import { describe, it, expect, afterEach } from "vitest";
import { SEED_EVENTS, SEED_GOAL_ID, SEED_MODULE_ID } from "@/lib/seed";
import { project } from "@/core/projector";
import { createDb } from "@/db/schema";
import { appendEvents, getAllEvents } from "@/db/repo";

describe("seed", () => {
  it("uses fixed UUIDs (stable across imports)", () => {
    expect(SEED_EVENTS.every((e) => e.id.length === 36)).toBe(true);
    expect(SEED_EVENTS[0]!.goal_id).toBe(SEED_GOAL_ID);
    expect(SEED_EVENTS[1]!.module_id).toBe(SEED_MODULE_ID);
  });

  it("projects to the ITC goal + one idle module, zero XP", () => {
    const rm = project(SEED_EVENTS);
    expect(rm.goals).toHaveLength(1);
    expect(rm.goals[0]!.title).toBe("ITC");
    expect(rm.modules).toHaveLength(1);
    expect(rm.modules[0]!.status).toBe("idle");
    expect(rm.stats.totalXp).toBe(0);
    expect(rm.stats.grade).toBe("Neophyte");
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
