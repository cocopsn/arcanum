// Fase inferida (design §12.3, RF-P2). Función pura sobre las señales que el sensor y la ubicación derivan: la primera
// fila que aplica gana. Decoupleada del DOM para probarla fila por fila (CA-20) con read models y sensados de prueba.
// El tipo de ítem abierto lo nombra el sensor (§12.1). Si una señal no está, la fila no aplica y se cae a la 12.
import type { Fase, Superficie } from "./tipos";

/** Tipos de ítem de Forge que el sensor puede nombrar (de los runners/stubs). */
export type TipoItem =
  | "prediccion"
  | "desvanecido"
  | "historial"
  | "mutantes"
  | "contraejemplo"
  | "senal"
  | "code"
  | "sql"
  | "ontologia"
  | "permisos"
  | "recuperacion"
  | "forense"
  | "gameday"
  | "expediente"
  | "practica"
  | "retencion"
  | null;

/** Señales que deciden la fase (§12.3), derivadas del sensor, el read model y el view model. */
export interface SenalesFase {
  superficie: Superficie;
  /** celda D1-D8 en su primera pasada, sin evidencia (fila 1) */
  diagnosticoSinEvidencia: boolean;
  /** la celda está en vm.reviewQueue (fila 2) */
  enRepaso: boolean;
  /** hay un ítem de retención abierto (fila 2) */
  itemRetencionAbierto: boolean;
  /** la celda está dominada (fila 3) */
  dominada: boolean;
  /** tipo del ítem abierto, si hay uno (filas 5-8) */
  tipoItem: TipoItem;
  /** la celda está disponible sin intentos (fila 10) */
  disponibleSinIntentos: boolean;
  /** hay una celda abierta (fila 11) */
  hayCelda: boolean;
}

/** Ítems que llevan a `contrastar` (fila 5). */
const ITEMS_CONTRASTAR = new Set<TipoItem>(["historial", "mutantes", "contraejemplo", "senal"]);
/** Ítems que llevan a `construir` (fila 8). */
const ITEMS_CONSTRUIR = new Set<TipoItem>(["code", "sql", "ontologia", "permisos", "recuperacion", "forense", "gameday", "expediente", "practica"]);

/** La fase inferida (§12.3): la primera fila que aplica gana. Devuelve null sólo para la fila 1 (guarda de diagnóstico). */
export function inferirFase(s: SenalesFase): Fase | null {
  if (s.diagnosticoSinEvidencia) return null; // 1. ninguna: guarda de diagnóstico (§12.6)
  if (s.enRepaso || s.itemRetencionAbierto) return "retener"; // 2
  if (s.dominada) return "transferir"; // 3
  if (s.superficie === "compuerta" || s.superficie === "mision") return "transferir"; // 4
  if (ITEMS_CONTRASTAR.has(s.tipoItem)) return "contrastar"; // 5
  if (s.tipoItem === "desvanecido") return "completar"; // 6
  if (s.tipoItem === "prediccion") return "predecir"; // 7
  if (ITEMS_CONSTRUIR.has(s.tipoItem)) return "construir"; // 8
  if (s.superficie === "libro" || s.superficie === "leccion") return "comprender"; // 9
  if (s.disponibleSinIntentos) return "predecir"; // 10
  if (s.hayCelda) return "comprender"; // 11
  return "general"; // 12
}
