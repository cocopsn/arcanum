// Fase inferida (design §12.3, CA-20): una prueba por fila de la tabla, la primera que aplica gana. La fila 4 incluye
// el flujo de ontología (superficie mision → transferir); su red-check de sensor vive en sensor.test.ts.
import { describe, expect, it } from "vitest";
import { inferirFase, type SenalesFase } from "../fase";

const base: SenalesFase = {
  superficie: "celda",
  diagnosticoSinEvidencia: false,
  enRepaso: false,
  itemRetencionAbierto: false,
  dominada: false,
  tipoItem: null,
  disponibleSinIntentos: false,
  hayCelda: true,
};
const s = (over: Partial<SenalesFase>): SenalesFase => ({ ...base, ...over });

describe("inferirFase (§12.3, una por fila, CA-20)", () => {
  it("1: celda D1-D8 sin evidencia → null (guarda de diagnóstico)", () => {
    expect(inferirFase(s({ diagnosticoSinEvidencia: true }))).toBeNull();
  });
  it("2: en repaso o ítem de retención abierto → retener", () => {
    expect(inferirFase(s({ enRepaso: true }))).toBe("retener");
    expect(inferirFase(s({ itemRetencionAbierto: true }))).toBe("retener");
  });
  it("3: celda dominada → transferir", () => {
    expect(inferirFase(s({ dominada: true }))).toBe("transferir");
  });
  it("4: compuerta o misión (incluye ontología) → transferir", () => {
    expect(inferirFase(s({ superficie: "compuerta" }))).toBe("transferir");
    expect(inferirFase(s({ superficie: "mision" }))).toBe("transferir");
  });
  it("5: historial/mutantes/contraejemplo/senal → contrastar", () => {
    for (const t of ["historial", "mutantes", "contraejemplo", "senal"] as const) expect(inferirFase(s({ tipoItem: t }))).toBe("contrastar");
  });
  it("6: desvanecido → completar", () => {
    expect(inferirFase(s({ tipoItem: "desvanecido" }))).toBe("completar");
  });
  it("7: prediccion → predecir", () => {
    expect(inferirFase(s({ tipoItem: "prediccion" }))).toBe("predecir");
  });
  it("8: code/sql/ontologia/permisos/recuperacion/forense/gameday/expediente/practica → construir", () => {
    for (const t of ["code", "sql", "ontologia", "permisos", "recuperacion", "forense", "gameday", "expediente", "practica"] as const)
      expect(inferirFase(s({ tipoItem: t }))).toBe("construir");
  });
  it("9: libro o lección → comprender", () => {
    expect(inferirFase(s({ superficie: "libro" }))).toBe("comprender");
    expect(inferirFase(s({ superficie: "leccion" }))).toBe("comprender");
  });
  it("10: celda disponible sin intentos → predecir", () => {
    expect(inferirFase(s({ disponibleSinIntentos: true }))).toBe("predecir");
  });
  it("11: otra celda abierta → comprender", () => {
    expect(inferirFase(s({ superficie: "celda" }))).toBe("comprender");
  });
  it("12: sin celda → general", () => {
    expect(inferirFase(s({ hayCelda: false, superficie: "inicio" }))).toBe("general");
  });

  it("orden: la fila 2 (retener) gana a la 3 (dominada) y a la 4 (compuerta)", () => {
    expect(inferirFase(s({ enRepaso: true, dominada: true, superficie: "compuerta" }))).toBe("retener");
  });

  it("control del red-check de ontología (§12.3 fila 4): un flujo de ontología llega como superficie mision → transferir", () => {
    // El sensor mapea data-forge-flow="ontologia" a superficie "mision" (sensor.test.ts prueba esa parte sobre el DOM).
    // Aquí: dado superficie mision, la fase es transferir. Red-check (sensor): si el selector vuelve a
    // [data-forge-flow="mision"], ontología no se detecta y la superficie no es mision → la fase no es transferir.
    expect(inferirFase(s({ superficie: "mision", tipoItem: "ontologia" }))).toBe("transferir");
    // si ontología cayera como practica_forge (sin detectar el flujo), la fila 8 daría construir, no transferir
    expect(inferirFase(s({ superficie: "practica_forge", tipoItem: "ontologia" }))).not.toBe("transferir");
  });
});
