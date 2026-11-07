// Reglas puras del offline de Engineering Forge (design poblar §5.3 y §6.4). Contrato congelado de la Fase 0: la
// columna «en este dispositivo» de Lecturas, la verificación de una ruta y el aviso de espacio de una descarga usan
// estas mismas funciones. Ninguna lee el navegador: quien llama toma la instantánea (Dexie, Cache Storage, estimate()).
import type { Disponible } from "@/lib/library/types";
import type { ScopeStatus } from "./types";

/** Relleno de cuota que Chrome cuenta por cada respuesta opaca, como las figuras de palantir.com (≈ 7 MB, §6.5). */
export const OPAQUE_PAD_BYTES = 7 * 1024 * 1024;

/** Textos exactos de la columna «en este dispositivo» de un libro de Forge (§5.3). */
export const BOOK_AVAILABILITY_TEXT = {
  importado: "En este dispositivo · tu importación",
  presente: "En este dispositivo",
  anterior: "Versión anterior en este dispositivo · se actualiza con red",
  falta: "Requiere conexión una vez",
} as const;

export interface BookAvailabilityInput {
  /** La fila de arcanum-books del libro de la celda, con el sha10 de su `md` (el de loaders.ts); null sin fila. */
  row: { source: "seed" | "import"; sha10: string } | null;
  /** El libro publicado según el índice: su archivo (`<código>.<sha10>.md`) y su sha10. */
  current: { file: string; sha10: string };
  /** Nombres de archivo en arcanum-forge-books-v1 (`forgeBookCacheFiles()`); null sin Cache API = «sin archivo». */
  cacheFiles: ReadonlySet<string> | null;
}

/** Estado en este dispositivo de un libro de Forge (§5.3). Es la única regla: ninguna bandera de localStorage. */
export function bookAvailability({ row, current, cacheFiles }: BookAvailabilityInput): {
  disponible: Extract<Disponible, "si" | "anterior" | "no">;
  detalle: string;
} {
  if (row?.source === "import") return { disponible: "si", detalle: BOOK_AVAILABILITY_TEXT.importado };
  if (row && row.sha10 === current.sha10) return { disponible: "si", detalle: BOOK_AVAILABILITY_TEXT.presente };
  // el archivo vigente en la caché basta aunque no haya fila o la fila sea vieja: el lector lo materializa sin red
  if (cacheFiles?.has(current.file)) return { disponible: "si", detalle: BOOK_AVAILABILITY_TEXT.presente };
  if (row) return { disponible: "anterior", detalle: BOOK_AVAILABILITY_TEXT.anterior };
  return { disponible: "no", detalle: BOOK_AVAILABILITY_TEXT.falta };
}

/** Bytes que ocupará una descarga: lo que falta de libros, Atlas y Python, más el relleno de cuota de las figuras que
 *  faltan si la descarga las incluye. */
export function previstoBytes(estado: Pick<ScopeStatus, "bytesPrevistos" | "cuotaFiguras">, figuras: boolean): number {
  return estado.bytesPrevistos + (figuras ? estado.cuotaFiguras : 0);
}

/** Avisa si el espacio libre es menor que 1.2 veces lo previsto. Sin `estimate()` (libre null) no hay aviso. */
export function estimateWarning(libre: number | null, previsto: number): boolean {
  return libre !== null && libre < previsto * 1.2;
}
