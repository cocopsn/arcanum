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

  // 🔴 This test models the REAL Worker shape: storage/network globals are INHERITED ACCESSORS on the
  // prototype chain, not own data properties. The previous version applied the shield to a flat object
  // (own properties) — where a plain shadow trivially "works" — and so it passed while the shipped shield
  // was bypassable in ONE LINE (`delete self.indexedDB` restored the native accessor; the proto getter
  // reached it even without deleting). An adversarial audit proved the escape in a real Chrome Worker.
  // A test that can't fail the way production fails is a false green: this one reproduces both vectors.
  function fakeWorkerScope(): Record<string, unknown> {
    const live = {
      indexedDB: { deleteDatabase: () => "boom", open: () => "IDBOpenDBRequest" },
      caches: {},
      fetch: () => "exfil",
      XMLHttpRequest: function () {},
      WebSocket: function () {},
      EventSource: function () {},
      BroadcastChannel: function () {},
      importScripts: () => {},
      navigator: { userAgent: "x" },
      localStorage: {},
      sessionStorage: {},
    } as Record<string, unknown>;
    // the prototype owns them as GETTERS (this is what WorkerGlobalScope.prototype actually looks like)
    const proto: Record<string, unknown> = {};
    for (const k of Object.keys(live)) {
      Object.defineProperty(proto, k, { get: () => live[k], configurable: true });
    }
    const scope = Object.create(proto) as Record<string, unknown>;
    scope.postMessage = () => "ok"; // the messaging channel MUST survive (own property, not shielded)
    return scope;
  }

  const SHIELDED = ["indexedDB", "caches", "fetch", "XMLHttpRequest", "WebSocket", "EventSource", "BroadcastChannel", "importScripts", "navigator", "localStorage", "sessionStorage"];

  it("WORKER_SHIELD neutralizes storage/network globals so learner code can't reach the event log", () => {
    const scope = fakeWorkerScope();
    // eslint-disable-next-line no-new-func
    new Function("self", WORKER_SHIELD)(scope);
    for (const k of SHIELDED) expect(scope[k], `${k} must be neutralized`).toBeUndefined();
    expect(typeof scope.postMessage).toBe("function"); // runner still posts results back
  });

  it("the shield SURVIVES `delete self.<global>` — the one-line escape the audit proved (regression)", () => {
    const scope = fakeWorkerScope();
    // eslint-disable-next-line no-new-func
    new Function("self", WORKER_SHIELD)(scope);
    // learner code trying the documented bypass
    for (const k of SHIELDED) {
      // eslint-disable-next-line no-new-func
      new Function("self", "k", "try{delete self[k];}catch(_e){}")(scope, k);
      expect(scope[k], `${k} came back after delete — the shadow was configurable`).toBeUndefined();
    }
    // …and the same via a direct re-assignment
    for (const k of SHIELDED) {
      // eslint-disable-next-line no-new-func
      new Function("self", "k", "try{self[k]=1;}catch(_e){}")(scope, k);
      expect(scope[k], `${k} was writable`).toBeUndefined();
    }
  });

  it("the shield closes the PROTOTYPE getter too (reaching past `self` must not work)", () => {
    const scope = fakeWorkerScope();
    // eslint-disable-next-line no-new-func
    new Function("self", WORKER_SHIELD)(scope);
    for (const k of SHIELDED) {
      const proto = Object.getPrototypeOf(scope) as Record<string, unknown>;
      expect(proto[k], `${k} still reachable through the prototype getter`).toBeUndefined();
    }
  });
});
