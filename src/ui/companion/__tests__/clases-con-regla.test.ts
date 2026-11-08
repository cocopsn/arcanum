import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { ESTILOS } from "../estilos";

// Cada clase cmp-* que un componente del compañero pone en un className tiene su regla en ESTILOS. Las guardas de
// colores (colores.test.ts) prueban que nada pinte color en Forge, pero un componente SIN estilos también las pasa: el
// compositor salió así a producción (chips pegados en «explicarpistadiagrama…», textarea y select con el gris del
// navegador). Esta prueba es la que faltaba.
const DIR = path.resolve(__dirname, "..");

function tsxDelCompanero(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return d.name === "__tests__" ? [] : tsxDelCompanero(p);
    return d.name.endsWith(".tsx") ? [p] : [];
  });
}

/** Las clases cmp-* que aparecen dentro de un atributo className (literal o expresión con literales). */
function clasesEnClassName(fuente: string): string[] {
  const out: string[] = [];
  for (const m of fuente.matchAll(/className=(\{[^}]*\}|"[^"]*")/g)) {
    for (const c of m[1]!.matchAll(/cmp-[a-z0-9-]+/g)) out.push(c[0]);
  }
  return out;
}

// Una regla propia: la clase cierra el selector (sigue «{») o un miembro de una lista de selectores (sigue «,»). Que sólo
// aparezca con un estado (.cmp-chip:focus-visible) o un atributo no cuenta: ese estilo no pinta el elemento en reposo.
const conRegla = (clase: string) => new RegExp(`\\.${clase}\\s*[,{]`).test(ESTILOS);

describe("estilos del compañero: cada clase usada tiene su regla", () => {
  const archivos = tsxDelCompanero(DIR);

  it("encuentra los componentes (la prueba mide algo)", () => {
    expect(archivos.length, "no se encontraron .tsx bajo src/ui/companion").toBeGreaterThan(10);
    const todas = archivos.flatMap((f) => clasesEnClassName(readFileSync(f, "utf8")));
    expect(todas.length, "no se leyó ninguna clase cmp-* en un className").toBeGreaterThan(50);
  });

  it("ninguna clase cmp-* de un className queda sin regla en estilos.ts", () => {
    const faltan = new Set<string>();
    for (const f of archivos) {
      for (const c of clasesEnClassName(readFileSync(f, "utf8"))) {
        if (!conRegla(c)) faltan.add(`${c} (${path.basename(f)})`);
      }
    }
    expect([...faltan].sort(), "clase del compañero sin regla en estilos.ts: se pintaría con los estilos del navegador").toEqual([]);
  });
});
