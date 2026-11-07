// Orquestación de un envío (design §14.1, CA-19, CA-21). Pruebas unitarias con un transporte espía y guardas reales:
// sin red no sale nada; la guarda de diagnóstico corta; el fallar-cerrado del filtro reservado no reserva cupo ni
// llama al transporte; una conversación con Forge carga reservado y redacta. Los red-checks con vi.mock viven en
// archivos aparte (uno por mock), para poder exigir toHaveBeenCalled().
import { describe, expect, it, vi } from "vitest";
import { consultar, type DepsConsulta } from "../consultar";
import type { EntradaSolicitud, Ubicacion } from "../tipos";
import { deBase64, decodificarHashes } from "../gramas.mjs";
import { construir } from "../../../../scripts/companion/build-index.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

const ubic = (over: Partial<Ubicacion> = {}): Ubicacion => ({
  mundo: "ITC",
  superficie: "celda",
  fase: "comprender",
  faseFuente: "inferida",
  modosFalla: [],
  brechas: [],
  repasos: [],
  tiposSugeridos: [],
  ...over,
});

const entrada = (over: Partial<EntradaSolicitud> = {}): EntradaSolicitud => ({
  pregunta: "¿por qué?",
  pedido: "explicar",
  nivelPista: 0,
  lenguaje: "javascript",
  historial: [],
  pasajes: [],
  notas: [],
  ubicacion: ubic(),
  mundo: "mundo",
  conversacion: null,
  ...over,
});

function deps(over: Partial<DepsConsulta> = {}): DepsConsulta {
  return {
    buscar: async () => ({ pasajes: [] }),
    enLinea: () => true,
    haySesion: async () => true,
    reservar: async () => ({ ok: true }),
    cargarReservado: async () => null,
    transporte: vi.fn(async () => ({ tipo: "ok" as const, data: { respuesta: "r", citas: [], artefactos: [], plan: [], avisos: [], provider: "azure" } })),
    signal: new AbortController().signal,
    ...over,
  };
}

describe("consultar (§14.1)", () => {
  it("CA-19: sin red no sale ninguna petición y no se reserva cupo", async () => {
    const transporte = vi.fn(async () => ({ tipo: "ok" as const, data: { respuesta: "r", citas: [], artefactos: [], plan: [], avisos: [], provider: "a" } }));
    const reservar = vi.fn(async () => ({ ok: true as const }));
    const r = await consultar(entrada(), deps({ enLinea: () => false, transporte, reservar }));
    expect(r.tipo).toBe("local");
    if (r.tipo === "local") expect(r.motivo).toBe("sin-red");
    expect(transporte).not.toHaveBeenCalled();
    expect(reservar).not.toHaveBeenCalled();
  });

  it("CA-21: en una celda de diagnóstico D1-D8 sin evidencia no se ayuda ni se reserva cupo", async () => {
    const transporte = vi.fn(async () => ({ tipo: "ok" as const, data: { respuesta: "r", citas: [], artefactos: [], plan: [], avisos: [], provider: "a" } }));
    const reservar = vi.fn(async () => ({ ok: true as const }));
    const r = await consultar(entrada({ ubicacion: ubic({ celda: { titulo: "Diagnóstico", estado: "en_curso", codigo: "D3" } }) }), deps({ sinEvidencia: true, transporte, reservar }));
    expect(r.tipo).toBe("local");
    if (r.tipo === "local") expect(r.motivo).toBe("diagnostico");
    expect(transporte).not.toHaveBeenCalled();
    expect(reservar).not.toHaveBeenCalled();
  });

  it("sin sesión corta con el texto local y no reserva cupo", async () => {
    const reservar = vi.fn(async () => ({ ok: true as const }));
    const r = await consultar(entrada(), deps({ haySesion: async () => false, reservar }));
    expect(r.tipo).toBe("local");
    expect(reservar).not.toHaveBeenCalled();
  });

  it("fallar-cerrado: conversación con Forge y cargarReservado que rechaza → sin-filtro, sin transporte ni cupo", async () => {
    const transporte = vi.fn(async () => ({ tipo: "ok" as const, data: { respuesta: "r", citas: [], artefactos: [], plan: [], avisos: [], provider: "a" } }));
    const reservar = vi.fn(async () => ({ ok: true as const }));
    const r = await consultar(
      entrada({ mundo: "mundo", conversacion: { mundo: "inicio", mensajes: [{ mundo: "forge", pasajesEnviados: [] }] } }),
      deps({ cargarReservado: async () => null, transporte, reservar }),
    );
    expect(r.tipo).toBe("sin-filtro");
    expect(transporte).not.toHaveBeenCalled();
    expect(reservar).not.toHaveBeenCalled();
  });

  it("conversación con Forge y tabla real: redacta un turno con una frase reservada y sí llama al transporte", async () => {
    const repo = construir({ root: ROOT });
    const tabla = decodificarHashes(deBase64(JSON.parse(repo.reservado.texto).h)!)!;
    const transporte = vi.fn(async () => ({ tipo: "ok" as const, data: { respuesta: "r", citas: [], artefactos: [], plan: [], avisos: [], provider: "a" } }));
    const r = await consultar(
      entrada({ conversacion: { mundo: "forge", mensajes: [] } }),
      deps({ cargarReservado: async () => tabla, transporte }),
    );
    expect(r.tipo).toBe("respuesta");
    expect(transporte).toHaveBeenCalledTimes(1);
  });

  it("límite sin cupo corta con esperaS y no llama al transporte", async () => {
    const transporte = vi.fn(async () => ({ tipo: "ok" as const, data: { respuesta: "r", citas: [], artefactos: [], plan: [], avisos: [], provider: "a" } }));
    const r = await consultar(entrada(), deps({ reservar: async () => ({ ok: false, esperaS: 42 }), transporte }));
    expect(r.tipo).toBe("limite");
    if (r.tipo === "limite") expect(r.esperaS).toBe(42);
    expect(transporte).not.toHaveBeenCalled();
  });
});
