import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pyodideStatus, resetPy, runPy, warmPy } from "@/lib/py-runner";
import { deletePython, warmPython } from "@/lib/offline/api";
import { PYODIDE_BASE, PYODIDE_CACHE, PYODIDE_CORE, PYODIDE_FILES } from "@/lib/pyodide-files";

// py-runner bodies of Forge (design §6.6, §9.3 k): sqlite3 loading, warmPy with its own limit, and replies matched to
// their request. Pyodide does not run under vitest, so the Worker is a fake that records what it receives.
// Protection with red-check in bitacora-e2-datos.md: a warmPy that times out must drop the worker (resetPy), as runPy
// does with a runaway → «warmPy venció y no reinició el worker».

class FakeWorker {
  static all: FakeWorker[] = [];
  posted: Record<string, unknown>[] = [];
  listeners = new Set<(e: MessageEvent) => void>();
  terminated = false;
  constructor() {
    FakeWorker.all.push(this);
  }
  postMessage(m: Record<string, unknown>) {
    this.posted.push(m);
  }
  addEventListener(_t: string, f: (e: MessageEvent) => void) {
    this.listeners.add(f);
  }
  removeEventListener(_t: string, f: (e: MessageEvent) => void) {
    this.listeners.delete(f);
  }
  terminate() {
    this.terminated = true;
  }
  reply(data: unknown) {
    for (const f of [...this.listeners]) f({ data } as MessageEvent);
  }
}

const last = () => FakeWorker.all[FakeWorker.all.length - 1]!;
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  FakeWorker.all = [];
  vi.stubGlobal("Worker", FakeWorker);
  URL.createObjectURL = () => "blob:fake";
  URL.revokeObjectURL = () => {};
});
afterEach(() => {
  resetPy();
  vi.unstubAllGlobals();
});

describe("warmPy", () => {
  it("carga sqlite3 sin ejecutar código y responde ok", async () => {
    const p = warmPy(["sqlite3"]);
    await tick();
    const msg = last().posted[0]!;
    expect(msg).toMatchObject({ warm: true, packages: ["sqlite3"] });
    expect(msg.code).toBeUndefined();
    last().reply({ rid: msg.rid, ok: true, warm: true });
    expect(await p).toEqual({ ok: true });
  });
  it("si vence su propio límite, reinicia el worker y responde «tiempo»", async () => {
    const r = await warmPy(["sqlite3"], 20);
    expect(r).toEqual({ ok: false, reason: "tiempo" });
    expect(FakeWorker.all[0]!.terminated, "warmPy venció y no reinició el worker").toBe(true);
  });
  it("un error de carga (sin red o CDN bloqueado) responde «sin-red»", async () => {
    const p = warmPy(["sqlite3"]);
    await tick();
    last().reply({ rid: last().posted[0]!.rid, loadError: "NetworkError" });
    expect(await p).toEqual({ ok: false, reason: "sin-red" });
  });
});

// design poblar §6.3: a fake Cache Storage with arcanum-pyodide. Red-checks in redchecks-offline-motor.md.
function fakeCaches(entries: Record<string, { status: number; type: string }>) {
  const store = new Map(Object.entries(entries));
  const log: { op: string; workerTerminated: boolean | null }[] = [];
  return {
    store,
    log,
    api: {
      match: async (url: string, o?: { cacheName?: string }) => (o?.cacheName === PYODIDE_CACHE ? store.get(url) : undefined),
      delete: async (name: string) => {
        log.push({ op: `delete ${name}`, workerTerminated: FakeWorker.all[0]?.terminated ?? null });
        if (name === PYODIDE_CACHE) store.clear();
        return true;
      },
    },
  };
}
const ok = { status: 200, type: "cors" };

describe("pyodideStatus · Python listo sólo con sus archivos completos", () => {
  it("con sólo pyodide.js no está listo: faltan los otros cuatro", async () => {
    vi.stubGlobal("caches", fakeCaches({ [PYODIDE_BASE + "pyodide.js"]: ok }).api);
    const s = await pyodideStatus();
    expect(s!.faltan, "Python salió listo sin pyodide.asm.js").toContain("pyodide.asm.js");
    expect(s).toMatchObject({ listos: 1, total: 5, bytes: PYODIDE_FILES["pyodide.js"].bytes });
  });
  it("los cinco con status 200 dan 5/5; con SQL falta sqlite3; una entrada opaca o un 404 no cuentan", async () => {
    const all = Object.fromEntries(PYODIDE_CORE.map((f) => [PYODIDE_BASE + f, ok]));
    vi.stubGlobal("caches", fakeCaches(all).api);
    expect(await pyodideStatus()).toMatchObject({ listos: 5, total: 5, faltan: [] });
    expect(await pyodideStatus({ sqlite: true })).toMatchObject({ listos: 5, total: 6, faltan: ["sqlite3-1.0.0.zip"] });
    vi.stubGlobal(
      "caches",
      fakeCaches({ ...all, [PYODIDE_BASE + "pyodide.asm.wasm"]: { status: 0, type: "opaque" }, [PYODIDE_BASE + "pyodide.js"]: { status: 404, type: "cors" } }).api,
    );
    expect((await pyodideStatus())!.faltan).toEqual(["pyodide.js", "pyodide.asm.wasm"]);
  });
  it("sin Cache API es null", async () => {
    vi.stubGlobal("caches", undefined);
    expect(await pyodideStatus()).toBeNull();
  });
});

describe("warmPython y deletePython (fachada)", () => {
  it("si el worker dice ok pero falta un archivo en la caché, no cuenta como listo", async () => {
    vi.stubGlobal("caches", fakeCaches({ [PYODIDE_BASE + "pyodide.js"]: ok }).api);
    const p = warmPython({ sqlite: false });
    // the facade reaches the worker through a dynamic import: wait for the request, however long the import takes
    await vi.waitFor(() => expect(FakeWorker.all[0]?.posted.length).toBe(1), { timeout: 5000 });
    last().reply({ rid: last().posted[0]!.rid, ok: true, warm: true });
    const r = await p;
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toBe("Python incompleto: faltan pyodide.asm.js, pyodide.asm.wasm, python_stdlib.zip, pyodide-lock.json");
  });
  it("reinicia el worker ANTES de borrar arcanum-pyodide y mide lo liberado", async () => {
    const c = fakeCaches(Object.fromEntries(PYODIDE_CORE.map((f) => [PYODIDE_BASE + f, ok])));
    vi.stubGlobal("caches", c.api);
    const p = warmPy([]);
    await tick();
    last().reply({ rid: last().posted[0]!.rid, ok: true, warm: true });
    await p;
    const r = await deletePython();
    expect(c.log).toHaveLength(1);
    expect(c.log[0]!.workerTerminated, "borrar Python dejó vivo un worker que guarda en una caché borrada").toBe(true);
    expect(r.errores).toEqual([]);
    expect(r.liberadosBytes).toBe(PYODIDE_CORE.reduce((n, f) => n + PYODIDE_FILES[f].bytes, 0));
  });
});

describe("runPy · paquetes y respuestas emparejadas", () => {
  it("pide sqlite3 con opts.packages o cuando el programa lo importa; si no, ningún paquete", async () => {
    const cases = [{ input: [1], expected: 1 }];
    const a = runPy("import sqlite3\ndef f(x):\n    return x", "f", cases);
    const b = runPy("def f(x):\n    return x", "f", cases, 15000, { packages: ["sqlite3"] });
    const c = runPy("def f(x):\n    return x", "f", cases);
    await tick();
    const [ma, mb, mc] = last().posted;
    expect(ma!.packages).toEqual(["sqlite3"]);
    expect(mb!.packages).toEqual(["sqlite3"]);
    expect(mc!.packages).toBeUndefined();
    const out = JSON.stringify({ syntaxError: null, results: [{ ok: true, value: 1 }] });
    // the replies arrive in another order: each request takes ITS reply
    last().reply({ rid: mc!.rid, ok: true, out });
    last().reply({ rid: ma!.rid, ok: true, out });
    last().reply({ rid: mb!.rid, ok: true, out });
    for (const r of await Promise.all([a, b, c])) expect(r.cases[0]!.pass).toBe(true);
  });
  it("una respuesta de otra petición no resuelve la propia", async () => {
    const p = runPy("def f(x):\n    return x", "f", [{ input: [2], expected: 2 }]);
    await tick();
    const m = last().posted[0]!;
    let settled = false;
    void p.then(() => (settled = true));
    last().reply({ rid: (m.rid as number) + 99, ok: true, out: JSON.stringify({ syntaxError: null, results: [{ ok: true, value: 0 }] }) });
    await tick();
    expect(settled, "runPy tomó la respuesta de otra petición").toBe(false);
    last().reply({ rid: m.rid, ok: true, out: JSON.stringify({ syntaxError: null, results: [{ ok: true, value: 2 }] }) });
    expect((await p).cases[0]!.pass).toBe(true);
  });
});
