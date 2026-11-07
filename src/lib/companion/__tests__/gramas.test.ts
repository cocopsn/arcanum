// 5-gramas y hash de 48 bits del filtro reservado (design §8.5, §12.7): el generador y el cliente cuentan igual.
import { describe, expect, it } from "vitest";
import {
  aBase64,
  codificarHashes,
  conContenido,
  contiene,
  cyrb53,
  deBase64,
  decodificarHashes,
  gramas5,
  hash48,
  palabras,
} from "@/lib/companion/gramas.mjs";

describe("palabras y 5-gramas (§12.7)", () => {
  it("palabras = [\\p{L}\\p{N}]+ normalizadas, sin raíz", () => {
    expect(palabras("¡Las Transacciones, en 2 pasos!")).toEqual(["las", "transacciones", "en", "2", "pasos"]);
    expect(palabras("año—diseño")).toEqual(["ano", "diseno"]);
  });
  it("un 5-grama cuenta sólo con 2 o más palabras no vacías", () => {
    expect(conContenido(["de", "la", "el", "en", "y"])).toBe(false);
    expect(conContenido(["de", "la", "base", "en", "y"])).toBe(false);
    expect(conContenido(["de", "la", "base", "en", "datos"])).toBe(true);
  });
  it("gramas5 da cada ventana de 5 con contenido y su posición", () => {
    const g = gramas5(palabras("el cupo semanal de la sala cambia mañana"));
    expect(g[0]).toEqual({ i: 0, g: "el cupo semanal de la" });
    expect(g.map((x) => x.i)).toEqual([0, 1, 2, 3]);
    expect(gramas5(["a", "b", "c", "d"])).toEqual([]);
  });
});

describe("hash de 48 bits y codificación (§8.5)", () => {
  it("cyrb53 es estable y hash48 son sus 48 bits bajos", () => {
    const g = "el cupo semanal de la";
    expect(cyrb53(g)).toBe(cyrb53(g));
    expect(cyrb53("a")).not.toBe(cyrb53("b"));
    expect(hash48(g)).toBe(cyrb53(g) % 2 ** 48);
    expect(hash48(g)).toBeLessThan(2 ** 48);
    expect(Number.isInteger(hash48(g))).toBe(true);
  });
  it("codifica ordenado, sin repetidos, 6 bytes big-endian, y vuelve igual", () => {
    const hs = ["uno dos tres cuatro cinco", "seis siete ocho nueve diez", "uno dos tres cuatro cinco", "x y z w v"].map(hash48);
    const bytes = codificarHashes(hs);
    expect(bytes.length).toBe(3 * 6);
    const tabla = decodificarHashes(bytes);
    expect(tabla).not.toBeNull();
    const arr = [...(tabla ?? [])];
    expect(arr).toEqual([...new Set(hs)].sort((a, b) => a - b));
    expect(codificarHashes([0x010203040506])).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
  });
  it("base64 de ida y vuelta, y rechaza basura", () => {
    for (const n of [0, 1, 2, 3, 6, 7, 18]) {
      const b = new Uint8Array(n).map((_, i) => (i * 37 + 11) & 0xff);
      expect(deBase64(aBase64(b))).toEqual(b);
      expect(aBase64(b)).toBe(Buffer.from(b).toString("base64"));
    }
    expect(deBase64("abc")).toBeNull();
    expect(deBase64("ab$=")).toBeNull();
    expect(decodificarHashes(new Uint8Array(7))).toBeNull();
  });
  it("la búsqueda binaria encuentra los presentes y no los ausentes", () => {
    const hs = Array.from({ length: 200 }, (_, i) => hash48(`grama ${i} uno dos tres`));
    const tabla = decodificarHashes(codificarHashes(hs));
    expect(tabla).not.toBeNull();
    for (const h of hs) expect(contiene(tabla ?? [], h)).toBe(true);
    expect(contiene(tabla ?? [], hash48("no esta en la tabla"))).toBe(false);
    expect(contiene([], 5)).toBe(false);
  });
});
