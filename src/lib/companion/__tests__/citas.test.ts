// Citas y enlaces del visor (design §10, CA-18). Comprueba el filtro contra pasajesEnviados, la línea de fuentes desde
// la tabla local, el enlazado de [Pn] y la validación del enlace al Atlas, con sus dos red-checks (la cita no enviada
// y el enlace fuera de palantir.com/docs).
import { describe, expect, it } from "vitest";
import type { PasajeEnviado } from "../tipos";
import { citasValidas, enlaceAtlas, enlazarCitas, idsEnviados, kAtlasValida, lineaFuentes } from "../citas";

const ENVIADOS: PasajeEnviado[] = [
  { id: "P1", clave: "forge-libros-p2#1", tipo: "libro", titulo: "Edits y concurrencia", seccion: "1 · Validez local", destino: "visor:P1", forge: true },
  { id: "P2", clave: "libros-itc#x", tipo: "libro", titulo: "Árboles balanceados", seccion: "Rotaciones", destino: "visor:P2", forge: false },
];

describe("filtro de citas (RF-R9, CA-18)", () => {
  it("deja sólo los ids que se mandaron, sin repetidos y con los datos locales", () => {
    const res = citasValidas(["P2", "P1", "P2", "P5", "basura"], ENVIADOS);
    expect(res.map((c) => c.id)).toEqual(["P2", "P1"]);
    expect(res[0]!.titulo).toBe("Árboles balanceados");
    expect(res[1]!.seccion).toBe("1 · Validez local");
  });

  it("sin citas válidas: «Sin cita de tus materiales»", () => {
    expect(lineaFuentes(citasValidas(["P7"], ENVIADOS))).toBe("Sin cita de tus materiales");
  });

  it("la línea de fuentes se arma con la tabla local, nunca con texto del modelo", () => {
    const linea = lineaFuentes(citasValidas(["P1"], ENVIADOS));
    expect(linea).toContain("[1] Edits y concurrencia · 1 · Validez local");
  });

  it("una cita que no se mandó no pasa el filtro (control del red-check CA-18)", () => {
    // Red-check CA-18 (demostrado aparte en redchecks.md): quitar el filtro deja pasar P5. Con el filtro real, no.
    expect(citasValidas(["P5"], ENVIADOS)).toEqual([]);
    expect(citasValidas(["P1", "P5"], ENVIADOS).map((c) => c.id)).toEqual(["P1"]);
  });
});

describe("enlazar [Pn] (§10)", () => {
  it("convierte [Pn] en #cita-Pn sólo para los ids enviados", () => {
    const md = enlazarCitas("ver [P1] y [P2] y [P5]", idsEnviados(ENVIADOS));
    expect(md).toContain("[P1](#cita-P1)");
    expect(md).toContain("[P2](#cita-P2)");
    expect(md).toContain("[P5]"); // no enviado: queda como texto
    expect(md).not.toContain("[P5](#cita-P5)");
  });
});

describe("enlaceAtlas (§10)", () => {
  it("arma el enlace sólo con una clave válida bajo /docs/", () => {
    expect(enlaceAtlas("foundry/actions")).toBe("https://www.palantir.com/docs/foundry/actions");
  });

  it("devuelve null para ../x, //evil.test, a/../../b, javascript:x y K mayúscula", () => {
    expect(kAtlasValida("../x")).toBe(false);
    for (const k of ["../x", "//evil.test", "a/../../b", "javascript:x", "Mayus"]) {
      expect(enlaceAtlas(k), `debería ser null: ${k}`).toBeNull();
    }
  });

  it("aun saltando la validación de clave, la barrera de URL atrapa ../x (control del red-check §10)", () => {
    // enlaceAtlas(k, () => true) salta la primera barrera; la segunda (new URL + host + /docs/) atrapa ../x porque el
    // navegador lo normaliza a /x fuera de /docs/. Red-check (demostrado aparte): sin esa segunda barrera, ../x escapa.
    expect(enlaceAtlas("../x", () => true)).toBeNull();
    expect(enlaceAtlas("a/../../b", () => true)).toBeNull();
  });
});
