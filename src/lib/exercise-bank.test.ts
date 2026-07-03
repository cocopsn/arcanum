import { describe, it, expect } from "vitest";
import { EXERCISE_BANK, bankForModule } from "@/lib/exercise-bank";
import { execCode } from "@/lib/js-runner";
import { deepEqual } from "@/lib/exercise";

const C = { c1: "ca000000-0000-4000-8000-000000000002", c2: "ca000000-0000-4000-8000-000000000003", c3: "ca000000-0000-4000-8000-000000000004", c4: "ca000000-0000-4000-8000-000000000005" };

describe("exercise-bank — Layer 1 curated (self-consistent, rigorous, anchored)", () => {
  it("every JS reference solution PASSES its own test cases — no faked exercise", () => {
    for (const e of EXERCISE_BANK) {
      if (e.kind !== "code" || e.lang !== "js") continue;
      const out = execCode(e.referenceSolution, e.functionName, e.testCases.map((c) => c.input));
      expect("results" in out, `${e.id}: reference parses`).toBe(true);
      if ("results" in out) {
        e.testCases.forEach((c, i) => {
          const r = out.results[i]!;
          expect(r.ok && deepEqual(r.value, c.expected), `${e.id} case ${i} ${JSON.stringify(c.input)} → expected ${JSON.stringify(c.expected)}`).toBe(true);
        });
      }
    }
  });

  it("choice exercises have a valid answer index + a real rationale", () => {
    for (const e of EXERCISE_BANK) {
      if (e.kind !== "choice") continue;
      expect(e.answer, e.id).toBeGreaterThanOrEqual(0);
      expect(e.answer, e.id).toBeLessThan(e.options.length);
      expect(e.rationale.length, e.id).toBeGreaterThan(20);
    }
  });

  it("starters never leak the implementation", () => {
    for (const e of EXERCISE_BANK) {
      if (e.kind !== "code") continue;
      expect(e.starter, e.id).not.toBe(e.referenceSolution);
      expect(e.starter.length, e.id).toBeGreaterThan(0);
    }
  });

  it("covers C1-C4 with test cases that include edge cases (empty/degenerate)", () => {
    for (const cell of Object.values(C)) expect(bankForModule(cell).length, cell).toBeGreaterThan(0);
    // at least one code exercise in the bank carries an empty-collection edge case
    const hasEmptyEdge = EXERCISE_BANK.some((e) => e.kind === "code" && e.testCases.some((c) => Array.isArray(c.input[0]) && (c.input[0] as unknown[]).length === 0));
    expect(hasEmptyEdge).toBe(true);
  });
});
