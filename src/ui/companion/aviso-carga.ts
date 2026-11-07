// Texto del contrato de chunks cuando una parte del compañero no carga (design §9.1). Módulo propio para el red-check
// de chunk-panel.test.tsx. Envuelve isChunkError y chunkErrorText de la app: se importan, no se copian.
import { chunkErrorText, isChunkError } from "@/lib/chunk-error";

export const TEXTO_FALLA_GENERICA = "No se pudo cargar esta parte del compañero.";

/** `recargar` sólo con el tipo stale: recargar sin red no arregla nada. Pura: quien llama lee el navegador. */
export function avisoCarga(e: unknown, entorno: { controlled: boolean; online: boolean }): { texto: string; recargar: boolean } {
  if (!isChunkError(e)) return { texto: TEXTO_FALLA_GENERICA, recargar: false };
  const r = chunkErrorText(entorno);
  return { texto: r.texto, recargar: r.tipo === "stale" };
}
