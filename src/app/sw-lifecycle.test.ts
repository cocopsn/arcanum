import { describe, expect, it } from "vitest";
import { precacheCounts, prunePyodide, PYODIDE_CACHE } from "@/app/sw-rules";
import { PYODIDE_BASE } from "@/lib/pyodide-files";

// Lifecycle of the service worker (design poblar §6.2, §6.9). Red-checks in redchecks-offline-motor.md: not deleting
// → «quedó Pyodide 0.26.3 en arcanum-pyodide»; counting total as ready → «el precache salió completo con 208 de 209».

function fakeStorage(urls: string[]) {
  const keys = urls.map((url) => ({ url }) as Request);
  const cache = {
    keys: async () => [...keys],
    delete: async (r: Request) => {
      const i = keys.findIndex((k) => k.url === r.url);
      if (i >= 0) keys.splice(i, 1);
      return i >= 0;
    },
  };
  const storage = {
    has: async (n: string) => n === PYODIDE_CACHE,
    open: async (n: string) => {
      if (n !== PYODIDE_CACHE) throw new Error("otra caché");
      return cache;
    },
  } as unknown as CacheStorage;
  return { storage, left: () => keys.map((k) => k.url) };
}

describe("prunePyodide", () => {
  it("con entradas de 0.26.3 y 0.26.4 deja sólo las de la versión vigente", async () => {
    const viejo = "https://cdn.jsdelivr.net/pyodide/v0.26.3/full/";
    const s = fakeStorage([viejo + "pyodide.js", PYODIDE_BASE + "pyodide.js", viejo + "pyodide.asm.wasm", PYODIDE_BASE + "pyodide.asm.wasm"]);
    expect(await prunePyodide(s.storage)).toBe(2);
    expect(s.left().filter((u) => u.includes("v0.26.3")), "quedó Pyodide 0.26.3 en arcanum-pyodide").toEqual([]);
    expect(s.left()).toEqual([PYODIDE_BASE + "pyodide.js", PYODIDE_BASE + "pyodide.asm.wasm"]);
  });
  it("sin la caché no crea nada ni falla", async () => {
    const storage = { has: async () => false, open: async () => { throw new Error("no debía abrirse"); } } as unknown as CacheStorage;
    expect(await prunePyodide(storage)).toBe(0);
  });
});

describe("precacheCounts", () => {
  it("con una llave ausente da 208 de 209", async () => {
    const map = new Map<string, string>();
    for (let i = 0; i < 209; i++) map.set(`/_next/static/chunks/${i}.js`, `/_next/static/chunks/${i}.js?__WB_REVISION__=x`);
    const falta = "/_next/static/chunks/77.js?__WB_REVISION__=x";
    const cache = { match: async (k: string) => (k === falta ? undefined : ({} as Response)) };
    const r = await precacheCounts(map, cache);
    expect(r.total).toBe(209);
    expect(r.listos, "el precache salió completo con 208 de 209").toBe(208);
  });
});
