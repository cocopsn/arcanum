// Fachada offline de Engineering Forge (design poblar §6.4). Firmas congeladas en la Fase 0; los cuerpos reales los
// escribe poblar/offline-motor, y cada uno hará `await import()` de su módulo en src/forge/offline/ o src/lib/offline/,
// así la fachada pesa unos cientos de bytes en el chunk de página.
//
// Fase 0: cuerpos stub honestos. Ninguno informa un éxito: los estados salen vacíos (nada listo, `completa: false`),
// descargar y calentar Python responden «no-disponible», los borrados no borran nada y lo dicen en `errores`, y lo que
// todavía no se puede saber es `null`.
import type { DeleteResult, DownloadOptions, DownloadResult, ResourceCount, ScopeStatus, StorageReport } from "./types";

const NO_DISPONIBLE = "aún no disponible en esta versión";

const sinRecursos = (): ResourceCount => ({ listos: 0, total: 0, faltan: [], bytes: null });

function estadoVacio(): ScopeStatus {
  return {
    libros: sinRecursos(),
    bancos: sinRecursos(),
    atlas: sinRecursos(),
    python: null,
    figuras: sinRecursos(),
    app: null,
    completa: false,
    bytesPrevistos: 0,
    cuotaFiguras: 0,
  };
}

const noDisponible = (): DownloadResult => ({ ok: false, motivo: "no-disponible", detalle: NO_DISPONIBLE });

const nadaBorrado = (): DeleteResult => ({ liberadosBytes: 0, compartidosBytes: 0, figurasBorradas: 0, errores: [NO_DISPONIBLE] });

/** Estado de una ruta, verificado contra el almacenamiento. Fase 0: el estado vacío. */
export async function forgeRouteStatus(slug: string): Promise<ScopeStatus> {
  return estadoVacio();
}

/** Estado del mundo Forge entero. Fase 0: el estado vacío. */
export async function forgeWorldStatus(): Promise<ScopeStatus> {
  return estadoVacio();
}

/** Descarga libros, bancos, Atlas, Python y figuras de una ruta. Fase 0: «no-disponible». */
export async function downloadForgeRoute(slug: string, o: DownloadOptions): Promise<DownloadResult> {
  return noDisponible();
}

/** Descarga el mundo Forge entero. Fase 0: «no-disponible». */
export async function downloadForgeWorld(o: DownloadOptions): Promise<DownloadResult> {
  return noDisponible();
}

/** Borra lo exclusivo de una ruta descargada. Fase 0: no borra nada y lo dice en `errores`. */
export async function deleteForgeRoute(slug: string): Promise<DeleteResult> {
  return nadaBorrado();
}

/** Borra la descarga del mundo Forge. Fase 0: no borra nada y lo dice en `errores`. */
export async function deleteForgeWorld(): Promise<DeleteResult> {
  return nadaBorrado();
}

/** Borra la fila de Dexie y el archivo en caché del libro de una celda. Fase 0: no borra nada y lo dice en `errores`. */
export async function deleteForgeBookLocal(code: string): Promise<DeleteResult> {
  return nadaBorrado();
}

/** Nombres de archivo (`<código>.<sha10>.md`) presentes en arcanum-forge-books-v1; null sin Cache API, que cuenta
 *  como «sin archivo» en bookAvailability. Fase 0: null. */
export async function forgeBookCacheFiles(): Promise<Set<string> | null> {
  return null;
}

/** Archivos de Pyodide en arcanum-pyodide (con SQLite si se pide), status 200 y no opacos; null sin Cache API. */
export async function pythonStatus(o?: { sqlite?: boolean }): Promise<ResourceCount | null> {
  return (await import("./python")).pythonStatus(o);
}

/** Descarga Pyodide en el worker, que guarda él mismo sus archivos, y verifica en el almacenamiento que estén todos. */
export async function warmPython(o: { sqlite: boolean }): Promise<{ ok: true } | { ok: false; motivo: string }> {
  return (await import("./python")).warmPython(o);
}

/** Reinicia el worker y después borra arcanum-pyodide. */
export async function deletePython(): Promise<DeleteResult> {
  return (await import("./python")).deletePython();
}

/** Si la figura (por su URL canónica) está en arcanum-forge-figuras-v1; null sin Cache API. Fase 0: null. */
export async function isFigureCached(url: string): Promise<boolean | null> {
  return null;
}

/** Entradas del precache presentes según el SW; null sin controlador o sin respuesta. Fase 0: null. */
export async function precacheStatus(): Promise<{ listos: number; total: number } | null> {
  return null;
}

/** Almacenamiento durable, uso y cuota, y si es Safari de iOS sin instalar. Fase 0: nada informado. */
export async function storageReport(): Promise<StorageReport> {
  return { persistente: null, usoBytes: null, cuotaBytes: null, iosSinInstalar: false };
}
