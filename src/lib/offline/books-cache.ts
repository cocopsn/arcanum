// Libros de Forge en arcanum-forge-books-v1 (design poblar §5.3, §6.4, §6.9). Lo escribe la regla 3 del SW al pedir
// `/forge/books/v1/<código>.<sha10>.md`; aquí se lee y se limpia. Sin Cache API todo devuelve null o 0.
import { BOOKS_CACHE } from "@/app/sw-rules";

const BOOK_FILE = /^([a-z0-9-]+)\.[0-9a-f]{10}\.md$/;

/** El nombre de archivo (`<código>.<sha10>.md`) de una URL o ruta de libro; null si no es un libro. */
export function bookFileOf(url: string): string | null {
  let p: string;
  try {
    p = new URL(url, "https://x.invalid").pathname;
  } catch {
    return null;
  }
  if (!p.startsWith("/forge/books/v1/")) return null;
  const name = p.slice("/forge/books/v1/".length);
  return BOOK_FILE.test(name) ? name : null;
}

async function openIfExists(): Promise<Cache | null> {
  if (typeof caches === "undefined") return null;
  if (!(await caches.has(BOOKS_CACHE))) return null;
  return caches.open(BOOKS_CACHE);
}

/** NOMBRES de archivo presentes en arcanum-forge-books-v1 (anexo r2 [15]: no URLs); null sin Cache API o si falla. */
export async function forgeBookCacheFiles(): Promise<Set<string> | null> {
  if (typeof caches === "undefined") return null;
  try {
    const cache = await openIfExists();
    const out = new Set<string>();
    if (!cache) return out;
    for (const req of await cache.keys()) {
      const f = bookFileOf(req.url);
      if (f) out.add(f);
    }
    return out;
  } catch {
    return null;
  }
}

async function sizeOf(cache: Cache, req: Request): Promise<number> {
  const res = await cache.match(req);
  if (!res) return 0;
  const len = res.headers.get("content-length");
  return len ? Number(len) : (await res.clone().blob()).size;
}

/** Borra los archivos de un código; con `keep`, todos menos ése (versiones viejas). Devuelve los bytes liberados. */
export async function deleteBookFiles(code: string, keep?: string): Promise<number> {
  const cache = await openIfExists();
  if (!cache) return 0;
  const prefix = `${code.toLowerCase()}.`;
  let freed = 0;
  for (const req of await cache.keys()) {
    const f = bookFileOf(req.url);
    if (!f || !f.startsWith(prefix) || f === keep) continue;
    if (BOOK_FILE.exec(f)?.[1] !== code.toLowerCase()) continue;
    freed += await sizeOf(cache, req);
    await cache.delete(req);
  }
  return freed;
}

/** Tras refrescar un libro, deja en la caché sólo su archivo vigente (§6.9). Nunca lanza. */
export async function pruneBookVersions(code: string, keepFile: string): Promise<number> {
  try {
    return await deleteBookFiles(code, keepFile);
  } catch (e) {
    console.warn(`[offline] no se pudieron limpiar versiones viejas de ${code}`, e);
    return 0;
  }
}
