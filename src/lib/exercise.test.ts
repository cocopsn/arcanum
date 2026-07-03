import { describe, it, expect } from "vitest";
import { deepEqual, formatValue, evaluateRun, matchedPatterns, type RunResult } from "@/lib/exercise";

describe("exercise — pure comparison + evaluation", () => {
  it("deepEqual handles primitives, NaN, nested arrays, objects", () => {
    expect(deepEqual([1, [2, 3]], [1, [2, 3]])).toBe(true);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual(NaN, NaN)).toBe(true);
    expect(deepEqual({ a: 1, b: [2] }, { b: [2], a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual("x", "x")).toBe(true);
  });

  it("evaluateRun: all pass, else the FIRST failing case is the evidence", () => {
    const r: RunResult = { syntaxError: null, cases: [
      { input: [1], expected: 1, output: 1, pass: true },
      { input: [2], expected: 4, output: 3, pass: false },
      { input: [3], expected: 9, output: 5, pass: false },
    ] };
    const ev = evaluateRun(r);
    expect(ev.allPass).toBe(false);
    expect(ev.firstFail?.input).toEqual([2]); // the EXACT case to show
  });

  it("evaluateRun: a syntax error or timeout is never a pass (no placebo)", () => {
    expect(evaluateRun({ syntaxError: "SyntaxError: x", cases: [] }).allPass).toBe(false);
    expect(evaluateRun({ syntaxError: null, cases: [], timedOut: true }).allPass).toBe(false);
    expect(evaluateRun({ syntaxError: null, cases: [] }).allPass).toBe(false); // no cases → not a pass
  });

  it("matchedPatterns returns only SAVED patterns that match (empty = heuristic has nothing → show solution)", () => {
    const patterns = [{ test: "for\\s*\\(", message: "un método nativo es más idiomático que el loop" }];
    expect(matchedPatterns("for (let i=0;...)", patterns)).toEqual(["un método nativo es más idiomático que el loop"]);
    expect(matchedPatterns("arr.map(x=>x)", patterns)).toEqual([]);
    expect(matchedPatterns("code", [{ test: "(", message: "bad regex" }])).toEqual([]); // malformed skipped
  });

  it("formatValue renders evidence readably", () => {
    expect(formatValue([1, 2])).toBe("[1,2]");
    expect(formatValue(undefined)).toBe("undefined");
    expect(formatValue(NaN)).toBe("NaN");
  });
});
