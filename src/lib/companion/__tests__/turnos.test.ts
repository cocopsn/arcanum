// Aplicación de un resultado por reqId (design §14.4, CA-39). El red-check de UI vive en cancelar.test.tsx; aquí la
// unidad pura: un resultado con reqId distinto del vigente no se aplica.
import { describe, expect, it } from "vitest";
import { aplicarResultado } from "../turnos";

describe("aplicarResultado (§14.4)", () => {
  it("aplica sólo el resultado cuyo reqId es el vigente", () => {
    expect(aplicarResultado({ reqIdVigente: "r2" }, { reqId: "r2", valor: 1 })).toEqual({ aplicar: true, valor: 1 });
  });
  it("descarta un resultado de una consulta reemplazada", () => {
    expect(aplicarResultado({ reqIdVigente: "r2" }, { reqId: "r1", valor: 1 })).toEqual({ aplicar: false });
  });
  it("descarta cualquier resultado si no hay consulta vigente (tras cancelar)", () => {
    expect(aplicarResultado({ reqIdVigente: null }, { reqId: "r1", valor: 1 })).toEqual({ aplicar: false });
  });
});
