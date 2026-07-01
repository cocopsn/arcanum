import { describe, it, expect } from "vitest";
import { LESSON_ANGLES, angleAt, anglesDiffer } from "@/lib/lesson-angles";

describe("lesson-angles — the rotation that makes course/depth/review non-repeating", () => {
  it("index 0 is the first-principle angle (the natural first lesson)", () => {
    expect(angleAt(0)).toBe(LESSON_ANGLES[0]);
  });

  it("CONSECUTIVE indices are always DIFFERENT angles (the review invariant)", () => {
    for (let i = 0; i < 30; i++) expect(anglesDiffer(i, i + 1)).toBe(true);
  });

  it("wraps around the list (total, handles large + negative + non-finite indices)", () => {
    expect(angleAt(LESSON_ANGLES.length)).toBe(LESSON_ANGLES[0]);
    expect(angleAt(LESSON_ANGLES.length + 2)).toBe(LESSON_ANGLES[2]);
    expect(angleAt(-1)).toBe(LESSON_ANGLES[LESSON_ANGLES.length - 1]);
    expect(angleAt(NaN)).toBe(LESSON_ANGLES[0]); // truly total — never undefined
    expect(angleAt(Infinity)).toBe(LESSON_ANGLES[0]);
  });

  it("covers every angle across one full rotation (no dead entries)", () => {
    const seen = new Set(Array.from({ length: LESSON_ANGLES.length }, (_, i) => angleAt(i)));
    expect(seen.size).toBe(LESSON_ANGLES.length);
  });
});
