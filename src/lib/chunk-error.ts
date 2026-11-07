// Un chunk que no carga (design poblar §5.7 y §6.9). Contrato congelado de la Fase 0: la misma regla para Lecturas,
// src/app/error.tsx y AppUpdate. Con un service worker controlando, el SW activo tiene todos los chunks de su build
// (H31): el que falta es de un build anterior y recargar lo arregla con o sin red. Sin controlador, sin red la parte no
// está descargada y con red es un desfase de despliegue. Mirar sólo la red diría «no descargado» también con
// controlador.
import { CHUNK_NOT_DOWNLOADED, CHUNK_STALE } from "@/lib/offline-texts";

const CHUNK_ERROR_MESSAGE =
  /Loading (CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/;

/** El error de un `import()` o de un chunk de webpack que no llegó (ChunkLoadError, o su mensaje en Chrome y Safari). */
export function isChunkError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const { name, message } = err as { name?: unknown; message?: unknown };
  if (name === "ChunkLoadError") return true;
  return typeof message === "string" && CHUNK_ERROR_MESSAGE.test(message);
}

/** stale: recargar lo arregla (pinta también «Recargar»). no-descargado: hace falta abrirla una vez con conexión. */
export type ChunkErrorKind = "stale" | "no-descargado";

/** Tipo y texto de un error de chunk según el controlador (`navigator.serviceWorker.controller`) y la red
 *  (`navigator.onLine`). Pura: quien llama lee el navegador. */
export function chunkErrorText({ controlled, online }: { controlled: boolean; online: boolean }): {
  tipo: ChunkErrorKind;
  texto: string;
} {
  if (controlled || online) return { tipo: "stale", texto: CHUNK_STALE };
  return { tipo: "no-descargado", texto: CHUNK_NOT_DOWNLOADED };
}
