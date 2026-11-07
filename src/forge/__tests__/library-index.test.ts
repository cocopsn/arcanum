import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { explainExercisesMd } from "@/lib/exercises-md";
import { validateBank } from "@/lib/exercises-validate";
import { parseBook } from "@/lib/book";
import { authoringState, type ForgeArtifacts } from "@/forge/model/authoring";
import type { LibraryIndex } from "@/forge/model/library-types";
import { bankPendientes, buildLibraryIndex, executableIds } from "../../../scripts/forge/library-index.mjs";
import { parseBank } from "../../../scripts/forge/bank-check.mjs";

// PARIDAD de library-index.json (design poblar §5.2). El índice se arma en el build con sus propias reglas. Esta prueba
// lo compara, celda por celda, con authoringState() de authoring.ts y con la INGESTA real (explainExercisesMd +
// validateBank como la semilla), que es la que decide qué ítems quedan pendientes en el dispositivo.
const ROOT = process.cwd();
const sha10 = (b: Buffer) => createHash("sha256").update(b).digest("hex").slice(0, 10);
const routeFiles = ["a1", "a2", "expedientes", "f0", "f1", "f2", "p1", "p2", "p3", "p4", "p5", "s1", "s2", "sw1", "sw2", "sw3", "sw4"];

type Cell = Parameters<typeof authoringState>[0] & { code: string };
const cells: Cell[] = routeFiles.flatMap((f) => {
  const r = JSON.parse(readFileSync(join(ROOT, "src/forge/data/routes", `${f}.json`), "utf8")) as { cells: (Cell & { cls: string })[] };
  return r.cells.filter((c) => c.cls === "ruta" || c.cls === "expediente");
});
const bookIndex = JSON.parse(readFileSync(join(ROOT, "src/forge/data/book-index.json"), "utf8")) as Record<string, unknown>;
const index = buildLibraryIndex(ROOT) as LibraryIndex;

describe("library-index · paridad con authoring.ts y la ingesta (design poblar §5.2)", () => {
  it("tiene una entrada por cada celda de ruta y de expediente, y ninguna más", () => {
    expect(Object.keys(index.celdas).sort()).toEqual(cells.map((c) => c.code).sort());
  });

  it(
    "estado, pendientes y generated_by coinciden en todas las celdas",
    async () => {
      const fallas: string[] = [];
      for (const cell of cells) {
        const code = cell.code;
        const low = code.toLowerCase();
        const got = index.celdas[code]!;
        const bankPath = join(ROOT, "content/forge/exercises", `${low}.md`);
        let artifacts: ForgeArtifacts = { book: Object.prototype.hasOwnProperty.call(bookIndex, code), bank: null, verification: null };
        let pendientesIngesta: string[] = [];
        if (existsSync(bankPath)) {
          const buf = readFileSync(bankPath);
          const md = buf.toString("utf8");
          const r = explainExercisesMd(md);
          const v = r.ok ? await validateBank(r.bank, { source: "seed", trustPython: true }) : null;
          pendientesIngesta = v && v.ok ? v.pendientes.map((p) => p.slice(p.lastIndexOf(":") + 1)).sort() : [];
          const items = (parseBank(md) as { id: string; secciones: { cercas: { lenguaje: string }[] }[] }[]).map((it) => ({
            id: it.id,
            langs: it.secciones.flatMap((s) => s.cercas.map((c) => c.lenguaje)),
          }));
          const verPath = join(ROOT, "content/forge/verification", `${low}.json`);
          const verification = existsSync(verPath) ? (JSON.parse(readFileSync(verPath, "utf8")) as ForgeArtifacts["verification"]) : null;
          artifacts = { ...artifacts, bank: { sha10: sha10(buf), valid: !!(v && v.ok), items, pendientes: pendientesIngesta }, verification };
          const gotPend = [...(got.banco?.pendientes ?? [])].sort();
          if (JSON.stringify(gotPend) !== JSON.stringify(pendientesIngesta)) fallas.push(`${code}: pendientes del índice [${gotPend.join(", ")}] y de la ingesta [${pendientesIngesta.join(", ")}]`);
          const ingestaGen = r.ok ? (r.bank.meta as { generatedBy?: string }).generatedBy ?? "" : "";
          if (r.ok && ingestaGen !== undefined && got.banco && got.banco.generated_by !== ingestaGen) fallas.push(`${code}: el generated_by del banco en el índice no es el de la ingesta`);
          if (got.autoria.ejecutables !== executableIds(parseBank(md)).length) fallas.push(`${code}: ejecutables del índice ${got.autoria.ejecutables}`);
        }
        const esperado = authoringState(cell, artifacts);
        if (got.autoria.estado !== esperado) fallas.push(`${code}: library-index dice ${got.autoria.estado} y authoring.ts dice ${esperado}`);
        const bookSrc = join(ROOT, "content/forge/books", `${low}.md`);
        if (got.libro && existsSync(bookSrc)) {
          const pb = parseBook(readFileSync(bookSrc, "utf8"));
          const gen = pb?.meta?.generatedBy ?? "";
          if (got.libro.generated_by !== gen) fallas.push(`${code}: el generated_by del índice trae comillas y el de parseBook no («${got.libro.generated_by}» ≠ «${gen}»)`);
        }
      }
      expect(fallas, fallas.slice(0, 6).join("\n")).toEqual([]);
    },
    120_000,
  );

  it("P2-06 queda Verificado: sin pendientes y sus 4 ejecutables con verificación vigente", () => {
    const c = index.celdas["P2-06"]!;
    expect(c.banco!.pendientes, "P2-06 quedó con pendientes tras volver reales los chequeos").toEqual([]);
    expect(c.autoria).toEqual({ estado: "verificado", ejecutables: 4, sin_verificar: 0 });
  });

  it("bankPendientes sólo marca los tipos con stub (regla de pendientes, rc25)", () => {
    const items = [
      { id: "a", tipo: "mutantes", enunciado: "", secciones: [] },
      { id: "b", tipo: "contraejemplo", enunciado: "", secciones: [] },
      { id: "c", tipo: "historial", enunciado: "modo: fallas", secciones: [] },
    ];
    // con un tipo stub sintético «mutantes», sólo ese ítem queda pendiente; historial fallas ya NO es pendiente.
    expect(bankPendientes(items, new Set(["mutantes"])), "bankPendientes ignoró un tipo con stub").toEqual(["a"]);
    expect(bankPendientes(items, new Set()), "bankPendientes marcó un tipo sin stub").toEqual([]);
  });

  it("las 8 celdas de P5 no traen libro ni banco y quedan Especificadas", () => {
    const p5 = Object.entries(index.celdas).filter(([k]) => k.startsWith("P5-"));
    expect(p5).toHaveLength(8);
    for (const [, c] of p5) {
      expect(c.libro).toBeNull();
      expect(c.autoria.estado).toBe("especificado");
    }
  });

  it("el índice es determinista y no trae prosa (sólo títulos, conteos, estados y generated_by)", () => {
    const again = buildLibraryIndex(ROOT);
    expect(JSON.stringify(again)).toBe(JSON.stringify(index));
    for (const c of Object.values(index.celdas)) {
      if (c.libro) expect(Object.keys(c.libro).sort()).toEqual(["bytes", "estado_declarado", "file", "generated_by", "minutes", "sha10", "title"]);
      if (c.banco) expect(Object.keys(c.banco).sort()).toEqual(["codigo", "generated_by", "items", "pendientes", "sha10", "title"]);
    }
  });
});
