// design poblar §5.3, §6.4 y §6.12 (Fase 0): el estado «en este dispositivo» de un libro de Forge en sus cinco casos,
// y el aviso de espacio que cuenta el relleno de cuota de las figuras.
import { describe, expect, it } from "vitest";
import { OPAQUE_PAD_BYTES, bookAvailability, estimateWarning, previstoBytes } from "./rules";

const current = { file: "p2-06.0123456789.md", sha10: "0123456789" };
const VIEJO = "9876543210";
const MB = 1024 * 1024;

describe("bookAvailability · estado de un libro de Forge en este dispositivo (§5.3)", () => {
  it("una importación del aprendiz está en el dispositivo, aunque su sha10 no sea el publicado", () => {
    expect(bookAvailability({ row: { source: "import", sha10: VIEJO }, current, cacheFiles: null })).toEqual({
      disponible: "si",
      detalle: "En este dispositivo · tu importación",
    });
  });

  it("una fila con el sha10 vigente está en el dispositivo", () => {
    expect(bookAvailability({ row: { source: "seed", sha10: current.sha10 }, current, cacheFiles: null })).toEqual({
      disponible: "si",
      detalle: "En este dispositivo",
    });
  });

  it("el archivo vigente en la caché basta, sin fila o con una fila vieja", () => {
    const cacheFiles = new Set([current.file]);
    const esperado = { disponible: "si", detalle: "En este dispositivo" };
    expect(bookAvailability({ row: null, current, cacheFiles })).toEqual(esperado);
    expect(bookAvailability({ row: { source: "seed", sha10: VIEJO }, current, cacheFiles })).toEqual(esperado);
  });

  it("una fila con otro sha10 y sin el archivo vigente es una versión anterior", () => {
    const r = bookAvailability({ row: { source: "seed", sha10: VIEJO }, current, cacheFiles: new Set([`p2-06.${VIEJO}.md`]) });
    expect(r.disponible, "una versión anterior salió En este dispositivo").toBe("anterior");
    expect(r.detalle).toBe("Versión anterior en este dispositivo · se actualiza con red");
  });

  it("sin fila ni archivo, con o sin Cache API, requiere conexión una vez", () => {
    const esperado = { disponible: "no", detalle: "Requiere conexión una vez" };
    expect(bookAvailability({ row: null, current, cacheFiles: new Set() })).toEqual(esperado);
    expect(bookAvailability({ row: null, current, cacheFiles: null })).toEqual(esperado);
  });
});

describe("aviso de espacio · previstoBytes y estimateWarning (§6.4 paso 4)", () => {
  it("cada figura opaca cuenta 7 MiB de relleno", () => {
    expect(OPAQUE_PAD_BYTES).toBe(7 * MB);
  });

  it("con 5 MB libres, 2 MB previstos y una figura avisa; la misma ruta sin figuras no", () => {
    const estado = { bytesPrevistos: 2 * MB, cuotaFiguras: 1 * OPAQUE_PAD_BYTES };
    expect(estimateWarning(5 * MB, previstoBytes(estado, true)), "una ruta con figuras empezó sin avisar el relleno de cuota").toBe(true);
    expect(estimateWarning(5 * MB, previstoBytes(estado, false)), "sin figuras, 5 MB libres alcanzan para 2 MB").toBe(false);
  });

  it("avisa por debajo de 1.2 veces lo previsto, no en el límite, y nunca sin estimate()", () => {
    expect(estimateWarning(119, 100)).toBe(true);
    expect(estimateWarning(120, 100)).toBe(false);
    expect(estimateWarning(null, 100)).toBe(false);
  });
});
