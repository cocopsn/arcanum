import { afterEach, describe, expect, it, vi } from "vitest";
import type { OfflinePlan } from "@/forge/offline/plan";
import { partialText, scopeStatus, type VerifyDeps } from "@/forge/offline/verify";
import { forgeBookCacheFiles } from "@/lib/offline/api";
import { OPAQUE_PAD_BYTES } from "@/lib/offline/rules";
import { PYODIDE_FILES } from "@/lib/pyodide-files";

// The state of a route verified against storage (design poblar §6.4 «Estado»). Red-check in
// redchecks-offline-motor.md: ignoring `app` → «la ruta salió Descargada sin el precache completo».

const SHA = (i: number) => String(i).padStart(10, "0");
const plan: OfflinePlan = {
  key: "forge:p2",
  libros: Array.from({ length: 8 }, (_, i) => ({ code: `P2-0${i + 1}`, file: `p2-0${i + 1}.${SHA(i)}.md`, bytes: 1000 + i })),
  bancos: ["P2-01", "P2-02"],
  python: true,
  sqlite: true,
  atlas: [
    { file: "docs/en/foundry/a.0000000001.json", bytes: 300 },
    { file: "docs/en/foundry/b.0000000002.json", bytes: 400 },
  ],
  figuras: ["https://www.palantir.com/docs/resources/a.png", "https://www.palantir.com/docs/resources/b.png", "https://www.palantir.com/docs/resources/c.png"],
};
const sixReady = { listos: 6, total: 6, faltan: [], bytes: 1 };

function deps(o: { librosNo?: string[]; app?: { listos: number; total: number } | null; atlasNo?: string[]; python?: VerifyDeps["python"]; figurasSi?: number } = {}): VerifyDeps {
  return {
    bookRow: async (code) => (o.librosNo?.includes(code) ? null : { source: "seed", sha10: SHA(Number(code.slice(-1)) - 1) }),
    bookCacheFiles: async () => new Set(),
    bankRow: async () => true,
    atlasCached: async (u) => !(o.atlasNo ?? []).includes(u),
    python: o.python ?? (async () => sixReady),
    figureCached: async (u) => plan.figuras.indexOf(u) < (o.figurasSi ?? 3),
    precache: async () => (o.app === undefined ? { listos: 209, total: 209 } : o.app),
  };
}

describe("scopeStatus", () => {
  it("completa sólo con libros, bancos, Atlas, Python y la app completos", async () => {
    const s = await scopeStatus(plan, deps());
    expect(s.completa).toBe(true);
    expect(s.atlas).toMatchObject({ listos: 3, total: 3 });
    expect(s.libros.bytes).toBe(plan.libros.reduce((n, l) => n + l.bytes, 0));
    expect(partialText(s)).toBeNull();
  });
  it("sin el precache completo (o sin SW) no sale Descargada", async () => {
    for (const app of [null, { listos: 208, total: 209 }]) {
      const s = await scopeStatus(plan, deps({ app }));
      expect(s.completa, "la ruta salió Descargada sin el precache completo").toBe(false);
    }
    expect(partialText(await scopeStatus(plan, deps({ app: null })))).toBe("La app aún no está instalada para usarse sin red: ábrela una vez con conexión");
  });
  it("texto parcial exacto y cifras de lo que falta", async () => {
    const s = await scopeStatus(plan, deps({ librosNo: ["P2-03"], atlasNo: ["/atlas/v1/docs/en/foundry/b.0000000002.json"], figurasSi: 1, python: async () => ({ listos: 5, total: 6, faltan: ["sqlite3-1.0.0.zip"], bytes: 0 }) }));
    expect(s.completa).toBe(false);
    expect(s.libros.faltan).toEqual(["P2-03"]);
    expect(partialText(s)).toBe(
      "7 de 8 libros listos sin red; 1 falló: Reintentar · 2 de 3 archivos del Atlas listos sin red; 1 falló: Reintentar · 5 de 6 archivos de Python listos sin red; 1 falló: Reintentar",
    );
    expect(s.bytesPrevistos).toBe(1002 + 400 + PYODIDE_FILES["sqlite3-1.0.0.zip"].bytes);
    expect(s.cuotaFiguras).toBe(2 * OPAQUE_PAD_BYTES);
    // the figures are reported apart and never decide «completa»
    expect(s.figuras).toMatchObject({ listos: 1, total: 3, bytes: null });
  });
  it("una ruta sin Python tiene python null; sin Cache API cuenta los seis como faltantes", async () => {
    expect((await scopeStatus({ ...plan, python: false, sqlite: false }, deps())).python).toBeNull();
    const s = await scopeStatus(plan, deps({ python: async () => null }));
    expect(s.python).toMatchObject({ listos: 0, total: 6 });
    expect(s.completa).toBe(false);
  });
  it("un libro de otro sha10 en Dexie no cuenta como listo", async () => {
    const d = deps();
    d.bookRow = async () => ({ source: "seed", sha10: "ffffffffff" });
    const s = await scopeStatus(plan, d);
    expect(s.libros.listos).toBe(0);
  });
});

describe("forgeBookCacheFiles (anexo r2 [15])", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("devuelve NOMBRES de archivo, no URLs, y sólo los de libros", async () => {
    const keys = ["https://arcanum.test/forge/books/v1/p2-06.0123456789.md", "https://arcanum.test/forge/books/v1/notas.md", "https://arcanum.test/otra/p2-06.0123456789.md"].map((url) => ({ url }));
    vi.stubGlobal("caches", { has: async () => true, open: async () => ({ keys: async () => keys }) });
    const files = await forgeBookCacheFiles();
    expect([...(files ?? [])], "forgeBookCacheFiles devolvió URLs en lugar de nombres de archivo").toEqual(["p2-06.0123456789.md"]);
  });
  it("sin Cache API es null", async () => {
    vi.stubGlobal("caches", undefined);
    expect(await forgeBookCacheFiles()).toBeNull();
  });
});
