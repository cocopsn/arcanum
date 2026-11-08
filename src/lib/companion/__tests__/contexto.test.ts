// Armado del contexto (design §12.5). Comprueba los dos recortes, las omisiones, el corte a 60,000, la redacción
// inyectada (y el null → sin-filtro), y las cinco condiciones de tieneForge / esPasajeForge.
import { describe, expect, it } from "vitest";
import { MANIFIESTO } from "../generated/particiones";
import { LIMITES } from "../tipos";
import type { EntradaSolicitud, PasajeCandidato, Ubicacion } from "../tipos";
import { armarSolicitud, esPasajeForge, tieneForge } from "../contexto";

const identidad = (s: string) => ({ texto: s, cambio: false });

const ubicacion = (over: Partial<Ubicacion> = {}): Ubicacion => ({
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
  ubicacion: ubicacion(),
  mundo: "mundo",
  conversacion: null,
  ...over,
});

const FORGE_LIBRO = MANIFIESTO.find((m) => m.spine === "Engineering Forge")!.nombre;
const ITC_LIBRO = MANIFIESTO.find((m) => m.spine === "ITC" && m.nombre.startsWith("libros"))!.nombre;

describe("armarSolicitud (§12.5)", () => {
  it("recorta pregunta y cada pasaje a su límite y numera P1…Pn", () => {
    const pasajes: PasajeCandidato[] = [
      { clave: "a", tipo: "libro", titulo: "T1", seccion: "S", texto: "x".repeat(3000), puntaje: 9, particion: ITC_LIBRO },
      { clave: "b", tipo: "libro", titulo: "T2", seccion: "S", texto: "y".repeat(10), puntaje: 5, particion: ITC_LIBRO },
    ];
    const r = armarSolicitud(entrada({ pregunta: "p".repeat(5000), pasajes }), { redactar: identidad });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.pregunta.length).toBe(LIMITES.pregunta);
    expect(r.payload.pasajes.map((p) => p.id)).toEqual(["P1", "P2"]);
    expect(r.payload.pasajes[0]!.texto.length).toBeLessThanOrEqual(LIMITES.pasajes.texto);
  });

  it("omite un turno con estado distinto de ok y uno cuyo texto queda vacío", () => {
    const r = armarSolicitud(
      entrada({
        historial: [
          { rol: "aprendiz", texto: "válido", estado: "ok" },
          { rol: "companero", texto: "cancelado", estado: "cancelado" },
          { rol: "aprendiz", texto: "   ", estado: "ok" },
        ],
      }),
      { redactar: identidad },
    );
    expect(r.ok && r.payload.historial.map((t) => t.texto)).toEqual(["válido"]);
  });

  it("deja a lo más 6 turnos de historial", () => {
    const historial = Array.from({ length: 9 }, (_, i) => ({ rol: "aprendiz" as const, texto: `t${i}`, estado: "ok" as const }));
    const r = armarSolicitud(entrada({ historial }), { redactar: identidad });
    expect(r.ok && r.payload.historial.length).toBe(6);
  });

  it("omite celda/libro/ejercicio cuando su cadena obligatoria queda vacía; mundo vacío → «Inicio»", () => {
    const r = armarSolicitud(entrada({ ubicacion: ubicacion({ mundo: "  ", celda: { titulo: "  ", estado: "en_curso" } }) }), { redactar: identidad });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.ubicacion.mundo).toBe("Inicio");
    expect(r.payload.ubicacion.celda).toBeUndefined();
  });

  it("redactar que devuelve null corta con { ok: false, motivo: 'sin-filtro' }", () => {
    const r = armarSolicitud(entrada(), { redactar: () => null });
    expect(r).toEqual({ ok: false, motivo: "sin-filtro" });
  });

  it("redacto es true si alguna cadena cambió", () => {
    const red = (s: string) => ({ texto: s.replace("por", "[x]"), cambio: s.includes("por") });
    const r = armarSolicitud(entrada({ pregunta: "¿por qué?" }), { redactar: red });
    expect(r.ok && r.redacto).toBe(true);
  });

  it("recorta otra vez después de redactar (la redacción puede alargar)", () => {
    // el redactor reemplaza cada «a» por una marca larga; la segunda pasada vuelve a recortar al límite
    const red = (s: string) => ({ texto: s.replace(/a/g, "[contenido reservado]"), cambio: /a/.test(s) });
    const pasajes: PasajeCandidato[] = [{ clave: "a", tipo: "libro", titulo: "Ta", seccion: "", texto: "a".repeat(1400), puntaje: 1, particion: ITC_LIBRO }];
    const r = armarSolicitud(entrada({ pasajes }), { redactar: red });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.pasajes[0]!.texto.length).toBeLessThanOrEqual(LIMITES.pasajes.texto);
  });
});

describe("esPasajeForge y tieneForge (§12.5)", () => {
  it("esPasajeForge: partición Forge o nota de celda Forge", () => {
    expect(esPasajeForge({ particion: FORGE_LIBRO })).toBe(true);
    expect(esPasajeForge({ particion: ITC_LIBRO })).toBe(false);
    expect(esPasajeForge({ notaForge: true })).toBe(true);
    expect(esPasajeForge({})).toBe(false);
  });

  it("condición 1: mundo activo Forge", () => {
    expect(tieneForge(entrada({ mundo: "forge" }))).toBe(true);
  });
  it("condición 2: celda con código (sólo Forge lo tiene)", () => {
    expect(tieneForge(entrada({ ubicacion: ubicacion({ celda: { titulo: "c", estado: "en_curso", codigo: "F0-01" } }) }))).toBe(true);
  });
  it("condición 3: un pasaje de partición Forge", () => {
    expect(tieneForge(entrada({ pasajes: [{ clave: "a", tipo: "libro", titulo: "T", seccion: "", texto: "x", puntaje: 1, particion: FORGE_LIBRO }] }))).toBe(true);
  });
  it("condición 4: conversación en Forge aunque la solicitud no lo sea", () => {
    expect(tieneForge(entrada({ mundo: "mundo", conversacion: { mundo: "forge", mensajes: [] } }))).toBe(true);
  });
  it("condición 5: un mensaje de la conversación en Forge, sin mundo válido, o con pasaje enviado Forge", () => {
    expect(tieneForge(entrada({ conversacion: { mundo: "inicio", mensajes: [{ mundo: "forge", pasajesEnviados: [] }] } }))).toBe(true);
    expect(tieneForge(entrada({ conversacion: { mundo: "inicio", mensajes: [{ pasajesEnviados: [] }] } }))).toBe(true); // sin mundo = fallar-cerrado
    expect(tieneForge(entrada({ conversacion: { mundo: "inicio", mensajes: [{ mundo: "mundo", pasajesEnviados: [{ forge: true }] }] } }))).toBe(true);
  });
  it("sin nada de Forge: falso", () => {
    expect(tieneForge(entrada({ mundo: "mundo", conversacion: { mundo: "inicio", mensajes: [{ mundo: "mundo", pasajesEnviados: [{ forge: false }] }] } }))).toBe(false);
  });
});
