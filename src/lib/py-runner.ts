import type { CaseResult, RunResult, TestCase } from "@/lib/exercise";
import { deepEqual } from "@/lib/exercise";
import { PYODIDE_BASE, PYODIDE_CACHE, PYODIDE_FILES, PYODIDE_WORKER_REV, pyodideFilesFor } from "@/lib/pyodide-files";

// Offline PYTHON execution via Pyodide (real CPython in WebAssembly). Loaded ONCE from a CDN; the WORKER itself keeps
// the six files in `arcanum-pyodide` (design poblar §6.3) → runs 100% offline afterward (the user's condition: casi
// nunca hay datos), without depending on the SW intercepting a blob: worker. Runs in an ISOLATED Worker with a TIMEOUT
// that terminates a runaway. Level 1 = the REAL Python SyntaxError (line + message); Level 2 = deepEqual vs the saved
// cases. Honest degradation: if the runtime can't be fetched (first run offline / blocked), the caller shows
// "descarga el runtime de Python con conexión".

export { PYODIDE_VERSION } from "@/lib/pyodide-files";

const RUNNER_PY = `
import json
_out = {"syntaxError": None, "results": []}
_ns = {}
try:
    exec(_code, _ns)
except SyntaxError as _e:
    _out["syntaxError"] = "SyntaxError: " + str(_e.msg) + (" (linea " + str(_e.lineno) + ")" if _e.lineno else "")
except Exception as _e:
    _out["syntaxError"] = type(_e).__name__ + ": " + str(_e)
if _out["syntaxError"] is None:
    _fn = _ns.get(_fn_name)
    if not callable(_fn):
        _out["syntaxError"] = "No se encontro la funcion \\u00ab" + _fn_name + "\\u00bb. Definela con ese nombre exacto."
    else:
        for _args in _inputs:
            try:
                _out["results"].append({"ok": True, "value": _fn(*list(_args))})
            except Exception as _e:
                _out["results"].append({"ok": False, "error": type(_e).__name__ + ": " + str(_e)})
json.dumps(_out)
`;

const WORKER_FILES: Record<string, string> = Object.fromEntries(pyodideFilesFor(true).map((f) => [f, PYODIDE_FILES[f].sri]));

// The worker (design poblar §6.3). 1) Native references are captured FIRST, before any learner code and before the
// storage sever below wipes `caches` from the scope: the worker only ever uses these. 2) cachedFetch replaces
// self.fetch: for exactly the six Pyodide URLs of this version it serves from arcanum-pyodide, or fetches CORS with
// the file's integrity and stores only an ok + "cors" response; anything else goes to the native fetch untouched.
// 3) pyodide.js and pyodide.asm.js come through cachedFetch and run from a blob: URL — never importScripts of another
// origin, whose no-cors response is opaque and that nobody can store or verify.
const WORKER_SRC = `
const BASE = ${JSON.stringify(PYODIDE_BASE)};
const CACHE = ${JSON.stringify(PYODIDE_CACHE)};
const REV = ${JSON.stringify(PYODIDE_WORKER_REV)};
const FILES = ${JSON.stringify(WORKER_FILES)};
const _apply = Reflect.apply;
const _fetch = self.fetch.bind(self);
const _cs = typeof caches !== "undefined" ? caches : null;
const _open = _cs ? _cs.open.bind(_cs) : null;
const _match = typeof Cache !== "undefined" ? Cache.prototype.match : null;
const _put = typeof Cache !== "undefined" ? Cache.prototype.put : null;
const _clone = Response.prototype.clone;
const _URL = URL;
const _hasOwn = Object.prototype.hasOwnProperty;
const URLS = {};
for (const k in FILES) URLS[BASE + k] = k; // the six exact URLs of this version, compared with ===
function urlOf(input) {
  if (typeof input === "string") return input;
  if (input instanceof _URL) return input.href;
  return input && typeof input.url === "string" ? input.url : "";
}
async function cachedFetch(input, init) {
  const url = urlOf(input);
  const f = _hasOwn.call(URLS, url) ? URLS[url] : null;
  if (f === null) return _fetch(input, init);
  let cache = null;
  try { cache = _open ? await _open(CACHE) : null; } catch (_e) { cache = null; }
  if (cache && _match) {
    try { const hit = await _apply(_match, cache, [url]); if (hit && hit.status === 200) return hit; } catch (_e) {}
  }
  const res = await _fetch(url, Object.assign({}, init || {}, { mode: "cors", credentials: "omit", integrity: (init && init.integrity) || FILES[f] }));
  if (cache && _put && res.ok && res.type === "cors") {
    try { await _apply(_put, cache, [url, _apply(_clone, res, [])]); } catch (_e) { /* quota / deleted cache: pyodideStatus reports what is missing */ }
  }
  return res;
}
async function loadClassic(url) {
  const r = await cachedFetch(url);
  if (!r.ok) throw new Error("http " + r.status + " " + url);
  const u = _URL.createObjectURL(new Blob([await r.text()], { type: "text/javascript" }));
  try { importScripts(u); } finally { _URL.revokeObjectURL(u); }
}
let _ready = null;
function boot() {
  if (!_ready) {
    _ready = (async function () {
      self.fetch = cachedFetch; // Pyodide asks for lock, wasm, stdlib and packages with fetch
      if (typeof loadPyodide !== "function") await loadClassic(BASE + "pyodide.js");
      // defines _createPyodideModule, so loadPyodide no longer importScripts it from the CDN
      if (typeof _createPyodideModule !== "function") await loadClassic(BASE + "pyodide.asm.js");
      const py = await loadPyodide({ indexURL: BASE });
      // Sever the storage bridge: Pyodide's js module proxies this worker's globals, so a learner's
      // "import js; js.indexedDB.deleteDatabase('arcanum')" would otherwise reach the real event log.
      // 🔴 HARDENED (audit H3): the old sever used the SAME configurable:true shadow that was proven
      // bypassable in the JS worker — and Pyodide hands the learner full JS reflection (js.Object,
      // js.Reflect), so a delete / the prototype getter restored the live handle. Since Pyodide MUST
      // keep fetch/importScripts for package loads, a re-readable log meant "read AND exfiltrate" was
      // wide open. Now every prototype-chain level that owns the property is redefined non-configurable
      // and non-writable. (Declared debt #1/#2 stand: fetch survives, and the worker is a singleton.)
      ['indexedDB','caches','openDatabase','localStorage','sessionStorage','BroadcastChannel'].forEach(function (k) {
        var hit = false, o = self;
        while (o) { try { if (Object.getOwnPropertyDescriptor(o, k)) { Object.defineProperty(o, k, { value: undefined, configurable: false, writable: false }); hit = true; } } catch (_e) {} o = Object.getPrototypeOf(o); }
        if (!hit) { try { Object.defineProperty(self, k, { value: undefined, configurable: false, writable: false }); } catch (_e2) { try { self[k] = undefined; } catch (_e3) {} } }
      });
      return py;
    })();
    _ready.catch(function () { _ready = null; }); // a failed boot (offline) does not leave the worker useless
  }
  return _ready;
}
self.onmessage = async function (e) {
  const d = e.data;
  try {
    const py = await boot();
    // Forge (§6.6, §9.3 k): sqlite3 is not in Pyodide's base image; loadPackage fetches it once (cachedFetch keeps it).
    if (d.packages && d.packages.length) await py.loadPackage(d.packages);
    if (d.warm) { self.postMessage({ rid: d.rid, ok: true, warm: true }); return; }
    py.globals.set("_code", d.code);
    py.globals.set("_fn_name", d.functionName);
    py.globals.set("_inputs", py.toPy(d.inputs));
    const out = await py.runPythonAsync(${JSON.stringify(RUNNER_PY)});
    self.postMessage({ rid: d.rid, ok: true, out: out });
  } catch (err) {
    self.postMessage({ rid: d.rid, loadError: String(err && err.message ? err.message : err) });
  }
};
`;

interface Reply {
  rid?: number;
  ok?: boolean;
  out?: string;
  warm?: boolean;
  loadError?: string;
  __timeout?: boolean;
}

/** The only packages the runner loads (frozen signature: `"sqlite3"[]`). */
const ALLOWED_PACKAGES = new Set(["sqlite3"]);
/** A learner/harness program that imports sqlite3 gets it loaded even when the caller is a plain ExecRunner (the bank
 *  import passes runPy without opts): sqlite3 is CPython stdlib, so this only restores what Pyodide unvendors. */
const IMPORTS_SQLITE3 = /^\s*(?:import\s+sqlite3\b|from\s+sqlite3\s+import\b|import\s+[\w\s,]*\bsqlite3\b)/m;

function packagesFor(code: string, opts?: { packages?: "sqlite3"[] }): string[] {
  const out = new Set((opts?.packages ?? []).filter((p) => ALLOWED_PACKAGES.has(p)));
  if (IMPORTS_SQLITE3.test(code)) out.add("sqlite3");
  return [...out];
}

/** The worker's source, exported for py-runner.worker.test.ts (it runs it in node:vm with fake globals). */
export const PYODIDE_WORKER_SRC = WORKER_SRC;

let _rid = 0;
/** Post one request to the singleton worker and wait for ITS reply (matched by id) or the timeout. */
function request(msg: Record<string, unknown>, timeoutMs: number): Promise<Reply> {
  const w = worker();
  const rid = ++_rid;
  return new Promise<Reply>((resolve) => {
    const timer = setTimeout(() => {
      w.removeEventListener("message", onMsg);
      resolve({ __timeout: true });
    }, timeoutMs);
    function onMsg(e: MessageEvent) {
      const data = e.data as Reply;
      if (data && typeof data.rid === "number" && data.rid !== rid) return; // another request's reply
      clearTimeout(timer);
      w.removeEventListener("message", onMsg);
      resolve(data);
    }
    w.addEventListener("message", onMsg);
    w.postMessage({ ...msg, rid });
  });
}

let _worker: Worker | null = null;
let _url: string | null = null;
function worker(): Worker {
  if (!_worker) {
    _url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "application/javascript" }));
    _worker = new Worker(_url);
  }
  return _worker;
}
/** Drop the Pyodide worker (e.g. after a timeout kill). */
export function resetPy() {
  _worker?.terminate();
  _worker = null;
  if (_url) URL.revokeObjectURL(_url);
  _url = null;
}

/** Run the learner's Python against the (non-hint) cases. Returns a RunResult, or a `pyUnavailable`
 *  flag when the runtime couldn't be loaded (honest — the caller says "descárgalo con conexión"). */
export async function runPy(
  code: string,
  functionName: string,
  cases: TestCase[],
  timeoutMs = 15000,
  // Frozen signature (Forge phase 0). `packages` (only "sqlite3") is loaded in the worker before running; a program
  // that imports sqlite3 gets it too (packagesFor), so the bank import's plain ExecRunner call works.
  opts?: { packages?: "sqlite3"[] },
): Promise<RunResult & { pyUnavailable?: boolean }> {
  const real = cases.filter((c) => !c.hint);
  if (typeof window === "undefined" || typeof Worker === "undefined") return { syntaxError: null, cases: [], pyUnavailable: true };
  const packages = packagesFor(code, opts);
  const reply = await request({ code, functionName, inputs: real.map((c) => c.input), ...(packages.length ? { packages } : {}) }, timeoutMs);
  if (reply.__timeout) {
    resetPy(); // terminate the runaway
    return { syntaxError: null, cases: [], timedOut: true };
  }
  if (reply.loadError) return { syntaxError: null, cases: [], pyUnavailable: true };
  let parsed: { syntaxError: string | null; results: ({ ok: true; value: unknown } | { ok: false; error: string })[] };
  try {
    parsed = JSON.parse(reply.out ?? "{}");
  } catch {
    return { syntaxError: null, cases: [], pyUnavailable: true };
  }
  if (parsed.syntaxError) return { syntaxError: parsed.syntaxError, cases: [] };
  const caseResults: CaseResult[] = real.map((c, i) => {
    const r = parsed.results[i];
    if (!r || !r.ok) return { input: c.input, expected: c.expected, error: r && !r.ok ? r.error : "sin resultado", pass: false };
    return { input: c.input, expected: c.expected, output: r.value, pass: deepEqual(r.value, c.expected) };
  });
  return { syntaxError: null, cases: caseResults };
}

export type WarmPyResult = { ok: true } | { ok: false; reason: "sin-red" | "tiempo" | "no-disponible" };

/** UI text for `no-disponible` (no Worker in this environment, e.g. server render). */
export const WARM_PY_UNAVAILABLE = "La preparación de Python sin red aún no está disponible en esta versión";
/** UI texts of «Preparar ruta sin red» (§6.6). */
export const WARM_PY_READY = "Python y SQLite listos sin red";
export const WARM_PY_FAILED = "No se pudo descargar Python: conéctate y reintenta";
export const WARM_PY_TIMEOUT = "La descarga de Python tardó demasiado y se detuvo: reintenta con mejor conexión";
/** Shown before opening a Python/SQL item when offline and Pyodide is not cached yet (§6.6). The figures are H8 of
 *  design poblar: the six files transfer ≈ 6 MB with brotli and take ≈ 15 MB on the device. */
export const PY_NEEDS_DOWNLOAD = "Este ejercicio necesita descargar Python una vez (≈ 6 MB de descarga, ≈ 15 MB en el dispositivo)";
/** Shown by the SQL runner when Pyodide with SQLite could not be loaded (anexo r2 [19]: same figures as above). */
export const PY_SQL_UNAVAILABLE = "No se pudo cargar Python con SQLite: conéctate una vez para descargarlo (≈ 6 MB de descarga, ≈ 15 MB en el dispositivo).";

/** Load Pyodide + `packages` in the worker WITHOUT running code, with its own limit (not runPy's 15 s): the first
 *  download of Pyodide with sqlite3 can pass 15 s on a slow network. On timeout the worker is dropped (resetPy), as
 *  runPy does with a runaway. A load error (no network, CDN blocked) answers `sin-red`. */
export async function warmPy(packages: "sqlite3"[], timeoutMs = 120_000): Promise<WarmPyResult> {
  if (typeof window === "undefined" || typeof Worker === "undefined") return { ok: false, reason: "no-disponible" };
  const pk = packages.filter((p) => ALLOWED_PACKAGES.has(p));
  const reply = await request({ warm: true, packages: pk }, timeoutMs);
  if (reply.__timeout) {
    resetPy();
    return { ok: false, reason: "tiempo" };
  }
  if (reply.loadError || !reply.warm) return { ok: false, reason: "sin-red" };
  return { ok: true };
}

/** What of Pyodide is on this device (design poblar §6.3): same shape as the facade's ResourceCount. */
export interface PyodideStatus {
  listos: number;
  total: number;
  faltan: string[];
  /** bytes of the present files from PYODIDE_FILES (the stored Content-Length is the compressed body's) */
  bytes: number;
}

/** Which of the five core files (six with `sqlite`) are in `arcanum-pyodide` with status 200 and not opaque, so a
 *  Python/SQL item can run offline. `null` when it cannot be known (no Cache API). */
export async function pyodideStatus(o: { sqlite?: boolean } = {}): Promise<PyodideStatus | null> {
  if (typeof caches === "undefined") return null;
  const files = pyodideFilesFor(Boolean(o.sqlite));
  try {
    const present = await Promise.all(
      files.map(async (f) => {
        const r = await caches.match(PYODIDE_BASE + f, { cacheName: PYODIDE_CACHE });
        return Boolean(r && r.status === 200 && r.type !== "opaque");
      }),
    );
    const faltan = files.filter((_, i) => !present[i]);
    const bytes = files.reduce((n, f, i) => n + (present[i] ? PYODIDE_FILES[f].bytes : 0), 0);
    return { listos: files.length - faltan.length, total: files.length, faltan, bytes };
  } catch {
    return null;
  }
}
