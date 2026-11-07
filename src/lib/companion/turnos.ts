// Aplicación de un resultado por reqId (design §14.4, CA-39). Cada consulta lleva un reqId; el estado ignora cualquier
// resultado cuyo reqId no sea el vigente, así una respuesta que llega después de cancelar no pinta ni se guarda.
// Conversacion.tsx y el guardado en db.ts pasan siempre por aquí. Puro. Red-check: una versión que no compara reqId →
// «una respuesta cancelada se pintó».

/** El estado mínimo que necesita aplicarResultado: cuál es la consulta vigente. */
export interface EstadoTurno {
  /** reqId de la consulta en curso; null si no hay ninguna */
  reqIdVigente: string | null;
}

/** Un resultado que llega del transporte, con el reqId de la consulta que lo pidió. */
export interface ResultadoTurno<T> {
  reqId: string;
  valor: T;
}

/** Qué hacer con un resultado: aplicarlo (es el vigente) o descartarlo (llegó tarde o tras cancelar). */
export type Decision<T> = { aplicar: true; valor: T } | { aplicar: false };

/**
 * Decide si un resultado se aplica: sólo si su reqId es el vigente del estado (§14.4). Un resultado de una consulta ya
 * reemplazada o cancelada (reqId distinto o estado sin consulta vigente) se descarta.
 */
export function aplicarResultado<T>(estado: EstadoTurno, r: ResultadoTurno<T>): Decision<T> {
  if (estado.reqIdVigente === null || r.reqId !== estado.reqIdVigente) return { aplicar: false };
  return { aplicar: true, valor: r.valor };
}
