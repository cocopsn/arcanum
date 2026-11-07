import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { forgeRows, type ForgeRowsInput } from "@/forge/model/library-catalog";
import { applyFilter, groupByWorld, totals, worldOptions, DEFAULT_FILTER } from "@/lib/library/filter";
import { classicRows } from "@/lib/library/catalog";
import { forgeCellId } from "@/forge/ids";
import { FORGE_GOAL_ID } from "@/core/forge-verdict";
import { buildLibraryIndex } from "../../../scripts/forge/library-index.mjs";
import { parseBank } from "../../../scripts/forge/bank-check.mjs";
import pilots from "@/forge/data/pilots.json";
import type { LibraryIndex } from "@/forge/model/library-types";
import type { BookRow } from "@/lib/book-store";
import type { ReadModel } from "@/core/read-model";

// Las filas de Engineering Forge en Lecturas (design poblar §5.1, §5.3, §5.6 y D12), desde el índice real del build.
const index = buildLibraryIndex(process.cwd()) as LibraryIndex;
const rm = { goals: [{ id: FORGE_GOAL_ID, title: "Engineering Forge", archived: false }], paths: [], modules: [], edges: [], evidence: [], pendingAi: [] } as unknown as ReadModel;
const base = (over: Partial<ForgeRowsInput> = {}): ForgeRowsInput => ({
  index,
  readModel: rm,
  books: [],
  banks: [],
  bookSha10: new Map(),
  bankSha10: new Map(),
  cacheFiles: null,
  precacheListo: false,
  ...over,
});

describe("Lecturas · filas de Engineering Forge (design poblar §5.1)", () => {
  const rows = forgeRows(base());
  it("las 136 celdas dan 136 filas de libro (128 con libro y 8 pendientes de P5) y 128 de banco", () => {
    const libros = rows.filter((r) => r.kind === "libro");
    expect(libros).toHaveLength(136);
    expect(libros.filter((r) => r.disponible === "pendiente").map((r) => r.cell.code)).toEqual(["P5-01", "P5-02", "P5-03", "P5-04", "P5-05", "P5-06", "P5-07", "P5-08"]);
    expect(rows.filter((r) => r.kind === "banco")).toHaveLength(128);
    const t = totals(rows);
    expect(t).toEqual({ libros: 128, especificados: 8, bancos: 128 });
  });

  it("con el filtro de Forge salen los 128 libros del catálogo, no las filas de Dexie del dispositivo", () => {
    const all = [...classicRows([], [], rm), ...rows];
    const f = applyFilter(all, { ...DEFAULT_FILTER, world: FORGE_GOAL_ID });
    const n = totals(f).libros;
    expect(n, `Engineering Forge muestra ${n} libros y el catálogo tiene 128`).toBe(128);
    const opt = worldOptions(all, DEFAULT_FILTER, rm.goals).find((o) => o.id === FORGE_GOAL_ID)!;
    expect(opt.count).toBe(264);
    const g = groupByWorld(f, [FORGE_GOAL_ID]);
    expect(g[0]!.verificados + g[0]!.autorados).toBe(128);
  });

  it("disponibilidad de un libro de Forge en sus casos (§5.3), sólo desde Dexie y la caché", () => {
    const code = "F0-04";
    const id = forgeCellId(code);
    const cur = index.celdas[code]!.libro!;
    const row = (over: Partial<ForgeRowsInput>) => forgeRows(base(over)).find((r) => r.key === `forge-libro:${code}`)!;
    const seed = { id: "x", moduleId: id, source: "seed", md: "", meta: {} } as unknown as BookRow;
    const imp = { ...seed, source: "import", meta: { generatedBy: "yo" } } as unknown as BookRow;
    expect(row({}).disponible).toBe("no");
    expect(row({ books: [seed], bookSha10: new Map([[id, cur.sha10]]) }).disponible).toBe("si");
    expect(row({ cacheFiles: new Set([cur.file]) }).disponibleDetalle).toBe("En este dispositivo");
    expect(row({ books: [seed], bookSha10: new Map([[id, "0000000000"]]) }).disponible).toBe("anterior");
    const i = row({ books: [imp], bookSha10: new Map([[id, "x"]]) });
    expect([i.disponible, i.autoria, i.generatedBy]).toEqual(["si", "importado", "yo"]);
    const vieja = row({ cacheFiles: new Set(["f0-04.0000000000.md"]) });
    expect(vieja.disponible, "una ruta marcada como descargada sin el archivo en la caché salió En este dispositivo").toBe("no");
  });

  it("un banco de Forge está «incluido» con el precache completo o su fila vigente; si no, pide conexión", () => {
    const b = (over: Partial<ForgeRowsInput>) => forgeRows(base(over)).find((r) => r.key === "forge-banco:P2-06")!;
    expect(b({}).disponible).toBe("no");
    expect(b({ precacheListo: true }).disponible).toBe("incluido");
    const p206 = b({});
    expect(p206.items).toEqual({ total: index.celdas["P2-06"]!.banco!.items, disponibles: index.celdas["P2-06"]!.banco!.items - 3 });
  });

  it("una celda sin módulo vivo se pinta sellada (fail-closed) y ninguna fila trae prosa reservada (D12)", () => {
    expect(rows.every((r) => r.sealed)).toBe(true);
    const P = (pilots as unknown as { pilotos: { code: string; campos: { etiqueta: string; texto?: string; items?: string[] }[] }[] }).pilotos;
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9ñ ]+/g, " ").split(/\s+/).filter(Boolean);
    const grams = (s: string) => { const w = norm(s); const o = new Set<string>(); for (let i = 0; i + 5 <= w.length; i++) o.add(w.slice(i, i + 5).join(" ")); return o; };
    const campos = P.filter((p) => p.code === "F1-03" || p.code === "P2-06").flatMap((p) => p.campos);
    const reservado = campos.flatMap((c) => [c.texto ?? "", ...(c.items ?? [])]).filter((t) => norm(t).length >= 5);
    const texto = JSON.stringify(rows.filter((r) => r.cell.code === "F1-03" || r.cell.code === "P2-06"));
    const pintado = grams(texto);
    for (const t of reservado) for (const g of grams(t)) expect(pintado.has(g), `una fila de Lecturas filtró «${g}»`).toBe(false);
    // ni el enunciado de un ítem (8-gramas, para no confundir el título de la celda con prosa)
    const g8 = (s: string) => { const w = norm(s); const o = new Set<string>(); for (let i = 0; i + 8 <= w.length; i++) o.add(w.slice(i, i + 8).join(" ")); return o; };
    const pintado8 = g8(texto);
    for (const code of ["f1-03", "p2-06"]) {
      const items = parseBank(readFileSync(join(process.cwd(), "content/forge/exercises", `${code}.md`), "utf8")) as { enunciado: string }[];
      for (const it of items) for (const g of g8(it.enunciado)) expect(pintado8.has(g), `una fila de Lecturas filtró el enunciado de un ítem: «${g}»`).toBe(false);
    }
  });
});
