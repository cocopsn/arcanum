import { describe, it, expect } from "vitest";
import { execCode, runJs, WORKER_SHIELD } from "@/lib/js-runner";
import { evaluateRun } from "@/lib/exercise";

describe("js-runner — offline execution (Level 1 syntax, Level 2 correctness)", () => {
  it("execCode runs a correct function against inputs", () => {
    const out = execCode("function reverse(a){ return [...a].reverse(); }", "reverse", [[[1, 2, 3]]]);
    expect("results" in out && out.results[0]).toEqual({ ok: true, value: [3, 2, 1] });
  });

  it("execCode surfaces the REAL SyntaxError (Level 1), never a faked one", () => {
    const out = execCode("function f(){ return ; ; ) }", "f", [[]]);
    expect("syntaxError" in out && out.syntaxError).toMatch(/SyntaxError|Error/);
  });

  it("execCode reports 'function not found' when the required name isn't defined", () => {
    const out = execCode("const x = 1;", "solve", [[]]);
    expect("syntaxError" in out && out.syntaxError).toMatch(/No se encontró la función/);
  });

  it("execCode captures a per-case runtime error without crashing the run", () => {
    const out = execCode("function f(x){ return x.nope.deep; }", "f", [[null]]);
    expect("results" in out && out.results[0]).toMatchObject({ ok: false });
  });

  it("runJs end-to-end: passes the correct cases, fails with the exact case", async () => {
    const cases = [
      { input: [[1, 2, 3]], expected: [3, 2, 1] },
      { input: [[]], expected: [] },
      { input: [[5]], expected: [5] },
    ];
    const good = await runJs("function reverse(a){ return [...a].reverse(); }", "reverse", cases);
    expect(evaluateRun(good).allPass).toBe(true);

    const buggy = await runJs("function reverse(a){ return a; }", "reverse", cases); // identity — fails non-trivial
    const ev = evaluateRun(buggy);
    expect(ev.allPass).toBe(false);
    expect(ev.firstFail?.input).toEqual([[1, 2, 3]]); // the exact failing evidence
  });

  it("runJs returns the real syntax error for un-parseable code", async () => {
    const r = await runJs("function f({ ", "f", [{ input: [], expected: 1 }]);
    expect(r.syntaxError).toBeTruthy();
    expect(r.cases).toHaveLength(0);
  });

  it("WORKER_SHIELD neutralizes storage/network globals so learner code can't reach the event log", () => {
    // the SAME shield string that runs at the top of the real Blob Worker, applied to a fake global scope
    const fakeSelf: Record<string, unknown> = {
      indexedDB: { deleteDatabase: () => "boom" },
      caches: {},
      fetch: () => "exfil",
      XMLHttpRequest: function () {},
      WebSocket: function () {},
      importScripts: () => {},
      localStorage: {},
      sessionStorage: {},
      postMessage: () => "ok", // the messaging channel MUST survive
    };
    // eslint-disable-next-line no-new-func
    new Function("self", WORKER_SHIELD)(fakeSelf);
    for (const k of ["indexedDB", "caches", "fetch", "XMLHttpRequest", "WebSocket", "importScripts", "localStorage", "sessionStorage"]) {
      expect(fakeSelf[k], `${k} must be neutralized`).toBeUndefined();
    }
    expect(typeof fakeSelf.postMessage).toBe("function"); // runner still posts results back
  });
});
