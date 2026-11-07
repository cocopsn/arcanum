import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteScope, realDeleteDeps, type DeleteDeps } from "@/forge/offline/delete";
import { forgeCellId } from "@/forge/ids";
import { forgeBankSource, forgeBookIndex } from "@/forge/loaders";
import { deleteBook, getBookForModule, saveBook } from "@/lib/book-store";
import { deleteBank, getBanksForModule, saveExerciseBank } from "@/lib/exercise-store";
import type { OfflinePlan } from "@/forge/offline/plan";
import type { OfflineRouteRow } from "@/lib/offline-store";

// Deleting a route (design poblar §6.4 «Borrado») over an in-memory device: Dexie rows (seed and import), the book,
// Atlas and figure caches, and the log. Red-check in redchecks-offline-motor.md: deleting shared partitions →
// «borrar P2 rompió la partición compartida con P1».

const SHARED = "docs/en/foundry/ontology.0000000001.json";
const P2_ONLY = "docs/en/foundry/p2.0000000002.json";
const FIG_SHARED = "https://www.palantir.com/docs/resources/shared.png";
const FIG_P2 = "https://www.palantir.com/docs/resources/p2.png";

function device() {
  const books = new Map<string, { source: "seed" | "import"; bytes: number }>([
    ["P1-01", { source: "seed", bytes: 100 }],
    ["P2-01", { source: "seed", bytes: 200 }],
    ["P2-02", { source: "import", bytes: 999 }],
  ]);
  const bookFiles = new Map<string, number>([["P1-01", 110], ["P2-01", 210], ["P2-02", 0]]);
  const banks = new Map<string, { source: "seed" | "import"; bytes: number }>([["P1-01", { source: "seed", bytes: 10 }], ["P2-01", { source: "seed", bytes: 20 }], ["P2-02", { source: "seed", bytes: 30 }]]);
  const atlas = new Map<string, number>([[SHARED, 5000], [P2_ONLY, 700]]);
  const figuras = new Set([FIG_SHARED, FIG_P2]);
  let permitted: string[] = [FIG_SHARED, FIG_P2];
  const log = ["evento-1", "evento-2"]; // the event log («arcanum»): nothing here may touch it
  const rows: OfflineRouteRow[] = [
    { key: "forge:p1", world: "forge", slug: "p1", ts: 1, recursos: { libros: ["P1-01"], atlas: [SHARED], figuras: [FIG_SHARED] } },
    { key: "forge:p2", world: "forge", slug: "p2", ts: 2, recursos: { libros: ["P2-01", "P2-02"], atlas: [SHARED, P2_ONLY], figuras: [FIG_SHARED, FIG_P2] } },
  ];
  const deps: DeleteDeps = {
    listRoutes: async () => [...rows],
    deleteRoute: async (k) => void rows.splice(rows.findIndex((r) => r.key === k), 1),
    deleteBookLocal: async (code) => {
      let freed = 0;
      const b = books.get(code);
      if (b?.source === "seed") {
        freed += b.bytes;
        books.delete(code);
      }
      freed += bookFiles.get(code) ?? 0;
      bookFiles.delete(code);
      return freed;
    },
    deleteBankSeed: async (code) => {
      const b = banks.get(code);
      if (b?.source !== "seed") return 0;
      banks.delete(code);
      return b.bytes;
    },
    deleteAtlasFile: async (f) => {
      const b = atlas.get(f) ?? 0;
      atlas.delete(f);
      return b;
    },
    deleteFigures: async (us) => us.filter((u) => figuras.delete(u)).length,
    writePermitted: async (us) => void (permitted = us),
    afterDelete: async () => {},
  };
  return { deps, books, banks, atlas, figuras, rows, log, permitted: () => permitted };
}
afterEach(() => vi.unstubAllGlobals());
const p2Plan: OfflinePlan = {
  key: "forge:p2",
  libros: [{ code: "P2-01", file: "p2-01.0123456789.md", bytes: 210 }, { code: "P2-02", file: "p2-02.0123456789.md", bytes: 0 }],
  bancos: ["P2-01", "P2-02"],
  python: true,
  sqlite: false,
  atlas: [{ file: SHARED, bytes: 5000 }, { file: P2_ONLY, bytes: 700 }],
  figuras: [FIG_SHARED, FIG_P2],
};

describe("deleteForgeRoute", () => {
  it("borrar P2 deja lo compartido con P1, borra lo exclusivo y mide los bytes", async () => {
    const d = device();
    const r = await deleteScope("forge:p2", p2Plan, d.deps);
    expect(d.atlas.has(SHARED), "borrar P2 rompió la partición compartida con P1").toBe(true);
    expect(d.atlas.has(P2_ONLY)).toBe(false);
    expect(d.figuras.has(FIG_SHARED), "borrar P2 borró una figura que P1 también usa").toBe(true);
    expect(d.figuras.has(FIG_P2)).toBe(false);
    expect(d.permitted()).toEqual([FIG_SHARED]);
    expect(r).toEqual({ liberadosBytes: 200 + 210 + 20 + 30 + 700, compartidosBytes: 5000, figurasBorradas: 1, errores: [] });
    expect(d.rows.map((x) => x.key)).toEqual(["forge:p1"]);
  });
  it("nunca toca una importación, el log, ni lo de P1", async () => {
    const d = device();
    await deleteScope("forge:p2", p2Plan, d.deps);
    expect(d.books.get("P2-02"), "borrar la ruta borró una importación").toEqual({ source: "import", bytes: 999 });
    expect(d.books.has("P1-01") && d.banks.has("P1-01")).toBe(true);
    expect(d.log).toEqual(["evento-1", "evento-2"]);
  });
  it("si una caché lanza, informa lo que no se borró y borra lo demás", async () => {
    const d = device();
    d.deps.deleteAtlasFile = async () => {
      throw new Error("caché rota");
    };
    const r = await deleteScope("forge:p2", p2Plan, d.deps);
    expect(r.errores).toEqual([`No se pudo borrar la partición ${P2_ONLY}`]);
    expect(d.books.has("P2-01")).toBe(false);
    expect(d.rows.map((x) => x.key)).toEqual(["forge:p1"]);
  });
  it("las dependencias reales (fake-indexeddb) borran las filas seed y nunca las importadas", async () => {
    vi.stubGlobal("caches", undefined);
    const cell = forgeCellId("F1-01");
    const md = readFileSync(path.join(process.cwd(), "public/forge/books/v1", (await forgeBookIndex())["F1-01"]!.file), "utf8");
    const bankMd = await forgeBankSource.load("F1-01");
    const real = realDeleteDeps();
    for (const r of await getBanksForModule(cell)) await deleteBank(r.id);
    const prev = await getBookForModule(cell);
    if (prev) await deleteBook(prev.id);

    expect(await saveBook(md, "import")).not.toBeNull();
    expect((await saveExerciseBank(bankMd, { source: "import" })).ok).toBe(true);
    await real.deleteBookLocal("F1-01");
    await real.deleteBankSeed("F1-01");
    expect((await getBookForModule(cell))?.source, "borrar la ruta borró una importación").toBe("import");
    expect((await getBanksForModule(cell)).map((r) => r.source), "borrar la ruta borró un banco importado").toEqual(["import"]);

    await deleteBook((await getBookForModule(cell))!.id);
    for (const r of await getBanksForModule(cell)) await deleteBank(r.id);
    await saveBook(md, "seed");
    expect((await saveExerciseBank(bankMd, { source: "seed" })).ok).toBe(true);
    expect(await real.deleteBookLocal("F1-01")).toBeGreaterThan(0);
    expect(await real.deleteBankSeed("F1-01")).toBeGreaterThan(0);
    expect(await getBookForModule(cell)).toBeNull();
    expect(await getBanksForModule(cell)).toEqual([]);
  });
  it("borrar el mundo borra todo lo de Forge registrado (sin Python ni importaciones)", async () => {
    const d = device();
    const r = await deleteScope("forge:mundo", null, d.deps, true);
    expect(d.rows).toEqual([]);
    expect(d.atlas.size).toBe(0);
    expect(d.figuras.size).toBe(0);
    expect(d.books.get("P2-02")?.source).toBe("import");
    expect(r.compartidosBytes).toBe(0);
  });
});
