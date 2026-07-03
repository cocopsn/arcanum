import { deepEqual, type CaseResult, type RunResult, type TestCase } from "@/lib/exercise";

// Offline JS execution. The learner's code runs in an ISOLATED Web Worker with a TIMEOUT that TERMINATES
// a runaway (infinite loop / unbounded recursion) so the app never hangs. A dedicated Worker is fresh of
// the DOM/window/Zustand store, BUT it still shares the page ORIGIN — so it would expose self.indexedDB /
// caches / fetch and could read or WIPE Arcanum's IndexedDB event log, or exfiltrate. WORKER_SHIELD nulls
// those globals BEFORE any learner code runs (the JS runner needs none of them) → learner code truly can't
// reach the log or the network. Failing without fear is the point. Level 1 = the REAL SyntaxError from
// `new Function`; Level 2 = deepEqual against the saved cases (main thread, shared + tested). Zero network.

const errStr = (err: unknown): string => {
  const e = err as { name?: string; message?: string };
  return e && e.message ? `${e.name ?? "Error"}: ${e.message}` : String(err);
};

// normalize an output so it survives structured-clone / comparison (functions → their string form)
function cloneable(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  const t = typeof v;
  if (t === "number" || t === "string" || t === "boolean") return v;
  if (Array.isArray(v)) return v.map(cloneable);
  if (t === "object") {
    const o: Record<string, unknown> = {};
    for (const k in v as object) if (Object.prototype.hasOwnProperty.call(v, k)) o[k] = cloneable((v as Record<string, unknown>)[k]);
    return o;
  }
  return String(v);
}

/** The core: define the learner's function via `new Function` (a fresh scope) and run each input.
 *  Returns Level-1 syntax error OR the per-input outputs. Pure/synchronous → unit-testable in Node
 *  (the Worker inlines the same shape for isolation + timeout). */
export function execCode(code: string, functionName: string, inputs: unknown[][]): { syntaxError: string } | { results: ({ ok: true; value: unknown } | { ok: false; error: string })[] } {
  let fn: unknown;
  try {
    fn = new Function(`${code}\n;return typeof ${functionName} === "function" ? ${functionName} : undefined;`)();
  } catch (err) {
    return { syntaxError: errStr(err) };
  }
  if (typeof fn !== "function") {
    return { syntaxError: `No se encontró la función «${functionName}». Defínela con ese nombre exacto.` };
  }
  const results = inputs.map((args) => {
    try {
      return { ok: true as const, value: cloneable((fn as (...a: unknown[]) => unknown)(...args)) };
    } catch (err) {
      return { ok: false as const, error: errStr(err) };
    }
  });
  return { results };
}

/** Neutralize same-origin storage + network globals BEFORE any learner code runs. A Web Worker shares the
 *  page origin, so without this a learner's code could reach self.indexedDB and read/delete the Arcanum
 *  event log, or exfiltrate via fetch. The JS runner needs none of these. Exported so a test can assert it. */
export const WORKER_SHIELD =
  "['indexedDB','caches','fetch','XMLHttpRequest','WebSocket','importScripts','navigator','Notification','openDatabase','localStorage','sessionStorage'].forEach(function(k){try{Object.defineProperty(self,k,{value:undefined,configurable:true,writable:true});}catch(_e){try{self[k]=undefined;}catch(_e2){}}});";

// The Worker body — self-contained (blob); runs the SHIELD first, then the SAME exec shape as execCode.
const WORKER_SRC = `
${WORKER_SHIELD}
self.onmessage = function (e) {
  var d = e.data, fn;
  function cloneable(v){ if(v===null||v===undefined)return v; var t=typeof v; if(t==='number'||t==='string'||t==='boolean')return v; if(Array.isArray(v))return v.map(cloneable); if(t==='object'){var o={};for(var k in v){if(Object.prototype.hasOwnProperty.call(v,k))o[k]=cloneable(v[k]);}return o;} return String(v); }
  function es(err){ return err && err.message ? ((err.name||'Error')+': '+err.message) : String(err); }
  try { fn = (new Function(d.code + "\\n;return typeof " + d.functionName + " === 'function' ? " + d.functionName + " : undefined;"))(); }
  catch (err) { self.postMessage({ syntaxError: es(err) }); return; }
  if (typeof fn !== 'function') { self.postMessage({ syntaxError: "No se encontró la función «" + d.functionName + "». Defínela con ese nombre exacto." }); return; }
  var results = d.inputs.map(function (args) {
    try { return { ok: true, value: cloneable(fn.apply(null, args)) }; }
    catch (err) { return { ok: false, error: es(err) }; }
  });
  self.postMessage({ ok: true, results: results });
};
`;

interface WorkerReply {
  syntaxError?: string;
  ok?: boolean;
  results?: ({ ok: true; value: unknown } | { ok: false; error: string })[];
  __timeout?: boolean;
}

/** Run the learner's JS against the (non-hint) cases in a sandboxed, time-limited Worker. */
export async function runJs(code: string, functionName: string, cases: TestCase[], timeoutMs = 3000): Promise<RunResult> {
  const real = cases.filter((c) => !c.hint);
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    // no Worker (SSR/old) → run in-process (no timeout guard); still real execution, honest
    const out = execCode(code, functionName, real.map((c) => c.input));
    if ("syntaxError" in out) return { syntaxError: out.syntaxError, cases: [] };
    return { syntaxError: null, cases: assemble(real, out.results) };
  }
  const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "application/javascript" }));
  const worker = new Worker(url);
  try {
    const msg = await new Promise<WorkerReply>((resolve) => {
      const timer = setTimeout(() => resolve({ __timeout: true }), timeoutMs);
      worker.onmessage = (e) => {
        clearTimeout(timer);
        resolve(e.data as WorkerReply);
      };
      worker.onerror = (e) => {
        clearTimeout(timer);
        resolve({ syntaxError: e.message || "error de ejecución" });
      };
      worker.postMessage({ code, functionName, inputs: real.map((c) => c.input) });
    });
    if (msg.__timeout) return { syntaxError: null, cases: [], timedOut: true };
    if (msg.syntaxError) return { syntaxError: msg.syntaxError, cases: [] };
    return { syntaxError: null, cases: assemble(real, msg.results ?? []) };
  } finally {
    worker.terminate();
    URL.revokeObjectURL(url);
  }
}

function assemble(cases: TestCase[], results: ({ ok: true; value: unknown } | { ok: false; error: string })[]): CaseResult[] {
  return cases.map((c, i) => {
    const r = results[i];
    if (!r || !r.ok) return { input: c.input, expected: c.expected, error: r && !r.ok ? r.error : "sin resultado", pass: false };
    return { input: c.input, expected: c.expected, output: r.value, pass: deepEqual(r.value, c.expected) };
  });
}
