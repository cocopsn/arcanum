import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetPy, runPy, warmPy } from "@/lib/py-runner";

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
