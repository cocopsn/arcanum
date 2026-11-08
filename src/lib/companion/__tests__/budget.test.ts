// Puerta de presupuesto del compañero (design §8.6, CA-16, DP-3) sobre un árbol .next sintético: la función de
// evaluación es la misma que corre el CLI después de `pnpm build`.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FAMILIAS, evaluar, leerManifiesto } from "../../../../scripts/companion/budget.mjs";
import { particionesTs } from "../../../../scripts/companion/build-index.mjs";

const MANI = [{ nombre: "libros-itc" }, { nombre: "forge-fichas" }];
const raices: string[] = [];
afterEach(() => {
  for (const r of raices.splice(0)) rmSync(r, { recursive: true, force: true });
});

type Arbol = { pagina?: string; chunks?: Record<string, string>; fuera?: string[]; forge?: Record<string, string[]> };
/** Un repo con .next y public/sw.js mínimos. Por omisión, todo en regla con las siete familias. */
function arbol({ pagina = 'document.getElementById("arcanum-companion")', chunks, fuera = [], forge = {} }: Arbol = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "companion-budget-"));
  raices.push(root);
  const next = path.join(root, ".next");
  mkdirSync(path.join(next, "static/chunks/app"), { recursive: true });
  mkdirSync(path.join(root, "public"), { recursive: true });
  const todos: Record<string, string> = chunks ?? {
    "companion-ui": 'x.dataset.companionChunk="cmp-ui-v1"',
    "companion-forge": "forge()",
    "companion-diagrama": '"cmp-diagrama-v1"',
    "companion-pdf": '"/Producer (Arcanum companero cmp-pdf-v1)"',
    "companion-practica": '"cmp-practica-v1"',
    "companion-reservado": '{"f":"arcanum-companion-reservado/1"}',
    "companion-idx-libros-itc": '{"f":"arcanum-companion-index/1","p":"libros-itc"}',
    "companion-idx-forge-fichas": '{"f":"arcanum-companion-index/1","p":"forge-fichas"}',
  };
  const urls: string[] = [];
  const mapa: Record<string, { pagina: boolean; forge: string[] }> = {};
  writeFileSync(path.join(next, "static/chunks/app/page-0a1b.js"), pagina);
  writeFileSync(path.join(next, "static/chunks/main-0c2d.js"), "main()");
  for (const [n, txt] of Object.entries(todos)) {
    const f = `static/chunks/${n}.0123abcd.js`;
    writeFileSync(path.join(next, f), txt);
    if (!fuera.includes(n)) urls.push(`/_next/${f}`);
    mapa[f] = { pagina: false, forge: forge[n] ?? [] };
  }
  writeFileSync(path.join(next, "app-build-manifest.json"), JSON.stringify({ pages: { "/page": ["static/chunks/main-0c2d.js", "static/chunks/app/page-0a1b.js"] } }));
  writeFileSync(path.join(next, "forge-chunks.json"), JSON.stringify({ v: 1, chunks: mapa, medios: {} }));
  writeFileSync(path.join(root, "public/sw.js"), `self.__SW_MANIFEST=[${urls.map((u) => `{url:"${u}",revision:null}`).join(",")}]`);
  return { root, nextDir: next };
}

describe("budget.mjs (§8.6)", () => {
  it("un árbol en regla pasa con las siete familias y una base", () => {
    const t = arbol();
    const r = evaluar({ ...t, base: 50, manifiesto: MANI });
    expect(r.fallas).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.indice.particiones).toBe(2);
    expect(r.precache?.companero).toBe(8);
  });

  it("una centinela en el JS inicial de /page falla y nombra la centinela (CA-16)", () => {
    for (const c of ["cmp-ui-v1", "arcanum-companion-index/1"]) {
      const t = arbol({ pagina: `document.getElementById("arcanum-companion");"${c}"` });
      const r = evaluar({ ...t, manifiesto: MANI });
      expect(r.fallas, `un módulo del compañero entró al chunk de página: ${c} (la puerta no lo vio)`).toContain(`un módulo del compañero entró al chunk de página: ${c}`);
      expect(r.ok).toBe(false);
    }
  });

  it("una partición más grande que su techo falla y la lista la nombra (CA-16)", () => {
    const t = arbol();
    const r = evaluar({ ...t, manifiesto: MANI, techos: { particion: 40 } });
    const nombradas = r.fallas.filter((f: string) => f.startsWith("partición "));
    expect(nombradas.join("\n"), "la partición companion-idx-libros-itc pasa su techo y la lista de excesos no la nombra").toContain("partición companion-idx-libros-itc ");
    expect(nombradas.join("\n")).toContain("partición companion-idx-forge-fichas ");
    expect(r.ok).toBe(false);
  });

  it("el crecimiento de la página se mide contra la base (≤ 8 KiB) y sin base sólo avisa", () => {
    const t = arbol({ pagina: 'document.getElementById("arcanum-companion");' + "x".repeat(9000) });
    expect(evaluar({ ...t, base: 10, manifiesto: MANI }).fallas.some((f: string) => f.startsWith("el compañero agrega "))).toBe(true);
    const sin = evaluar({ ...t, manifiesto: MANI });
    expect(sin.ok).toBe(true);
    expect(sin.avisos.join(" ")).toContain("sin base");
  });

  it("--esperar decide qué chunks deben existir (DP-3)", () => {
    const t = arbol({ pagina: "nada", chunks: {} });
    const todas = evaluar({ ...t, manifiesto: MANI });
    expect(todas.fallas).toContain("falta el chunk companion-ui");
    expect(todas.fallas).toContain("falta el chunk companion-idx-forge-fichas");
    expect(todas.fallas).toContain("el JS inicial de /page no monta el compañero: falta arcanum-companion");
    const ninguna = evaluar({ ...t, manifiesto: MANI, esperar: [] });
    expect(ninguna.fallas).toEqual([]);
    expect(evaluar({ ...t, manifiesto: MANI, esperar: ["idx"] }).fallas).toEqual(["falta el chunk companion-idx-libros-itc", "falta el chunk companion-idx-forge-fichas"]);
    expect(FAMILIAS).toEqual(["ui", "idx", "reservado", "forge", "diagrama", "pdf", "practica"]);
  });

  it("un chunk del compañero fuera del precache falla", () => {
    const t = arbol({ fuera: ["companion-pdf"] });
    expect(evaluar({ ...t, manifiesto: MANI }).fallas).toContain("un chunk del compañero quedó fuera del precache: companion-pdf (static/chunks/companion-pdf.0123abcd.js)");
  });

  it("sólo companion-forge puede arrastrar módulos de src/forge/**", () => {
    const t = arbol({ forge: { "companion-ui": ["src/forge/loaders.ts"], "companion-forge": ["src/forge/loaders.ts"] } });
    const r = evaluar({ ...t, manifiesto: MANI });
    expect(r.fallas).toEqual(["un chunk del compañero arrastra módulos de Forge: companion-ui: src/forge/loaders.ts"]);
    expect(r.ui_forge).toBeGreaterThan(0);
  });

  it("lee el MANIFIESTO que escribe el generador", () => {
    const ts = particionesTs([
      { nombre: "libros-itc", tipo: "libros", spine: "ITC", ruta: null, docs: 107, bytes: 84616, sha10: "0123456789" },
      { nombre: "forge-bancos-p2", tipo: "bancos", spine: "Engineering Forge", ruta: "p2", docs: 54, bytes: 15192, sha10: "abcdefabcd" },
    ]);
    expect(leerManifiesto(ts).map((p) => p.nombre)).toEqual(["libros-itc", "forge-bancos-p2"]);
    expect(ts).toContain('import(/* webpackChunkName: "companion-idx-forge-bancos-p2" */ "./idx-forge-bancos-p2.json")');
    expect(ts).toContain('import(/* webpackChunkName: "companion-reservado" */ "./reservado.json")');
  });
});
