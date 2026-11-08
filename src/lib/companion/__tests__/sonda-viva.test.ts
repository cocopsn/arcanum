// Lotes reales medidos y decisión R4 (design §13.5, §13.8; FEAT-005 tarea 35). Se SALTA sin COMPANION_SONDA. Con
// COMPANION_SONDA apuntando a la carpeta de la tarea, recorre azure-directo/, sonda-viva/ y e2e/fixtures/ (los que
// existan): aplica parsearDiagrama a cada fuente .mmd y armarLote+validarLote a cada lote .md, con un jsRun que delega en
// scripts/companion/js-aislado.mjs (proceso hijo aislado, nunca new Function en este proceso). Escribe lotes-medidos.json
// con aceptados y rechazados por fuente. Si se rechaza >50 % de los lotes, la decisión R4 es pasar companion a
// gpt-6.1-sol (una línea en index.ts); la prueba lo deja anotado en lotes-medidos.json, no lo aplica sola.
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parsearDiagrama } from "@/lib/companion/diagrama/parser";
import { armarLote, validarLote } from "@/lib/companion/lote";
import { correrAislado } from "../../../../scripts/companion/js-aislado.mjs";
import type { ExecRunner } from "@/lib/exercises-validate";
import type { RunResult, TestCase } from "@/lib/exercise";

const T = process.env.COMPANION_SONDA;
const describir = T ? describe : describe.skip;

// jsRun que delega en el proceso hijo aislado de js-aislado.mjs (§13.8), adaptado al contrato de ExecRunner.
async function jsRunAislado(code: string, functionName: string, cases: TestCase[]): Promise<RunResult> {
  const reales = cases.filter((c) => !c.hint);
  const r = await correrAislado({ codigo: code, funcion: functionName, casos: reales.map((c) => ({ input: c.input, expected: c.expected })) });
  if (r.estado === "tiempo" || r.estado === "matado") return { syntaxError: null, cases: [], timedOut: true };
  if (r.estado !== "ok" || !r.resultados) return { syntaxError: "ejecución aislada falló", cases: [] };
  return {
    syntaxError: null,
    cases: reales.map((c, i) => {
      const x = r.resultados![i];
      return { input: c.input, expected: c.expected, output: x?.obtenido, error: x?.error, pass: !!x?.pasa };
    }),
  };
}

const jsRun: ExecRunner = jsRunAislado;

function fuentesEn(dir: string): { ruta: string; tipo: "diagrama" | "lote" }[] {
  if (!existsSync(dir)) return [];
  const out: { ruta: string; tipo: "diagrama" | "lote" }[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) continue;
    if (/\.mmd$/i.test(e)) out.push({ ruta: p, tipo: "diagrama" });
    else if (/\.md$/i.test(e)) out.push({ ruta: p, tipo: "lote" });
  }
  return out;
}

describir("sonda-viva: lotes y diagramas reales medidos (§13.5, §13.8)", () => {
  it("mide cada fuente real y escribe lotes-medidos.json", { timeout: 120_000 }, async () => {
    const base = T!;
    const dirs = [join(base, "azure-directo"), join(base, "sonda-viva"), join(base, "e2e", "fixtures")];
    const fuentes = dirs.flatMap(fuentesEn);

    const diagramas: { fuente: string; ok: boolean; motivo?: string }[] = [];
    const lotes: { fuente: string; aceptado: boolean; motivo?: string; practicables?: number }[] = [];
    const rel = (ruta: string) => ruta.replace(/\\/g, "/").replace(base.replace(/\\/g, "/"), "").replace(/^\//, "");

    for (const f of fuentes) {
      const texto = readFileSync(f.ruta, "utf8");
      if (f.tipo === "diagrama") {
        const r = parsearDiagrama(texto);
        diagramas.push({ fuente: rel(f.ruta), ok: r.ok, motivo: r.ok ? undefined : `${r.motivo} (línea ${r.linea})` });
      } else {
        const armado = armarLote(texto, { tema: "sonda", mundo: "forge", lenguaje: "javascript" });
        if (!armado.ok) {
          lotes.push({ fuente: rel(f.ruta), aceptado: false, motivo: `contrato: ${armado.motivo}` });
          continue;
        }
        const val = await validarLote(armado.md, { jsRun });
        lotes.push({
          fuente: rel(f.ruta),
          aceptado: val.ok,
          motivo: val.ok ? undefined : val.motivo,
          practicables: val.ok ? val.practicables.length : undefined,
        });
      }
    }

    const totalLotes = lotes.length;
    const rechazados = lotes.filter((l) => !l.aceptado).length;
    const proporcionRechazo = totalLotes > 0 ? rechazados / totalLotes : 0;
    const r4 =
      totalLotes === 0
        ? "sin lotes reales"
        : proporcionRechazo > 0.5
          ? "más del 50 % rechazados: pasar companion a gpt-6.1-sol (index.ts) y re-correr la Edge (decisión R4)"
          : "menos del 50 % rechazados: companion sigue en gpt-6.1-terra";

    const salida = {
      medido: new Date().toISOString(),
      fuentes: fuentes.length,
      diagramas: { total: diagramas.length, ok: diagramas.filter((d) => d.ok).length, detalle: diagramas },
      lotes: { total: totalLotes, aceptados: totalLotes - rechazados, rechazados, proporcionRechazo: Number(proporcionRechazo.toFixed(3)), detalle: lotes },
      r4,
    };
    writeFileSync(join(base, "lotes-medidos.json"), JSON.stringify(salida, null, 2), "utf8");

    // La prueba no exige una tasa de aceptación concreta (el modelo es externo); exige que midió y escribió el archivo.
    expect(existsSync(join(base, "lotes-medidos.json"))).toBe(true);
    expect(salida.fuentes).toBeGreaterThanOrEqual(0);
  });
});
