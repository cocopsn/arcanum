// @vitest-environment node
// Contrato cliente-Edge del compañero (design §13.2, §13.7). La Edge es código de Deno y no puede importar la app, así
// que declara sus enumeraciones y techos otra vez; esta prueba lee el FUENTE de la Edge, extrae los arreglos COMP_* y el
// literal de COMP_LIMITES, y los compara por igualdad profunda con src/lib/companion/tipos.ts. También exige que
// validateCompanion no escriba un techo a mano (un número de tres o más cifras fuera de COMP_LIMITES). Los red-checks
// cambian una copia en memoria del fuente.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMPETENCIAS,
  ESTADOS_CELDA,
  FASES,
  FUENTES_FASE,
  LIMITES,
  PEDIDOS,
  SUPERFICIES,
  TIPOS_EJERCICIO,
  TIPOS_PASAJE,
} from "@/lib/companion/tipos";

const src = readFileSync(join(process.cwd(), "supabase", "functions", "ai-router", "index.ts"), "utf8");

/** Cada enumeración del cliente y su par en la Edge. */
const PARES: [string, readonly string[], string][] = [
  ["FASES", FASES, "COMP_FASES"],
  ["FUENTES_FASE", FUENTES_FASE, "COMP_FUENTES"],
  ["SUPERFICIES", SUPERFICIES, "COMP_SUPERFICIES"],
  ["ESTADOS_CELDA", ESTADOS_CELDA, "COMP_ESTADOS"],
  ["COMPETENCIAS", COMPETENCIAS, "COMP_COMPETENCIAS"],
  ["PEDIDOS", PEDIDOS, "COMP_PEDIDOS"],
  ["TIPOS_PASAJE", TIPOS_PASAJE, "COMP_TIPOS_PASAJE"],
  ["TIPOS_EJERCICIO", TIPOS_EJERCICIO, "COMP_TIPOS_EJ"],
];

/** El arreglo literal `const <nombre> = [...];` de la Edge (sólo cadenas entre comillas dobles). */
function arregloEdge(source: string, nombre: string): string[] | null {
  const m = new RegExp(`^const ${nombre} = (\\[[^\\]]*\\]);`, "m").exec(source);
  if (!m?.[1]) return null;
  const v: unknown = JSON.parse(m[1]);
  return Array.isArray(v) && v.every((x) => typeof x === "string") ? v : null;
}

/** El literal de COMP_LIMITES, validado por texto antes de evaluarlo. */
function limitesEdge(source: string): { ok: true; valor: unknown } | { ok: false; motivo: string } {
  const head = "const COMP_LIMITES = ";
  const a = source.indexOf(head);
  if (a < 0) return { ok: false, motivo: "COMP_LIMITES no existe en la Edge" };
  const b = source.indexOf(" as const;", a);
  if (b < 0) return { ok: false, motivo: "COMP_LIMITES no termina en «as const;»" };
  const lit = source.slice(a + head.length, b);
  if (!/^[\s{}\w:,]+$/.test(lit)) return { ok: false, motivo: "COMP_LIMITES trae algo más que llaves, identificadores, números, comas y dos puntos" };
  return { ok: true, valor: new Function(`return (${lit});`)() };
}

/** La primera ruta donde dos valores difieren (llaves, tipos o números). */
function primeraDiferencia(a: unknown, b: unknown, ruta = ""): string | null {
  const esObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
  if (esObj(a) && esObj(b)) {
    const llaves = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    for (const k of llaves) {
      const d = primeraDiferencia(a[k], b[k], ruta ? `${ruta}.${k}` : k);
      if (d !== null) return d;
    }
    return null;
  }
  return Object.is(a, b) ? null : ruta || "(raíz)";
}

/** El cuerpo de validateCompanion: desde su declaración hasta la siguiente declaración de nivel superior. */
function cuerpoValidar(source: string): string | null {
  const a = source.search(/^function validateCompanion\(/m);
  if (a < 0) return null;
  const resto = source.slice(a + 1);
  const n = resto.search(/^(?:async function|function|const|class|interface|type) \w+|^Deno\.serve\(/m);
  return source.slice(a, n < 0 ? source.length : a + 1 + n);
}

export function contratoFindings(source: string): string[] {
  const out: string[] = [];
  for (const [cliente, valores, edge] of PARES) {
    const e = arregloEdge(source, edge);
    if (e === null) {
      out.push(`${edge} no existe en la Edge o no es un arreglo de cadenas`);
      continue;
    }
    const sobra = e.filter((x) => !valores.includes(x));
    const falta = valores.filter((x) => !e.includes(x));
    if (sobra.length || falta.length || e.join() !== valores.join()) {
      const det = [...sobra.map((x) => `sólo en la Edge: ${x}`), ...falta.map((x) => `sólo en el cliente: ${x}`)];
      out.push(`${cliente} y ${edge} no coinciden: ${det.length ? det.join(", ") : "orden distinto"}`);
    }
  }
  const lim = limitesEdge(source);
  if (!lim.ok) out.push(lim.motivo);
  else {
    const d = primeraDiferencia(LIMITES, lim.valor);
    if (d !== null) out.push(`LIMITES y COMP_LIMITES no coinciden: ${d}`);
  }
  const cuerpo = cuerpoValidar(source);
  if (cuerpo === null) out.push("validateCompanion no existe en la Edge");
  else {
    const numeros = cuerpo.match(/(?<![\w.])\d[\d_]{2,}(?![\w])/g) ?? [];
    if (numeros.length) out.push(`validateCompanion escribe un techo a mano fuera de COMP_LIMITES: ${numeros.join(", ")}`);
  }
  return out;
}

describe("contrato cliente-Edge del compañero (§13.2, §13.7)", () => {
  it("las enumeraciones COMP_* y COMP_LIMITES de la Edge son las de tipos.ts, y validateCompanion no escribe techos a mano", () => {
    expect(contratoFindings(src)).toEqual([]);
  });

  it("el literal de COMP_LIMITES se extrae del fuente y es exactamente LIMITES", () => {
    const lim = limitesEdge(src);
    expect(lim.ok).toBe(true);
    if (lim.ok) expect(lim.valor).toEqual(LIMITES);
  });

  it("red-check: una fase agregada sólo en la Edge → «FASES y COMP_FASES no coinciden: sólo en la Edge: repasar»", () => {
    const copia = src.replace('const COMP_FASES = ["predecir",', 'const COMP_FASES = ["repasar", "predecir",');
    expect(copia).not.toBe(src);
    expect(contratoFindings(copia)).toContain("FASES y COMP_FASES no coinciden: sólo en la Edge: repasar");
  });

  it("red-check: mundo: 300 sólo en COMP_LIMITES → «LIMITES y COMP_LIMITES no coinciden: ubicacion.mundo»", () => {
    const copia = src.replace("    mundo: 80, celdaTitulo: 200,", "    mundo: 300, celdaTitulo: 200,");
    expect(copia).not.toBe(src);
    expect(contratoFindings(copia)).toContain("LIMITES y COMP_LIMITES no coinciden: ubicacion.mundo");
  });

  it("red-check: un techo escrito a mano en validateCompanion → «validateCompanion escribe un techo a mano fuera de COMP_LIMITES: 2_000»", () => {
    const copia = src.replace("const pregunta = str(raw.pregunta, 1, L.pregunta);", "const pregunta = str(raw.pregunta, 1, 2_000);");
    expect(copia).not.toBe(src);
    expect(contratoFindings(copia)).toContain("validateCompanion escribe un techo a mano fuera de COMP_LIMITES: 2_000");
  });

  it("red-check: código en COMP_LIMITES → no se evalúa", () => {
    const copia = src.replace("contexto: 60_000, pregunta: 2_000,", "contexto: (globalThis.x = 60_000), pregunta: 2_000,");
    expect(copia).not.toBe(src);
    expect(contratoFindings(copia)).toContain("COMP_LIMITES trae algo más que llaves, identificadores, números, comas y dos puntos");
  });
});
