import { describe, it, expect } from "vitest";
import { buildLessonContext, buildLessonGradeContext, normalizeLessonCourse } from "@/lib/lesson";
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

describe("buildLessonContext (step-by-step) carries the config step bounds", () => {
  it("includes stepsMin/stepsMax so the count lives in config, not the prompt", () => {
    const ctx = buildLessonContext(rm, s2.id)!;
    expect(ctx.stepsMin).toBeGreaterThan(0);
    expect(ctx.stepsMax).toBeGreaterThanOrEqual(ctx.stepsMin);
  });
});

describe("buildLessonGradeContext", () => {
  it("trims the learner's answer", () => {
    const c = buildLessonGradeContext("S2", "reto", ["r1"], "  mi respuesta  ");
    expect(c.answer).toBe("mi respuesta");
    expect(c.rubric).toEqual(["r1"]);
  });
});

describe("normalizeLessonCourse (the single trusted wire-shape point)", () => {
  it("accepts a concept + well-formed steps, dropping malformed ones", () => {
    const c = normalizeLessonCourse({
      concept: "  El concepto  ",
      steps: [
        { prompt: " reto 1 ", rubric: ["a", 2] },
        { prompt: "", rubric: [] }, // dropped — empty prompt
        { prompt: "reto 2" }, // rubric defaults to []
        { nope: true }, // dropped
      ],
    })!;
    expect(c.concept).toBe("El concepto");
    expect(c.steps.map((s) => s.prompt)).toEqual(["reto 1", "reto 2"]);
    expect(c.steps[0]!.rubric).toEqual(["a", "2"]);
    expect(c.steps[1]!.rubric).toEqual([]);
  });

  it("returns null when there is no concept or no usable step (degrade honestly, no invented lesson)", () => {
    expect(normalizeLessonCourse({ concept: "", steps: [{ prompt: "x", rubric: [] }] })).toBeNull();
    expect(normalizeLessonCourse({ concept: "hay concepto", steps: [] })).toBeNull();
    expect(normalizeLessonCourse({ concept: "c", steps: [{ prompt: "" }] })).toBeNull();
    expect(normalizeLessonCourse(null)).toBeNull();
    expect(normalizeLessonCourse("nope")).toBeNull();
  });
});
