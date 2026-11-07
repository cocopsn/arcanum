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
    expect(chunkErrorText({ controlled: false, online: false }), "sin controlador y sin red no se dijo que la parte no estaba descargada").toEqual({
      tipo: "no-descargado",
      texto: NO_DESCARGADO,
    });
  });

  it("sin controlador y con red, es un desfase de despliegue", () => {
    expect(chunkErrorText({ controlled: false, online: true }), "sin controlador y con red no se dijo que recargar lo arregla").toEqual({
      tipo: "stale",
      texto: STALE,
    });
  });
});

describe("isChunkError", () => {
  it("reconoce ChunkLoadError por su nombre", () => {
    expect(isChunkError(Object.assign(new Error("x"), { name: "ChunkLoadError" })), "un ChunkLoadError no se reconoció como error de chunk").toBe(true);
  });

  it("reconoce los tres mensajes: webpack (JS y CSS), Chrome y Safari", () => {
    const no = (fuente: string) => `el mensaje de ${fuente} no se reconoció como error de chunk`;
    expect(isChunkError(new Error("Loading chunk 8462 failed.\n(error: https://arcanum-brown.vercel.app/_next/static/chunks/8462.js)")), no("webpack")).toBe(true);
    expect(isChunkError(new Error("Loading CSS chunk app-page failed.\n(/_next/static/css/a.css)")), no("webpack (CSS)")).toBe(true);
    expect(isChunkError(new TypeError("Failed to fetch dynamically imported module: https://arcanum-brown.vercel.app/_next/static/chunks/x.js")), no("Chrome")).toBe(true);
    expect(isChunkError(new TypeError("Importing a module script failed.")), no("Safari")).toBe(true);
  });

  it("no confunde otros errores ni valores que no son errores", () => {
    const msg = "un error que no es de chunk se tomó por uno de chunk";
    expect(isChunkError(new TypeError("Cannot read properties of undefined (reading 'goals')")), msg).toBe(false);
    expect(isChunkError(new Error("Failed to fetch")), msg).toBe(false);
    expect(isChunkError(null), msg).toBe(false);
  });
});
