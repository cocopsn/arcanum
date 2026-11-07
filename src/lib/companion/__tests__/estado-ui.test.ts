import { describe, it, expect, beforeEach, vi } from "vitest";
import { INICIAL, LLAVE_UI, cargarUi, guardarUi, transicion, type EstadoUi, type EventoUi, type Vista } from "@/lib/companion/estado-ui";

const en = (vista: Vista): EstadoUi => ({ ...INICIAL, vista });
const NUEVA = "sup-izq" as const;

// design §4: fila = vista de partida; columna = evento; celda = vista de llegada (la esquina se mira aparte)
const TABLA: [Vista, EventoUi, Vista][] = [
  ["orbe", { t: "tocarOrbe" }, "panel"],
  ["orbe", { t: "atajo" }, "panel"],
  ["orbe", { t: "minimizar" }, "orbe"],
  ["orbe", { t: "escape" }, "orbe"],
  ["orbe", { t: "tocarFuera" }, "orbe"],
  ["orbe", { t: "ocultar" }, "oculto"],
  ["orbe", { t: "tocarPestillo" }, "orbe"],
  ["orbe", { t: "soltar", esquina: NUEVA }, "orbe"],
  ["orbe", { t: "moverA", esquina: NUEVA }, "orbe"],
  ["panel", { t: "tocarOrbe" }, "panel"],
  ["panel", { t: "atajo" }, "orbe"],
  ["panel", { t: "minimizar" }, "orbe"],
  ["panel", { t: "escape" }, "orbe"],
  ["panel", { t: "tocarFuera" }, "orbe"],
  ["panel", { t: "ocultar" }, "oculto"],
  ["panel", { t: "tocarPestillo" }, "panel"],
  ["panel", { t: "soltar", esquina: NUEVA }, "panel"],
  ["panel", { t: "moverA", esquina: NUEVA }, "panel"],
  ["oculto", { t: "tocarOrbe" }, "oculto"],
  ["oculto", { t: "atajo" }, "panel"],
  ["oculto", { t: "minimizar" }, "oculto"],
  ["oculto", { t: "escape" }, "oculto"],
  ["oculto", { t: "tocarFuera" }, "oculto"],
  ["oculto", { t: "ocultar" }, "oculto"],
  ["oculto", { t: "tocarPestillo" }, "orbe"],
  ["oculto", { t: "soltar", esquina: NUEVA }, "oculto"],
  ["oculto", { t: "moverA", esquina: NUEVA }, "oculto"],
];

describe("estado-ui (design §4)", () => {
  beforeEach(() => localStorage.clear());

  it.each(TABLA)("%s + %j → %s", (desde, e, hasta) => {
    const r = transicion(en(desde), e);
    expect(r.vista, `${desde} + ${e.t} no llegó a ${hasta}`).toBe(hasta);
    const cambiaEsquina = e.t === "soltar" || e.t === "moverA";
    expect(r.esquina, `${desde} + ${e.t} movió mal la esquina`).toBe(cambiaEsquina ? NUEVA : INICIAL.esquina);
    expect(r.globoVisto).toBe(false);
  });

  it("globoVisto se marca una vez y no cambia la vista", () => {
    for (const v of ["oculto", "orbe", "panel"] as const) {
      const r = transicion(en(v), { t: "globoVisto" });
      expect(r).toEqual({ ...en(v), globoVisto: true });
      expect(transicion(r, { t: "globoVisto" })).toBe(r);
    }
  });

  it("un evento sin efecto devuelve el mismo objeto", () => {
    const s = en("oculto");
    expect(transicion(s, { t: "escape" })).toBe(s);
    expect(transicion(s, { t: "moverA", esquina: s.esquina })).toBe(s);
  });

  it("ida y vuelta por localStorage; el panel se guarda como orbe", () => {
    const s: EstadoUi = { v: 1, vista: "oculto", esquina: "sup-der", globoVisto: true };
    guardarUi(s);
    expect(JSON.parse(localStorage.getItem(LLAVE_UI)!)).toEqual(s);
    expect(cargarUi()).toEqual(s);
    guardarUi({ ...s, vista: "panel" });
    expect(JSON.parse(localStorage.getItem(LLAVE_UI)!).vista, "el panel se guardó abierto").toBe("orbe");
    expect(cargarUi().vista).toBe("orbe");
  });

  it.each([
    ["ausente", null],
    ["vacío", ""],
    ["no JSON", "{"],
    ["null", "null"],
    ["número", "7"],
    ["otra versión", JSON.stringify({ v: 2, vista: "orbe", esquina: "inf-der", globoVisto: true })],
    ["vista fuera de enumeración", JSON.stringify({ v: 1, vista: "abierto", esquina: "inf-der", globoVisto: true })],
    ["esquina fuera de enumeración", JSON.stringify({ v: 1, vista: "orbe", esquina: "centro", globoVisto: true })],
    ["globoVisto no booleano", JSON.stringify({ v: 1, vista: "orbe", esquina: "inf-der", globoVisto: "sí" })],
    ["arreglo", "[1,2]"],
  ])("valor basura (%s) → INICIAL", (_n, raw) => {
    if (raw !== null) localStorage.setItem(LLAVE_UI, raw);
    expect(cargarUi()).toEqual(INICIAL);
  });

  it("un panel guardado por otra versión del código se carga como orbe", () => {
    localStorage.setItem(LLAVE_UI, JSON.stringify({ v: 1, vista: "panel", esquina: "inf-izq", globoVisto: false }));
    expect(cargarUi()).toEqual({ v: 1, vista: "orbe", esquina: "inf-izq", globoVisto: false });
  });

  it("localStorage que lanza no rompe: carga INICIAL y guardar no lanza", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    try {
      expect(cargarUi()).toEqual(INICIAL);
      expect(() => guardarUi(INICIAL)).not.toThrow();
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });
});
