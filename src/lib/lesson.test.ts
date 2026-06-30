import { describe, it, expect } from "vitest";
import { buildLessonContext, buildLessonGradeContext } from "@/lib/lesson";
import { project } from "@/core/projector";
import { makeEvent } from "@/core/event";
import { SEED_EVENTS } from "@/lib/seed";
import { SPINES } from "@/lib/spines";

const rm = project(SEED_EVENTS);
const fred = SPINES.find((s) => s.goalTitle === "FrED Factory")!;
const s2 = fred.cells.find((c) => c.title.startsWith("S2"))!;

describe("buildLessonContext (Capa B — on-demand light lesson)", () => {
  it("anchors a light lesson to the cell's REAL source (never invents)", () => {
    const ctx = buildLessonContext(rm, s2.id)!;
    expect(ctx.cellTitle).toContain("S2");
    expect(ctx.sourceRefs.some((u) => u.startsWith("http"))).toBe(true);
  });

  it("returns null for a module with no real source (nothing honest to teach against)", () => {
    const ev = makeEvent("module.upserted", { title: "No source", prereqs: [], kind: "core" }, { ts: 1, deviceId: "d", goalId: "g", moduleId: "no-src" });
    const rm2 = project([ev]);
    expect(buildLessonContext(rm2, "no-src")).toBeNull();
  });
});

describe("buildLessonGradeContext", () => {
  it("trims the learner's answer", () => {
    const c = buildLessonGradeContext("S2", "reto", ["r1"], "  mi respuesta  ");
    expect(c.answer).toBe("mi respuesta");
    expect(c.rubric).toEqual(["r1"]);
  });
});
