// BM25 del compañero (design §9.2). Construye un índice real con construir() en un directorio temporal, carga una
// partición con cargarParticionJson y puntúa consultas; comprueba idf/score, los realces y el top 8 con empates.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { construir } from "../../../../scripts/companion/build-index.mjs";
import { cargarParticionJson, type ParticionCargada } from "../indice";
import { K1, B, TOP, buscar, idf, mismoMundo, puntuarParticion, realce, terminosConsulta } from "../bm25";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

type Construido = ReturnType<typeof construir>;
let repo: Construido;
/** Las particiones del repo, ya validadas y cargadas. */
let cargadas: Map<string, ParticionCargada>;

beforeAll(() => {
  repo = construir({ root: ROOT });
  cargadas = new Map();
  for (const p of repo.particiones) {
    const json = JSON.parse(p.texto);
    const c = cargarParticionJson(json, p.nombre);
    if (c) cargadas.set(p.nombre, c);
  }
});

function part(nombre: string): ParticionCargada {
  const p = cargadas.get(nombre);
  if (!p) throw new Error(`falta la partición ${nombre}`);
  return p;
}

describe("constantes y fórmulas (§9.2)", () => {
  it("k1 = 1.2 y b = 0.75", () => {
    expect(K1).toBe(1.2);
    expect(B).toBe(0.75);
    expect(TOP).toBe(8);
  });

  it("idf de Robertson: ln(1 + (N − df + 0.5)/(df + 0.5))", () => {
    expect(idf(100, 1)).toBeCloseTo(Math.log(1 + (100 - 1 + 0.5) / (1 + 0.5)), 10);
    // un término en todos los documentos tiene idf bajo pero no negativo con el +1 de Robertson
    expect(idf(10, 10)).toBeGreaterThan(0);
  });

  it("términos de la consulta sin repetir y tokenizados", () => {
    const t = terminosConsulta("invariante invariante INVARIANTE write");
    expect(new Set(t).size).toBe(t.length);
    expect(t).toContain("invariant");
  });

  it("una consulta sin términos útiles no puntúa nada", () => {
    expect(buscar([part("forge-libros-p2")], "de la y el")).toEqual([]);
    expect(terminosConsulta("de la y el")).toEqual([]);
  });
});

describe("realces (§9.2)", () => {
  it("mismoMundo compara el slug de themeForGoal del spine con el del título del goal", () => {
    expect(mismoMundo("Engineering Forge", "Engineering Forge · Fundamentos")).toBe(true);
    expect(mismoMundo("ITC", "Engineering Forge")).toBe(false);
    expect(mismoMundo("ITC", "Estructuras de datos y algoritmos")).toBe(true); // los dos caen en el slug itc
  });

  it("×1.5 al libro abierto por sha10 y ×1.2 al mundo activo, multiplicativos", () => {
    const p = part("forge-libros-p2");
    const d = p.docs[0]!;
    expect(realce(p, d, {})).toBe(1);
    expect(realce(p, d, { libroSha10: d.sha10 })).toBeCloseTo(1.5, 10);
    expect(realce(p, d, { tituloMundo: "Engineering Forge" })).toBeCloseTo(1.2, 10);
    expect(realce(p, d, { libroSha10: d.sha10, tituloMundo: "Engineering Forge" })).toBeCloseTo(1.8, 10);
  });
});

describe("búsqueda sobre el índice real (§9.2, parte unitaria de CA-17)", () => {
  it("una consulta con palabras de una sección de p2-06.md la deja entre los 3 primeros", () => {
    const p = part("forge-libros-p2");
    const res = puntuarParticion(p, terminosConsulta("write skew invariante actualización perdida"), {}).sort((a, b) => b.puntaje - a.puntaje);
    const top3 = res.slice(0, 3);
    const deP206 = top3.filter((r) => r.archivo === "content/forge/books/p2-06.md");
    expect(deP206.length, `top 3: ${top3.map((r) => `${r.archivo}#${r.ancla}`).join(", ")}`).toBeGreaterThan(0);
  });

  it("devuelve a lo más TOP resultados, ordenados por puntaje", () => {
    const res = buscar([...cargadas.values()], "transaccion invariante escritura concurrente");
    expect(res.length).toBeLessThanOrEqual(TOP);
    for (let i = 1; i < res.length; i++) expect(res[i - 1]!.puntaje).toBeGreaterThanOrEqual(res[i]!.puntaje);
  });

  it("empates por nombre de partición y luego por índice de documento", () => {
    // partición sintética con dos documentos de idéntico puntaje para un término único
    const p = cargarParticionJson(
      {
        f: "arcanum-companion-index/1",
        p: "zz-empate",
        spine: "ITC",
        ruta: null,
        N: 2,
        avgdl: 1,
        s: [["a.md", "a", "A", "aaaaaaaaaa"]],
        d: [
          [0, "x", "Doc X", 1],
          [0, "y", "Doc Y", 1],
        ],
        v: "token",
        q: "0,1",
      },
      "zz-empate",
    )!;
    const res = buscar([p], "token");
    expect(res.map((r) => r.doc)).toEqual([0, 1]);
    expect(res[0]!.puntaje).toBeCloseTo(res[1]!.puntaje, 10);
  });
});
