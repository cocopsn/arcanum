// Orquestación de un envío (design §14.1). consultar importa las guardas, tieneForge, armarSolicitud y crearRedactor de
// sus módulos y NO define ninguno (iteración 3, r4 #2), para que los red-checks de §23.3 puedan sustituirlos con
// vi.mock (si vivieran aquí, el sustituto no se llamaría). Orden: todo lo que puede terminar sin llamar a la IA va
// antes de reservar cupo, y la reserva va justo antes del transporte, así ninguna consulta que no sale gasta cupo.
import { guardaDiagnostico, guardaSinRed, guardaSesion, type Corte } from "./guardas";
import { armarSolicitud, tieneForge } from "./contexto";
import { crearRedactor, type TablaReservada } from "./reservado";
import type { Clasificacion } from "./transporte";
import type { EntradaSolicitud } from "./tipos";
import type { Reserva } from "./limite";

/** Un pasaje candidato que ya pasó por buscar/hidratar/filtros (lo arma consultar antes de llamar). */
export interface ResultadoBusqueda {
  /** los pasajes locales (para pintar la lista sin red y para armar la solicitud) */
  pasajes: EntradaSolicitud["pasajes"];
}

/** Lo que consultar devuelve a la UI (§14.1). */
export type ResultadoConsulta =
  | { tipo: "local"; motivo: Corte["motivo"]; texto: string; pasajes: EntradaSolicitud["pasajes"] }
  | { tipo: "sin-filtro"; texto: string }
  | { tipo: "limite"; esperaS: number; texto: string }
  | { tipo: "respuesta"; clasificacion: Clasificacion; redacto: boolean };

/** Texto del fallar-cerrado del filtro reservado (§12.7). */
export const TEXTO_SIN_FILTRO = "Falta el filtro de contenido reservado en este dispositivo; recarga la app con conexión.";
/** Aviso cuando la redacción quitó contenido reservado (§12.7). */
export const TEXTO_REDACTO = "Parte de lo que ibas a enviar coincide con contenido reservado de una evaluación y no se envió";
/** Texto del límite (§14.2). */
export const textoLimite = (esperaS: number) => `Llegaste al límite de consultas por minuto; podrás preguntar en ${esperaS} s.`;

/** Dependencias inyectadas (§14.1): el transporte, el límite, enLinea, la sesión, la búsqueda y cargarReservado. */
export interface DepsConsulta {
  buscar: (entrada: EntradaSolicitud) => Promise<ResultadoBusqueda>;
  enLinea: () => boolean;
  haySesion: () => Promise<boolean>;
  /** cupo del límite */
  reservar: () => Promise<Reserva>;
  /** marca el límite lleno (cuando la Edge responde 429) */
  marcarLleno?: () => void;
  cargarReservado: () => Promise<TablaReservada | null>;
  transporte: (context: unknown, signal: AbortSignal) => Promise<Clasificacion>;
  signal: AbortSignal;
  /** «sin evidencia» de la celda de diagnóstico, que la UI calcula de la ubicación */
  sinEvidencia?: boolean;
  /** avisa al panel «Parte de lo que ibas a enviar…» cuando la redacción cambió algo */
  onRedacto?: () => void;
}

/**
 * Corre un envío (§14.1, pasos 1-13 en lo que no es pintado). Devuelve el resultado que la UI pinta; nunca reserva cupo
 * para una consulta que no sale.
 */
export async function consultar(entrada: EntradaSolicitud, deps: DepsConsulta): Promise<ResultadoConsulta> {
  // 1. Guarda de diagnóstico (no llama a la IA ni reserva cupo).
  const gd = guardaDiagnostico(entrada.ubicacion, deps.sinEvidencia ?? false);
  // 2. Búsqueda local (siempre corre; también es lo que se pinta sin red).
  const { pasajes } = await deps.buscar(entrada);
  if (gd) return { tipo: "local", motivo: gd.motivo, texto: gd.texto, pasajes };

  const entradaConPasajes: EntradaSolicitud = { ...entrada, pasajes };

  // 3. Sin red → muestra los pasajes y «La IA requiere conexión».
  const gr = guardaSinRed(deps.enLinea());
  if (gr) return { tipo: "local", motivo: gr.motivo, texto: gr.texto, pasajes };

  // 4. Sin sesión.
  const gs = guardaSesion(await deps.haySesion());
  if (gs) return { tipo: "local", motivo: gs.motivo, texto: gs.texto, pasajes };

  // 5. Redactor: si tieneForge, carga reservado.json; crearRedactor decide identidad / fallar-cerrado / redacción.
  const conForge = tieneForge(entradaConPasajes);
  const tabla = conForge ? await deps.cargarReservado() : null;
  const redactar = crearRedactor(tabla, conForge);

  // 6. armarSolicitud (arma, recorta, redacta, recorta). sin-filtro → aviso de fallar-cerrado, sin reservar cupo.
  const armada = armarSolicitud(entradaConPasajes, { redactar });
  if (!armada.ok) return { tipo: "sin-filtro", texto: TEXTO_SIN_FILTRO };

  // 7. Si redactó, avisa y sigue.
  if (armada.redacto) deps.onRedacto?.();

  // 8. Reserva cupo justo antes del transporte.
  const r = await deps.reservar();
  if (!r.ok) return { tipo: "limite", esperaS: r.esperaS, texto: textoLimite(r.esperaS) };

  // 9. Transporte.
  const clasificacion = await deps.transporte(armada.payload, deps.signal);
  if (clasificacion.tipo === "limite") deps.marcarLleno?.();

  // 10-13: cancelación, normalización, filtros y guardado los maneja la UI con aplicarResultado y el resultado.
  return { tipo: "respuesta", clasificacion, redacto: armada.redacto };
}
