// Textos únicos del uso sin red (design poblar §6.8). Contrato congelado de la Fase 0: cada superficie que encola, que
// no puede mostrar algo sin conexión o que pierde un chunk pinta exactamente estos textos.

export const AI_QUEUED_TEXT = "Guardado: la IA lo evaluará al reconectar.";
export const AI_QUEUED_NO_GATE = "Encolar no abre nada; el veredicto real decide.";
export const AI_QUEUED_LESSON_TEXT =
  "Sin red: tu respuesta queda en esta pantalla y la IA la evaluará al reconectar. Si sales de la lección, se descarta como hoy.";
export const VIDEO_NEEDS_NETWORK = "Video · requiere conexión";
export const FIGURE_NEEDS_NETWORK = "Figura disponible sólo con red";
export const PARTITION_NOT_DOWNLOADED = "Partición no descargada: requiere conexión";
export const APP_UPDATED = "Arcanum se actualizó. Recarga cuando termines lo que estás haciendo.";
export const CHUNK_STALE = "Hay una versión nueva de Arcanum. Recarga para continuar.";
export const CHUNK_NOT_DOWNLOADED = "Esta parte de Arcanum no está descargada en este dispositivo: ábrela una vez con conexión.";
export const ORDER_DEVICE_ONLY = "Este orden vive sólo en este dispositivo; no se sincroniza.";

/** Texto de un envío de Forge en cola: el de la misión y el de la defensa de ontología. */
export function forgeQueuedText(motivo: string, prefijo: "En cola" | "Defensa en cola"): string {
  if (motivo === AI_QUEUED_TEXT) return `${AI_QUEUED_TEXT} ${AI_QUEUED_NO_GATE}`;
  return `${prefijo}: ${motivo.replace(/\.$/, "")}. ${AI_QUEUED_NO_GATE}`;
}
