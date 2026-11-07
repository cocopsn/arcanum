// Tokenizador único del compañero (design §8.3): el mismo módulo arma el índice y la consulta.
import { describe, expect, it } from "vitest";
import { PALABRAS_VACIAS, limpiar, normalizar, raiz, tokenizar } from "@/lib/companion/tokenizar.mjs";

describe("tokenizar (§8.3)", () => {
  it("un singular y su plural regular dan la misma raíz", () => {
    expect(tokenizar("transacciones")).toEqual(["transaccion"]);
    expect(tokenizar("transacción")).toEqual(["transaccion"]);
    expect(tokenizar("tables table")).toEqual(["tabl", "tabl"]);
    expect(tokenizar("redes red")).toEqual(["red", "red"]);
  });
  it("la ñ queda como n y se quitan los acentos", () => {
    expect(normalizar("Año Pequeño Índice")).toBe("ano pequeno indice");
    expect(tokenizar("diseño")).toEqual(["diseno"]);
  });
  it("quita palabras vacías de español e inglés, tokens cortos o largos y números de 5 cifras o más", () => {
    expect(tokenizar("el índice de la base y the index of a table")).toEqual(["indic", "bas", "index", "tabl"]);
    expect(tokenizar("x 12345 1234 " + "a".repeat(31))).toEqual(["1234"]);
    for (const w of ["was", "were", "has", "have", "had", "will", "would", "should", "could", "its", "their", "there", "these", "those", "then", "than", "into", "also"]) {
      expect(PALABRAS_VACIAS.has(w), w).toBe(true);
    }
  });
  it("limpia markdown: enlaces e imágenes con su texto, sin URL ni etiquetas", () => {
    expect(limpiar("![grafo](a.png) [Dijkstra](https://x.test/y) ver https://z.test/w <b>negro</b>").replace(/\s+/g, " ").trim()).toBe("grafo Dijkstra ver negro");
    expect(tokenizar("[Dijkstra](https://example.test/camino)")).toEqual(["dijkstra"]);
  });
  it("raíz ligera: sólo con 4 caracteres o más", () => {
    expect(raiz("gas")).toBe("gas");
    expect(raiz("base")).toBe("bas");
    expect(raiz("bases")).toBe("bas");
    expect(raiz("ese")).toBe("ese");
  });
});
