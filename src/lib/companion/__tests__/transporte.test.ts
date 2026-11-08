// Transporte, clasificación y normalización (design §14.2, CA-38). Prueba la tabla de clasificación, que
// normalizarRespuesta descarta una forma inválida y deja pasar una válida con un campo extra, que nada se reintenta
// solo, y el red-check de normalizar como identidad.
import { describe, expect, it, vi } from "vitest";
import { clasificar, invocarCompanion, motivoForma, normalizarRespuesta, type RespuestaNormalizada } from "../transporte";

const OK = { respuesta: "hola", citas: ["P1"], artefactos: [], plan: [], avisos: [], provider: "azure" };

describe("normalizarRespuesta / motivoForma (§14.2)", () => {
  it("una respuesta válida pasa y un campo extra se descarta", () => {
    const r = normalizarRespuesta({ ...OK, extra: 1 });
    expect(r).not.toBeNull();
    expect(r).not.toHaveProperty("extra");
    expect(r!.respuesta).toBe("hola");
  });

  it("artefactos: \"x\" es forma inválida", () => {
    expect(normalizarRespuesta({ ...OK, artefactos: "x" })).toBeNull();
    expect(motivoForma({ ...OK, artefactos: "x" })).toBe("artefactos");
  });

  it("respuesta de más de 8000 o no cadena es inválida", () => {
    expect(motivoForma({ ...OK, respuesta: "a".repeat(8001) })).toBe("respuesta");
    expect(motivoForma({ ...OK, respuesta: 5 })).toBe("respuesta");
  });

  it("provider ausente o largo es inválido", () => {
    const { provider: _p, ...sinProv } = OK;
    expect(motivoForma(sinProv)).toBe("provider");
    expect(motivoForma({ ...OK, provider: "x".repeat(41) })).toBe("provider");
  });

  it("un artefacto de diagrama con fuente de 5000 hace inválidos los artefactos", () => {
    expect(normalizarRespuesta({ ...OK, artefactos: [{ tipo: "diagrama", titulo: "t", fuente: "x".repeat(5000) }] })).toBeNull();
  });
});

describe("clasificar (tabla de §14.2)", () => {
  const base = { abortado: false, enLinea: true, data: null } as const;
  it("200 con forma válida → ok", () => {
    const c = clasificar({ ...base, error: null, data: OK });
    expect(c.tipo).toBe("ok");
  });
  it("401 → sin-sesion; 429 → limite 60 s; 422 → filtrado", () => {
    expect(clasificar({ ...base, error: { clase: "http", status: 401 } }).tipo).toBe("sin-sesion");
    const l = clasificar({ ...base, error: { clase: "http", status: 429 } });
    expect(l).toEqual({ tipo: "limite", esperaS: 60 });
    expect(clasificar({ ...base, error: { clase: "http", status: 422, cuerpo: { error: "bloqueado" } } })).toEqual({ tipo: "filtrado", texto: "bloqueado" });
  });
  it("400 «Acción desconocida» → edge-vieja; 400 «Entrada inválida: X» → invalida X", () => {
    expect(clasificar({ ...base, error: { clase: "http", status: 400, cuerpo: { error: "Acción desconocida." } } }).tipo).toBe("edge-vieja");
    expect(clasificar({ ...base, error: { clase: "http", status: 400, cuerpo: { error: "Entrada inválida: pregunta" } } })).toEqual({ tipo: "invalida", campo: "pregunta" });
  });
  it("503 y relay → no-disponible", () => {
    expect(clasificar({ ...base, error: { clase: "http", status: 503, cuerpo: { error: "x" } } }).tipo).toBe("no-disponible");
    expect(clasificar({ ...base, error: { clase: "relay" } }).tipo).toBe("no-disponible");
  });
  it("fetch con red → no-disponible; sin red → sin-red", () => {
    expect(clasificar({ ...base, enLinea: true, error: { clase: "fetch" } }).tipo).toBe("no-disponible");
    expect(clasificar({ ...base, enLinea: false, error: { clase: "fetch" } }).tipo).toBe("sin-red");
  });
  it("abortado gana sobre cualquier error (cancelar y el corte de 130 s)", () => {
    expect(clasificar({ ...base, abortado: true, error: { clase: "fetch" } }).tipo).toBe("cancelada");
  });
  it("200 con forma inválida → no-disponible", () => {
    expect(clasificar({ ...base, error: null, data: { respuesta: 5 } }).tipo).toBe("no-disponible");
  });

  it("control del red-check: identidad deja pasar una forma inválida; la real la descarta (red-check en redchecks.md)", () => {
    const identidad = (d: unknown) => d as RespuestaNormalizada;
    expect(clasificar({ ...base, error: null, data: { ...OK, artefactos: "x" } }, identidad).tipo).toBe("ok");
    expect(clasificar({ ...base, error: null, data: { ...OK, artefactos: "x" } }).tipo).toBe("no-disponible");
  });
});

describe("invocarCompanion (CA-38, no reintenta)", () => {
  it("un 200 válido se devuelve ok y el invoke se llama una sola vez", async () => {
    const invoke = vi.fn(() => Promise.resolve({ data: OK, error: null }));
    const c = await invocarCompanion({}, new AbortController().signal, { invoke, enLinea: () => true });
    expect(c.tipo).toBe("ok");
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("un error de red con red → no-disponible, sin reintento", async () => {
    const invoke = vi.fn(() => Promise.resolve({ data: null, error: { name: "FunctionsFetchError" } }));
    const c = await invocarCompanion({}, new AbortController().signal, { invoke, enLinea: () => true });
    expect(c.tipo).toBe("no-disponible");
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("si se canceló, el resultado es cancelada aunque el invoke resuelva", async () => {
    const ac = new AbortController();
    const invoke = vi.fn(async () => {
      ac.abort();
      return { data: OK, error: null };
    });
    const c = await invocarCompanion({}, ac.signal, { invoke, enLinea: () => true });
    expect(c.tipo).toBe("cancelada");
  });
});
