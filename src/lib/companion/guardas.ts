// Guardas de los pasos 1, 3 y 4 de consultar (design §14.1, §12.6). Cada una es pura sobre sus entradas inyectadas;
// consultar.ts las importa (no las define) para que el red-check de §23.3 pueda sustituirlas con vi.mock. Una guarda
// que «deja pasar» devuelve null; si no, devuelve el resultado local que corta la consulta.
import type { Ubicacion } from "./tipos";

/** Lo que una guarda devuelve cuando corta la consulta: un texto local y por qué. */
export interface Corte {
  motivo: "diagnostico" | "sin-red" | "sin-sesion";
  texto: string;
}

/**
 * Guarda de diagnóstico (§12.6, §14.1 paso 1): si la ubicación es una celda D1-D8 sin evidencia, no se llama a la IA
 * (ni se reserva cupo). «Sin evidencia» lo decide `sinEvidencia`, que consultar calcula de la ubicación.
 */
export function guardaDiagnostico(ubicacion: Ubicacion, sinEvidencia: boolean): Corte | null {
  const codigo = ubicacion.celda?.codigo ?? "";
  const esDiagnostico = /^D[1-8]$/.test(codigo);
  if (esDiagnostico && sinEvidencia) {
    return { motivo: "diagnostico", texto: "En la primera pasada de un diagnóstico no hay ayuda: es la medida de dónde empiezas." };
  }
  return null;
}

/** Guarda de sin red (§14.1 paso 3): sin red, la respuesta es la lista local y no sale ninguna petición. */
export function guardaSinRed(enLinea: boolean): Corte | null {
  if (!enLinea) return { motivo: "sin-red", texto: "La IA requiere conexión" };
  return null;
}

/** Guarda de sesión (§14.1 paso 4): sin sesión, no se llama a la IA. */
export function guardaSesion(haySesion: boolean): Corte | null {
  if (!haySesion) return { motivo: "sin-sesion", texto: "Inicia sesión para usar la IA" };
  return null;
}
