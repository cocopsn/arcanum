// Contratos compartidos del compañero (design §12.5, §13.2): la regla única de recorte y los números de LIMITES.
import { describe, expect, it } from "vitest";
import { FASES, LIMITES, PEDIDOS, SUPERFICIES, recortar } from "../tipos";

describe("recortar (§12.5, r3b #10)", () => {
  it("deja el resultado en max con la elipsis incluida", () => {
    const r = recortar("a".repeat(500), 200);
    expect(r.length, "el recorte pasó del techo").toBe(200);
    expect(r.endsWith("…")).toBe(true);
    expect(r.slice(0, 199)).toBe("a".repeat(199));
  });
  it("no toca una cadena de max o menos", () => {
    expect(recortar("hola", 4)).toBe("hola");
    expect(recortar("", 10)).toBe("");
    expect(recortar("x".repeat(80), 80)).toBe("x".repeat(80));
  });
  it("max + 1 pierde un carácter y gana la elipsis", () => {
    expect(recortar("abcdef", 5)).toBe("abcd…");
  });
});

describe("LIMITES (§12.5 = COMP_LIMITES de §13.2)", () => {
  it("lleva los números del diseño", () => {
    expect(LIMITES).toEqual({
      contexto: 60_000,
      pregunta: 2_000,
      historial: { max: 6, texto: 1_500 },
      pasajes: { max: 8, titulo: 200, seccion: 200, texto: 1_500 },
      notas: { max: 3, titulo: 120, texto: 600 },
      ubicacion: {
        mundo: 80,
        celdaTitulo: 200,
        libroTitulo: 200,
        libroSeccion: 200,
        ejercicioTitulo: 200,
        diagnostico: 300,
        intervencion: 300,
        resumen: 300,
        brechas: { max: 3, texto: 200 },
        repasos: { max: 3, texto: 200 },
        modosFalla: 2,
        tiposSugeridos: 3,
        porcentaje: 100,
        entero: 999,
      },
    });
  });
  it("las enumeraciones son las de la Edge", () => {
    expect(FASES).toEqual(["predecir", "comprender", "completar", "construir", "contrastar", "transferir", "retener", "general"]);
    expect(PEDIDOS).toEqual(["explicar", "pista", "diagrama", "ejercicios", "plan", "libre"]);
    expect(SUPERFICIES).toHaveLength(13);
    expect(SUPERFICIES).toContain("desconocido");
  });
});
