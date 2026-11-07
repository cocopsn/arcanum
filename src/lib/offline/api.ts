// Fachada offline de Engineering Forge (design poblar §6.4). Firmas congeladas en la Fase 0; los cuerpos los escribe
// poblar/offline-motor y cada uno hace `await import()` de su módulo en src/forge/offline/ o src/lib/offline/, así la
// fachada pesa unos cientos de bytes en el chunk de página.
import type { DeleteResult, DownloadOptions, DownloadResult, ResourceCount, ScopeStatus, StorageReport } from "./types";

const noRoute = (slug: string): DownloadResult => ({ ok: false, motivo: "no-disponible", detalle: `La ruta «${slug.slice(0, 40)}» no existe en este índice` });

async function forgeOffline() {
  const [plan, data] = await Promise.all([import("@/forge/offline/plan"), import("@/forge/offline/index-data")]);
  return { ...plan, index: await data.loadOfflineIndex() };
}

/** Estado de una ruta, verificado contra el almacenamiento. Un slug desconocido da un alcance vacío, no completo. */
export async function forgeRouteStatus(slug: string): Promise<ScopeStatus> {
  const f = await forgeOffline();
  const plan = f.routePlan(f.index, slug) ?? { key: f.routeKey(slug), libros: [], bancos: [], python: false, sqlite: false, atlas: [], figuras: [] };
  const st = await (await import("@/forge/offline/verify")).scopeStatus(plan);
  return f.index.rutas[slug] ? st : { ...st, completa: false };
}

/** Estado del mundo Forge entero. */
export async function forgeWorldStatus(): Promise<ScopeStatus> {
  const f = await forgeOffline();
  return (await import("@/forge/offline/verify")).scopeStatus(f.worldPlan(f.index));
}

/** Descarga libros, bancos, Atlas, Python y figuras de una ruta. */
export async function downloadForgeRoute(slug: string, o: DownloadOptions): Promise<DownloadResult> {
  const f = await forgeOffline();
  const plan = f.routePlan(f.index, slug);
  if (!plan) return noRoute(slug);
  return (await import("@/forge/offline/run")).runDownload(plan, o);
}

/** Descarga el mundo Forge entero (la unión de las 19 rutas, sin repetir archivos). */
export async function downloadForgeWorld(o: DownloadOptions): Promise<DownloadResult> {
  const f = await forgeOffline();
  return (await import("@/forge/offline/run")).runDownload(f.worldPlan(f.index), o);
}

/** Borra lo exclusivo de una ruta descargada. */
export async function deleteForgeRoute(slug: string): Promise<DeleteResult> {
  const f = await forgeOffline();
  return (await import("@/forge/offline/delete")).deleteScope(f.routeKey(slug), f.routePlan(f.index, slug));
}

/** Borra la descarga del mundo Forge: todo lo de Forge que registró este dispositivo, salvo Python e importaciones. */
export async function deleteForgeWorld(): Promise<DeleteResult> {
  const f = await forgeOffline();
  return (await import("@/forge/offline/delete")).deleteScope(f.WORLD_KEY, f.worldPlan(f.index), {}, true);
}

/** Borra la fila de Dexie (nunca una importación) y el archivo en caché del libro de una celda. */
export async function deleteForgeBookLocal(code: string): Promise<DeleteResult> {
  return (await import("@/forge/offline/delete")).deleteBookLocalScope(code);
}

/** NOMBRES de archivo (`<código>.<sha10>.md`, no URLs) presentes en arcanum-forge-books-v1; null sin Cache API, que
 *  cuenta como «sin archivo» en bookAvailability. */
export async function forgeBookCacheFiles(): Promise<Set<string> | null> {
  return (await import("./books-cache")).forgeBookCacheFiles();
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

/** Si la figura (por su URL canónica) está en arcanum-forge-figuras-v1; null sin Cache API. */
export async function isFigureCached(url: string): Promise<boolean | null> {
  return (await import("./figures")).isFigureCached(url);
}

/** Entradas del precache presentes según el SW; null sin controlador o sin respuesta en 3 s. */
export async function precacheStatus(): Promise<{ listos: number; total: number } | null> {
  return (await import("./sw-client")).precacheStatus();
}

/** Almacenamiento durable, uso y cuota, y si es Safari de iOS sin instalar. */
export async function storageReport(): Promise<StorageReport> {
  return (await import("@/lib/storage")).storageReport();
}
