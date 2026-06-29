import { describe, it, expect } from "vitest";
import { scoreQuiz } from "@/lib/quiz";
import type { QuizQuestion } from "@/lib/subject-content";

const q = (answer: number): QuizQuestion => ({ prompt: "p", options: ["a", "b", "c"], answer, rationale: "r" });

describe("scoreQuiz", () => {
  const qs = [q(0), q(1), q(2)];

  it("all correct → score 1", () => {
    expect(scoreQuiz(qs, [0, 1, 2])).toEqual({ correct: 3, total: 3, score: 1 });
  });
  it("partial → fraction", () => {
    expect(scoreQuiz(qs, [0, 9, 2]).score).toBeCloseTo(2 / 3, 6);
  });
  it("unanswered (null) counts as wrong", () => {
    expect(scoreQuiz(qs, [0, null, null])).toMatchObject({ correct: 1, total: 3 });
  });
  it("empty quiz → score 0, never NaN", () => {
    expect(scoreQuiz([], [])).toEqual({ correct: 0, total: 0, score: 0 });
  });
});
