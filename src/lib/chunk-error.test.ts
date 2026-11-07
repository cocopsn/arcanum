// design poblar §5.7 y §6.12 (Fase 0): el texto de un chunk que no carga depende del controlador y de la red, y
// isChunkError reconoce el error de webpack y los mensajes de Chrome y Safari.
import { describe, expect, it } from "vitest";
import { chunkErrorText, isChunkError } from "./chunk-error";

const STALE = "Hay una versión nueva de Arcanum. Recarga para continuar.";
const NO_DESCARGADO = "Esta parte de Arcanum no está descargada en este dispositivo: ábrela una vez con conexión.";

describe("chunkErrorText · las tres filas de §5.7", () => {
  it("con controlador y sin red es un desfase: recargar lo arregla", () => {
    expect(chunkErrorText({ controlled: true, online: false }), "sin red y con controlador se dijo que la parte no estaba descargada").toEqual({
      tipo: "stale",
      texto: STALE,
    });
  });

  it("con controlador y con red, también", () => {
    expect(chunkErrorText({ controlled: true, online: true })).toEqual({ tipo: "stale", texto: STALE });
  });

  it("sin controlador y sin red, la parte no está descargada", () => {
    expect(chunkErrorText({ controlled: false, online: false })).toEqual({ tipo: "no-descargado", texto: NO_DESCARGADO });
  });

  it("sin controlador y con red, es un desfase de despliegue", () => {
    expect(chunkErrorText({ controlled: false, online: true })).toEqual({ tipo: "stale", texto: STALE });
  });
});

describe("isChunkError", () => {
  it("reconoce ChunkLoadError por su nombre", () => {
    expect(isChunkError(Object.assign(new Error("x"), { name: "ChunkLoadError" }))).toBe(true);
  });

  it("reconoce los tres mensajes: webpack (JS y CSS), Chrome y Safari", () => {
    expect(isChunkError(new Error("Loading chunk 8462 failed.\n(error: https://arcanum-brown.vercel.app/_next/static/chunks/8462.js)"))).toBe(true);
    expect(isChunkError(new Error("Loading CSS chunk app-page failed.\n(/_next/static/css/a.css)"))).toBe(true);
    expect(isChunkError(new TypeError("Failed to fetch dynamically imported module: https://arcanum-brown.vercel.app/_next/static/chunks/x.js"))).toBe(true);
    expect(isChunkError(new TypeError("Importing a module script failed."))).toBe(true);
  });

  it("no confunde otros errores ni valores que no son errores", () => {
    expect(isChunkError(new TypeError("Cannot read properties of undefined (reading 'goals')"))).toBe(false);
    expect(isChunkError(new Error("Failed to fetch"))).toBe(false);
    expect(isChunkError(null)).toBe(false);
  });
});
