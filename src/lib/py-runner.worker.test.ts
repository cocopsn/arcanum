import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { PYODIDE_WORKER_SRC } from "@/lib/py-runner";
import { PYODIDE_BASE, PYODIDE_CACHE, PYODIDE_FILES, type PyodideFile } from "@/lib/pyodide-files";

// The Pyodide worker keeps its own six files (design poblar §6.3, H7; anexo r2 [20]). PYODIDE_WORKER_SRC runs here in
// node:vm with fake fetch, importScripts, URL, Blob, caches, Cache, Response and a fake pyodide.js that asks for its
// files the way 0.26.4 does: the lock with a string, the wasm with `new URL(...)`, the stdlib with a Request and
// sqlite3 with its own sha256 integrity. Red-checks in redchecks-offline-motor.md.

const ALL = Object.keys(PYODIDE_FILES) as PyodideFile[];
const U = (f: string) => PYODIDE_BASE + f;

// What pyodide.js 0.26.4 does in a worker, reduced: fetch lock, wasm (URL object) and stdlib (Request), importScripts
// pyodide.asm.js only if _createPyodideModule is missing, and loadPackage → fetch(URL, { integrity }).
const FAKE_PYODIDE_JS = `
self.loadPyodide = async function (o) {
  const base = o.indexURL;
  await (await fetch(base + "pyodide-lock.json")).text();
  const wasm = await fetch(new URL(base + "pyodide.asm.wasm"), {});
  const std = await fetch(new Request(base + "python_stdlib.zip"));
  if (!wasm.ok || !std.ok) throw new Error("no wasm/stdlib");
  if (typeof _createPyodideModule !== "function") importScripts(base + "pyodide.asm.js");
  await _createPyodideModule();
  return {
    loadPackage: async function () {
      const r = await fetch(new URL(base + "sqlite3-1.0.0.zip"), { integrity: "sha256-propio-del-lock" });
      if (!r.ok) throw new Error("no sqlite3");
    },
    globals: { set: function () {} },
    toPy: function (x) { return x; },
    runPythonAsync: async function () { return JSON.stringify({ syntaxError: null, results: [] }); },
  };
};`;
const FAKE_ASM_JS = "var _createPyodideModule = async function () { return {}; };";
const BODY: Record<string, string> = { [U("pyodide.js")]: FAKE_PYODIDE_JS, [U("pyodide.asm.js")]: FAKE_ASM_JS };

class FakeResponse {
  constructor(
    public body: string,
    public status = 200,
    public type = "cors",
  ) {}
  get ok() {
    return this.status >= 200 && this.status < 300;
  }
  async text() {
    return this.body;
  }
  clone() {
    return new FakeResponse(this.body, this.status, this.type);
  }
}
class FakeRequest {
  constructor(public url: string) {}
}
class FakeCache {
  store = new Map<string, FakeResponse>();
  async match(url: string) {
    return this.store.get(String(url));
  }
  async put(url: string, res: FakeResponse) {
    this.store.set(String(url), res);
  }
}

interface World {
  ctx: Record<string, unknown> & { onmessage: (e: { data: unknown }) => Promise<void>; fetch: (i: unknown, o?: unknown) => Promise<unknown> };
  net: { url: string; init: Record<string, unknown> | undefined }[];
  imported: string[];
  replies: Record<string, unknown>[];
  cache: FakeCache;
  setOnline(v: boolean): void;
  send(data: Record<string, unknown>): Promise<Record<string, unknown>>;
}

function world(o: { online?: boolean; prefill?: boolean; respond?: (url: string) => FakeResponse | null } = {}): World {
  let online = o.online ?? true;
  const cache = new FakeCache();
  if (o.prefill) for (const f of ALL) cache.store.set(U(f), new FakeResponse(BODY[U(f)] ?? `bytes de ${f}`));
  const net: World["net"] = [];
  const imported: string[] = [];
  const replies: Record<string, unknown>[] = [];
  const blobs = new Map<string, string>();
  let nBlob = 0;
  class FakeURL extends URL {
    static createObjectURL(b: Blob) {
      const u = `blob:fake/${++nBlob}`;
      blobs.set(u, (b as unknown as FakeBlob).src);
      return u;
    }
    static revokeObjectURL(u: string) {
      blobs.delete(u);
    }
  }
  class FakeBlob {
    src: string;
    constructor(parts: string[]) {
      this.src = parts.join("");
    }
  }
  const urlOf = (i: unknown) => (typeof i === "string" ? i : i instanceof URL ? i.href : String((i as { url?: string }).url));
  const ctx = {
    console,
    Response: FakeResponse,
    Request: FakeRequest,
    Cache: FakeCache,
    URL: FakeURL,
    Blob: FakeBlob,
    caches: { open: async (name: string) => (name === PYODIDE_CACHE ? cache : new FakeCache()) },
    fetch: async (input: unknown, init?: Record<string, unknown>) => {
      const url = urlOf(input);
      net.push({ url, init });
      if (!online) throw new TypeError("Failed to fetch");
      return o.respond?.(url) ?? new FakeResponse(BODY[url] ?? `bytes de ${url}`);
    },
    importScripts: (u: string) => {
      imported.push(u);
      // a cross-origin importScripts also runs online (no-cors, opaque): the assertion is what catches it
      vm.runInContext(blobs.get(u) ?? BODY[u] ?? "", ctx as vm.Context);
    },
    postMessage: (m: Record<string, unknown>) => replies.push(m),
  } as unknown as World["ctx"];
  (ctx as Record<string, unknown>).self = ctx;
  vm.createContext(ctx);
  vm.runInContext(PYODIDE_WORKER_SRC, ctx as vm.Context);
  return {
    ctx,
    net,
    imported,
    replies,
    cache,
    setOnline: (v) => (online = v),
    async send(data) {
      await ctx.onmessage({ data });
      return replies[replies.length - 1]!;
    },
  };
}

const callFor = (w: World, f: string) => w.net.find((c) => c.url === U(f));

describe("worker de Pyodide · guarda él mismo sus seis archivos", () => {
  it("en frío y con red: los dos scripts por fetch CORS con integridad, sólo importScripts de blob:, y guarda los seis", async () => {
    const w = world();
    expect(await w.send({ rid: 1, warm: true, packages: ["sqlite3"] })).toEqual({ rid: 1, ok: true, warm: true });
    expect(w.imported.length).toBeGreaterThan(0);
    for (const u of w.imported) {
      expect(u.startsWith("blob:"), "pyodide.js se cargó con importScripts de otro origen: respuesta opaca que nadie guarda").toBe(true);
    }
    for (const f of ["pyodide.asm.js", "pyodide.js"] as const) {
      const c = callFor(w, f);
      expect(c?.init?.mode, `${f} no se pidió con mode: "cors"`).toBe("cors");
      expect(c?.init?.credentials).toBe("omit");
      expect(c?.init?.integrity, `${f} se pidió sin integridad`).toBe(PYODIDE_FILES[f].sri);
    }
    expect(w.cache.store.has(U("pyodide.asm.js")), "el worker no guardó pyodide.asm.js: sin red Python no arranca").toBe(true);
    // anexo r2 [20]: Pyodide asks for the wasm with a URL object and the stdlib with a Request
    expect(w.cache.store.has(U("pyodide.asm.wasm")), "pyodide.asm.wasm se pidió con un URL y no se guardó").toBe(true);
    expect(w.cache.store.has(U("python_stdlib.zip")), "python_stdlib.zip se pidió con un Request y no se guardó").toBe(true);
    for (const f of ["pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"] as const) {
      expect(callFor(w, f)?.init?.integrity, `${f} se pidió sin integridad`).toBe(PYODIDE_FILES[f].sri);
    }
    // the package keeps the integrity that Pyodide passes (the sha256 of pyodide-lock.json)
    expect(callFor(w, "sqlite3-1.0.0.zip")?.init?.integrity).toBe("sha256-propio-del-lock");
    for (const f of ALL) expect(w.cache.store.has(U(f)), `el worker no guardó ${f}`).toBe(true);
  });

  it("con la caché llena arranca sin red y no pide nada de Pyodide a la red", async () => {
    const w = world({ online: false, prefill: true });
    expect(await w.send({ rid: 1, warm: true, packages: ["sqlite3"] })).toEqual({ rid: 1, ok: true, warm: true });
    expect(w.net.filter((c) => c.url.startsWith(PYODIDE_BASE)), "con la caché llena el worker fue a la red").toEqual([]);
  });

  it("sólo guarda respuestas ok y de tipo cors", async () => {
    const w = world({
      respond: (url) =>
        url === U("pyodide-lock.json") ? new FakeResponse("{}", 200, "basic") : url === U("sqlite3-1.0.0.zip") ? new FakeResponse("", 500) : null,
    });
    const r = await w.send({ rid: 1, warm: true, packages: ["sqlite3"] });
    expect(r.loadError).toBeTruthy();
    expect(w.cache.store.has(U("pyodide-lock.json")), "se guardó una respuesta que no es cors").toBe(false);
    expect(w.cache.store.has(U("sqlite3-1.0.0.zip")), "se guardó un 500").toBe(false);
    expect(w.cache.store.has(U("pyodide.asm.wasm"))).toBe(true);
  });

  it("tras el blindaje (caches ya no existe en el ámbito), un loadPackage posterior guarda sqlite3-1.0.0.zip", async () => {
    const w = world();
    expect(await w.send({ rid: 1, warm: true, packages: [] })).toEqual({ rid: 1, ok: true, warm: true });
    expect(w.ctx.caches, "el blindaje no quitó caches del ámbito del worker").toBeUndefined();
    expect(w.cache.store.has(U("sqlite3-1.0.0.zip"))).toBe(false);
    expect(await w.send({ rid: 2, warm: true, packages: ["sqlite3"] })).toEqual({ rid: 2, ok: true, warm: true });
    expect(w.cache.store.has(U("sqlite3-1.0.0.zip")), "tras el blindaje el worker ya no pudo guardar sqlite3-1.0.0.zip").toBe(true);
  });

  it("un arranque fallido sin red permite reintentar al volver la red", async () => {
    const w = world({ online: false });
    expect((await w.send({ rid: 1, warm: true, packages: [] })).loadError).toBeTruthy();
    w.setOnline(true);
    expect(await w.send({ rid: 2, warm: true, packages: [] }), "un arranque sin red dejó el worker inútil").toEqual({ rid: 2, ok: true, warm: true });
  });

  it("una URL que no es de las seis va al fetch nativo sin cambios", async () => {
    const w = world();
    await w.send({ rid: 1, warm: true, packages: [] });
    const init = { method: "GET" };
    await w.ctx.fetch("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/otro.whl", init);
    await w.ctx.fetch(U("pyodide.js") + "?x=1");
    expect(w.net.at(-2)).toEqual({ url: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/otro.whl", init });
    expect(w.net.at(-1)!.init).toBeUndefined();
    expect(w.cache.store.has(U("pyodide.js") + "?x=1")).toBe(false);
  });
});
