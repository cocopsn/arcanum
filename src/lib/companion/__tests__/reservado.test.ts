// Filtro de contenido reservado D12 (design §12.7, §23.2 protección (e)). Construye la tabla real con construir() y
// toma los textos reservados de la misma fuente que las pruebas de Forge (pilots.json y los bancos de giro/entrevista
// vía textosReservados). Comprueba que una racha reservada se redacta, que texto público no se toca, y las tres ramas
// de crearRedactor (identidad sin Forge, fallar-cerrado sin tabla con Forge, redacción con tabla).
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { construir, textosReservados } from "../../../../scripts/companion/build-index.mjs";
import { deBase64, decodificarHashes, gramas5, hash48, palabras, contiene } from "../gramas.mjs";
import { MARCA_RESERVADA, crearRedactor, redactarTexto, type TablaReservada } from "../reservado";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const leer = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

let tabla: TablaReservada;
let textoReservado: string;
/** Un 5-grama genuinamente reservado (en la tabla) tomado de un texto reservado real. */
let gramaReservado: string;

beforeAll(() => {
  const repo = construir({ root: ROOT });
  const json = JSON.parse(repo.reservado.texto) as { f: string; h: string };
  tabla = decodificarHashes(deBase64(json.h)!)!;

  // Textos reservados de la misma fuente que cell-panel-reserved.test.tsx y reserved-e3.test.tsx (pilots + bancos).
  const pilotos = JSON.parse(leer("src/forge/data/pilots.json"));
  const bancosForge = readdirSync(path.join(ROOT, "content/forge/exercises"))
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => ({ archivo: `content/forge/exercises/${f}`, md: leer(`content/forge/exercises/${f}`) }));
  const textos = textosReservados({ pilotos, bancos: bancosForge }) as { nombre: string; texto: string }[];

  // Busca un texto reservado con al menos un 5-grama que siga en la tabla (no excluido por ser público).
  for (const t of textos) {
    const ws = palabras(t.texto);
    for (const { i } of gramas5(ws)) {
      const g = ws.slice(i, i + 5).join(" ");
      if (contiene(tabla, hash48(g))) {
        textoReservado = t.texto;
        gramaReservado = g;
        break;
      }
    }
    if (gramaReservado) break;
  }
});

describe("tabla y fuente (§8.5)", () => {
  it("la tabla real trae miles de 5-gramas y se encontró uno reservado en un texto D12", () => {
    expect(tabla.length).toBeGreaterThan(1000);
    expect(gramaReservado, "ningún 5-grama reservado sobrevivió a la exclusión pública").toBeTruthy();
  });
});

describe("redactarTexto (§12.7)", () => {
  it("una racha cubierta por 5-gramas reservados se cambia por «[contenido reservado]»", () => {
    const r = redactarTexto(textoReservado, tabla);
    expect(r.cambio).toBe(true);
    expect(r.texto).toContain(MARCA_RESERVADA);
    // ninguna de las palabras del 5-grama reservado sobrevive seguidas en la salida
    expect(r.texto.toLowerCase()).not.toContain(gramaReservado.split(" ").join(" "));
  });

  it("un texto público corriente no se toca (cambio = false)", () => {
    const publico = "Hoy vamos a estudiar la estructura de una oración simple con un sujeto y un verbo claro.";
    const r = redactarTexto(publico, tabla);
    expect(r.cambio).toBe(false);
    expect(r.texto).toBe(publico);
  });

  it("un texto de menos de cinco palabras nunca se redacta", () => {
    const r = redactarTexto("solo tres palabras", tabla);
    expect(r).toEqual({ texto: "solo tres palabras", cambio: false });
  });
});

describe("crearRedactor (§12.5, «Dónde vive la redacción»)", () => {
  it("sin Forge y sin tabla: la identidad", () => {
    const red = crearRedactor(null, false);
    expect(red("cualquier texto aquí")).toEqual({ texto: "cualquier texto aquí", cambio: false });
  });

  it("con Forge y sin tabla: fallar-cerrado (devuelve null)", () => {
    const red = crearRedactor(null, true);
    expect(red("texto que debería ir redactado pero no hay tabla")).toBeNull();
  });

  it("con tabla: la redacción real, redacta la racha reservada", () => {
    const red = crearRedactor(tabla, true);
    const r = red(textoReservado);
    expect(r).not.toBeNull();
    expect(r!.texto).toContain(MARCA_RESERVADA);
    expect(r!.cambio).toBe(true);
  });
});
