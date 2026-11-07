import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ATLAS_CACHE } from "@/app/sw-rules";
import { ATLAS_FUENTE_KEY, pruneAtlasCache } from "@/forge/atlas/cache";

// Cleanup of arcanum-atlas-v1 by capture (design poblar §6.6). Red-check in redchecks-offline-motor.md: not
// deleting → «quedó una partición de la captura anterior».

const O = "https://arcanum.test";
function fakeCaches(paths: string[]) {
  const keys = paths.map((p) => ({ url: O + p }) as Request);
  const cache = {
    keys: async () => [...keys],
    match: async () => undefined,
    delete: async (r: Request) => {
      const i = keys.findIndex((k) => k.url === r.url);
      if (i >= 0) keys.splice(i, 1);
      return i >= 0;
    },
  };
  return { api: { has: async (n: string) => n === ATLAS_CACHE, open: async () => cache }, left: () => keys.map((k) => k.url.slice(O.length)) };
}
const nuevo = {
  fuente_sha10: "nuevo00001",
  particiones: [{ files: ["docs/en/foundry/ontology.2222222222.json"] }],
  indices: [{ files: ["index/en.0.3333333333.json"] }],
  alias: "alias.4444444444.json",
  capas: { celdas: { archivo: "celdas.5555555555.json" } },
};
beforeEach(() => localStorage.setItem(ATLAS_FUENTE_KEY, "viejo00001"));
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.removeItem(ATLAS_FUENTE_KEY);
});

describe("pruneAtlasCache", () => {
  it("tras cambiar fuente_sha10 quedan sólo los archivos del manifiesto nuevo y los fijos", async () => {
    const c = fakeCaches([
      "/atlas/v1/manifest.json",
      "/atlas/v1/videos/oembed.json",
      "/atlas/v1/docs/en/foundry/ontology.1111111111.json",
      "/atlas/v1/docs/en/foundry/ontology.2222222222.json",
      "/atlas/v1/index/en.0.3333333333.json",
      "/atlas/v1/alias.4444444444.json",
      "/atlas/v1/celdas.5555555555.json",
    ]);
    vi.stubGlobal("caches", c.api);
    expect(await pruneAtlasCache(nuevo)).toBe(1);
    expect(c.left(), "quedó una partición de la captura anterior").not.toContain("/atlas/v1/docs/en/foundry/ontology.1111111111.json");
    expect(c.left()).toEqual([
      "/atlas/v1/manifest.json",
      "/atlas/v1/videos/oembed.json",
      "/atlas/v1/docs/en/foundry/ontology.2222222222.json",
      "/atlas/v1/index/en.0.3333333333.json",
      "/atlas/v1/alias.4444444444.json",
      "/atlas/v1/celdas.5555555555.json",
    ]);
    expect(localStorage.getItem(ATLAS_FUENTE_KEY)).toBe("nuevo00001");
  });
  it("con la misma captura no borra nada; si caches lanza, no borra y no actualiza la llave", async () => {
    localStorage.setItem(ATLAS_FUENTE_KEY, "nuevo00001");
    const c = fakeCaches(["/atlas/v1/docs/en/foundry/ontology.1111111111.json"]);
    vi.stubGlobal("caches", c.api);
    expect(await pruneAtlasCache(nuevo)).toBe(0);
    expect(c.left()).toHaveLength(1);
    localStorage.setItem(ATLAS_FUENTE_KEY, "viejo00001");
    vi.stubGlobal("caches", { has: async () => true, open: async () => { throw new Error("rota"); } });
    expect(await pruneAtlasCache(nuevo)).toBe(0);
    expect(localStorage.getItem(ATLAS_FUENTE_KEY)).toBe("viejo00001");
  });
});
