// Atlas del compañero (design §9.3, §10, P1). cargarIndiceAtlas recorre indices[lang="en"] del manifiesto, lee con un
// `leer` inyectado (caches.match y si no fetch en producción), valida cada fila AtlasIndexRow y su `k`, salta las
// inválidas y entrega las válidas en tandas de 500. Una fila con `k` que trae `..` no entra, así el visor nunca arma un
// enlace fuera de palantir.com/docs. filaAtlasValida es la guarda pura.
import { describe, it, expect } from "vitest";
import { cargarIndiceAtlas, filaAtlasValida, TANDA_ATLAS } from "@/lib/companion/forge";
import type { AtlasIndexRow, AtlasManifest } from "@/forge/atlas/types";

// Una fila válida de ejemplo: [k, archivo, titulo, migas, tokens, encabezados, p, c, s, codigos].
const filaOk: AtlasIndexRow = ["foundry/ontology/overview", "en/foundry/ontology.0.abc.json", "Ontology overview", ["Foundry", "Ontology"], "ontology object type", [["intro", "Introduction"]], "foundry", "ontology", "overview", ["P2-06"]];
// Una fila con `k` que escala directorios: debe saltarse (nunca da enlace).
const filaMala: AtlasIndexRow = ["../../etc/passwd", "x.json", "Malo", [], "token", [], "p", "c", "s", []];
// Una fila con forma incorrecta (no es tupla de 10).
const filaCorta = ["solo", "dos"] as unknown as AtlasIndexRow;

function manifiesto(files: string[]): AtlasManifest {
  return { indices: [{ lang: "en", files, bytes: 1, rows: 3 }] } as unknown as AtlasManifest;
}

/** Un `leer` falso que devuelve un Response con las filas dadas por archivo. */
function leerDe(porArchivo: Record<string, unknown[]>): (url: string) => Promise<Response | null> {
  return async (url: string) => {
    const archivo = Object.keys(porArchivo).find((a) => url.endsWith(a));
    if (!archivo) return null;
    return new Response(JSON.stringify({ v: 1, lang: "en", n: 0, rows: porArchivo[archivo] }), { status: 200 });
  };
}

describe("filaAtlasValida (§9.3)", () => {
  it("acepta la tupla de 10 campos con un `k` seguro", () => {
    expect(filaAtlasValida(filaOk)).toBe(true);
  });
  it("rechaza una fila con `k` que trae `..`", () => {
    expect(filaAtlasValida(filaMala)).toBe(false);
  });
  it("rechaza una tupla de forma incorrecta", () => {
    expect(filaAtlasValida(filaCorta)).toBe(false);
    expect(filaAtlasValida(null)).toBe(false);
    expect(filaAtlasValida({})).toBe(false);
  });
});

describe("cargarIndiceAtlas (§9.3)", () => {
  it("salta la fila inválida y conserva la válida; `k` con `..` no entra", async () => {
    const leer = leerDe({ "en.0.json": [filaOk, filaMala, filaCorta] });
    const r = await cargarIndiceAtlas({ base: "/atlas/v1", leer, manifiesto: manifiesto(["en.0.json"]) });
    expect(r.filas.length).toBe(1);
    expect(r.saltadas).toBe(2);
    expect(r.filas[0]![0]).toBe("foundry/ontology/overview");
    // ninguna fila devuelta tiene un `k` con `..`
    expect(r.filas.some((f) => f[0].includes(".."))).toBe(false);
  });

  it("recorre los tres archivos del manifiesto y los concatena", async () => {
    const leer = leerDe({ "en.0.json": [filaOk], "en.1.json": [filaOk], "en.2.json": [filaOk] });
    const r = await cargarIndiceAtlas({ base: "/atlas/v1", leer, manifiesto: manifiesto(["en.0.json", "en.1.json", "en.2.json"]) });
    expect(r.filas.length).toBe(3);
  });

  it("entrega en tandas de 500 llamando a alAvanzar", async () => {
    const muchas = Array.from({ length: TANDA_ATLAS + 3 }, () => filaOk);
    const avances: number[] = [];
    const leer = leerDe({ "en.0.json": muchas });
    const r = await cargarIndiceAtlas({ base: "/atlas/v1", leer, manifiesto: manifiesto(["en.0.json"]), alAvanzar: (n) => avances.push(n) });
    expect(r.filas.length).toBe(TANDA_ATLAS + 3);
    expect(avances.length).toBeGreaterThanOrEqual(2); // al menos dos tandas
  });

  it("sin manifiesto o sin índice en inglés devuelve vacío", async () => {
    const leer = leerDe({});
    const vacio = await cargarIndiceAtlas({ base: "/atlas/v1", leer, manifiesto: { indices: [] } as unknown as AtlasManifest });
    expect(vacio.filas).toEqual([]);
  });
});
