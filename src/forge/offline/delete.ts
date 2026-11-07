// Borrar una ruta, el mundo o el libro de una celda (design poblar §6.4 «Borrado», §6.11). Con las filas de `routes`
// calcula qué es exclusivo (ninguna otra ruta registrada lo usa) y borra sólo eso: filas `seed` de libros y bancos
// (nunca `import`), sus archivos en arcanum-forge-books-v1 (también versiones viejas), particiones del Atlas y figuras
// exclusivas (que salen de la lista de permitidas). Python nunca se borra aquí. Nunca toca el log (`arcanum`), otras
// bases ni el precache.
import { ATLAS_CACHE } from "@/app/sw-rules";
import { pruneAtlasCache } from "@/forge/atlas/cache";
import { forgeCellId } from "@/forge/ids";
import { deleteBook, getBookForModule } from "@/lib/book-store";
import { deleteBank, getBanksForModule } from "@/lib/exercise-store";
import { deleteRouteRow, listRouteRows, type OfflineRouteRow } from "@/lib/offline-store";
import { deleteBookFiles } from "@/lib/offline/books-cache";
import { deleteFigures, writePermittedFigures } from "@/lib/offline/figures";
import type { DeleteResult } from "@/lib/offline/types";
import type { OfflinePlan } from "./plan";
import { atlasUrl } from "./verify";

export interface DeleteDeps {
  listRoutes(): Promise<OfflineRouteRow[]>;
  deleteRoute(key: string): Promise<void>;
  /** borra la fila seed del libro de la celda y sus archivos; devuelve los bytes liberados */
  deleteBookLocal(code: string): Promise<number>;
  /** borra las filas seed del banco de la celda; devuelve los bytes liberados */
  deleteBankSeed(code: string): Promise<number>;
  /** borra un archivo del Atlas; devuelve sus bytes (0 si no estaba) */
  deleteAtlasFile(file: string): Promise<number>;
  deleteFigures(urls: string[]): Promise<number>;
  writePermitted(urls: string[]): Promise<void>;
  afterDelete(): Promise<void>;
}

async function cacheBytesAndDelete(cacheName: string, url: string): Promise<number> {
  if (typeof caches === "undefined" || !(await caches.has(cacheName))) return 0;
  const cache = await caches.open(cacheName);
  const res = await cache.match(url);
  if (!res) return 0;
  const len = res.headers.get("content-length");
  const bytes = len ? Number(len) : (await res.clone().blob()).size;
  await cache.delete(url);
  return bytes;
}

export function realDeleteDeps(): DeleteDeps {
  return {
    listRoutes: listRouteRows,
    deleteRoute: deleteRouteRow,
    async deleteBookLocal(code) {
      let freed = 0;
      const row = await getBookForModule(forgeCellId(code));
      if (row && row.source === "seed") {
        freed += row.bytes;
        await deleteBook(row.id);
      }
      return freed + (await deleteBookFiles(code));
    },
    async deleteBankSeed(code) {
      let freed = 0;
      for (const r of await getBanksForModule(forgeCellId(code))) {
        if (r.source !== "seed") continue;
        freed += r.bytes;
        await deleteBank(r.id);
      }
      return freed;
    },
    deleteAtlasFile: (file) => cacheBytesAndDelete(ATLAS_CACHE, atlasUrl(file)),
    deleteFigures: (urls) => deleteFigures(urls),
    writePermitted: (urls) => writePermittedFigures(urls),
    afterDelete: async () => {
      await pruneAtlasCache();
    },
  };
}

const emptyResult = (): DeleteResult => ({ liberadosBytes: 0, compartidosBytes: 0, figurasBorradas: 0, errores: [] });

/** Borra lo exclusivo de un alcance. `plan` (del índice) se une a lo que registró su fila, así una ruta leída antes
 *  del registro también se limpia. `todoForge` borra además todas las filas de Forge (el mundo). */
export async function deleteScope(key: string, plan: OfflinePlan | null, partial: Partial<DeleteDeps> = {}, todoForge = false): Promise<DeleteResult> {
  const deps: DeleteDeps = { ...realDeleteDeps(), ...partial };
  const out = emptyResult();
  const tryDo = async <T>(what: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      console.warn(`[offline] no se pudo borrar ${what}`, e);
      out.errores.push(`No se pudo borrar ${what}`);
      return fallback;
    }
  };
  const rows = await tryDo("el registro de descargas", () => deps.listRoutes(), [] as OfflineRouteRow[]);
  const mine = rows.filter((r) => (todoForge ? r.world === "forge" : r.key === key));
  const others = rows.filter((r) => !mine.includes(r));
  const libros = new Set([...(plan?.libros.map((l) => l.code) ?? []), ...mine.flatMap((r) => r.recursos.libros)]);
  const bancos = new Set([...(plan?.bancos ?? []), ...mine.flatMap((r) => r.recursos.libros)]);
  const atlas = new Set([...(plan?.atlas.map((a) => a.file) ?? []), ...mine.flatMap((r) => r.recursos.atlas)]);
  const figuras = new Set([...(plan?.figuras ?? []), ...mine.flatMap((r) => r.recursos.figuras)]);
  const usedLibros = new Set(others.flatMap((r) => r.recursos.libros));
  const usedAtlas = new Set(others.flatMap((r) => r.recursos.atlas));
  const usedFiguras = new Set(others.flatMap((r) => r.recursos.figuras));
  const atlasBytes = new Map((plan?.atlas ?? []).map((a) => [a.file, a.bytes]));

  for (const code of libros) {
    if (usedLibros.has(code)) {
      out.compartidosBytes += plan?.libros.find((l) => l.code === code)?.bytes ?? 0;
      continue;
    }
    out.liberadosBytes += await tryDo(`el libro ${code}`, () => deps.deleteBookLocal(code), 0);
  }
  for (const code of bancos) {
    if (usedLibros.has(code)) continue;
    out.liberadosBytes += await tryDo(`el banco ${code}`, () => deps.deleteBankSeed(code), 0);
  }
  for (const file of atlas) {
    if (usedAtlas.has(file)) {
      out.compartidosBytes += atlasBytes.get(file) ?? 0;
      continue;
    }
    out.liberadosBytes += await tryDo(`la partición ${file}`, () => deps.deleteAtlasFile(file), 0);
  }
  const exclusivas = [...figuras].filter((u) => !usedFiguras.has(u));
  if (exclusivas.length) {
    await tryDo("la lista de figuras permitidas", () => deps.writePermitted([...usedFiguras]), undefined);
    out.figurasBorradas = await tryDo("las figuras", () => deps.deleteFigures(exclusivas), 0);
  }
  for (const r of mine) await tryDo(`el registro ${r.key}`, () => deps.deleteRoute(r.key), undefined);
  await deps.afterDelete().catch((e) => console.warn("[offline] limpieza del Atlas", e));
  return out;
}

/** Borra la fila de Dexie (nunca una importación) y los archivos en caché del libro de una celda. */
export async function deleteBookLocalScope(code: string, partial: Partial<DeleteDeps> = {}): Promise<DeleteResult> {
  const deps: DeleteDeps = { ...realDeleteDeps(), ...partial };
  const out = emptyResult();
  try {
    out.liberadosBytes = await deps.deleteBookLocal(code);
  } catch (e) {
    console.warn(`[offline] no se pudo borrar el libro ${code}`, e);
    out.errores.push(`No se pudo borrar el libro ${code}`);
  }
  return out;
}
