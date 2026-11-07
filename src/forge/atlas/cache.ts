// Limpieza por versión de arcanum-atlas-v1 (design poblar §6.6; §6.5 de Forge). Con otra captura (`fuente_sha10`),
// borra de la caché todo archivo que el manifiesto nuevo ya no nombra, salvo los fijos. Se llama al terminar una
// descarga, al borrar y al abrir el panel offline; el AtlasPanel no la llama. Si `caches` lanza no borra nada y lo
// intenta la vez siguiente.
import { ATLAS_CACHE } from "@/app/sw-rules";
import { ATLAS_BASE, ATLAS_FIXED_PATHS, ATLAS_MANIFEST_PATH } from "./types";

export const ATLAS_FUENTE_KEY = "arcanum_atlas_fuente";

export interface AtlasManifestFiles {
  fuente_sha10: string;
  particiones?: { files?: string[] }[];
  indices?: { files?: string[] }[];
  alias?: string;
  capas?: Record<string, { archivo?: string } | unknown>;
}

/** Las rutas (`/atlas/v1/…`) que nombra un manifiesto, más los archivos fijos. */
export function atlasKeepPaths(m: AtlasManifestFiles): Set<string> {
  const keep = new Set<string>(ATLAS_FIXED_PATHS);
  const add = (f: unknown) => typeof f === "string" && f && keep.add(`${ATLAS_BASE}/${f}`);
  for (const p of m.particiones ?? []) for (const f of p.files ?? []) add(f);
  for (const p of m.indices ?? []) for (const f of p.files ?? []) add(f);
  add(m.alias);
  for (const c of Object.values(m.capas ?? {})) add((c as { archivo?: unknown } | null)?.archivo);
  return keep;
}

async function cachedManifest(cache: Cache): Promise<AtlasManifestFiles | null> {
  const r = await cache.match(ATLAS_MANIFEST_PATH);
  if (!r) return null;
  const j = (await r.json()) as AtlasManifestFiles;
  return typeof j?.fuente_sha10 === "string" ? j : null;
}

/** Devuelve cuántas entradas borró. Sin manifiesto (ni el dado ni el guardado) no borra nada. */
export async function pruneAtlasCache(manifest?: AtlasManifestFiles): Promise<number> {
  if (typeof caches === "undefined") return 0;
  try {
    if (!(await caches.has(ATLAS_CACHE))) return 0;
    const cache = await caches.open(ATLAS_CACHE);
    const m = manifest ?? (await cachedManifest(cache));
    if (!m) return 0;
    if (localStorage.getItem(ATLAS_FUENTE_KEY) === m.fuente_sha10) return 0;
    const keep = atlasKeepPaths(m);
    let n = 0;
    for (const req of await cache.keys()) {
      if (keep.has(new URL(req.url, "https://x.invalid").pathname)) continue;
      await cache.delete(req);
      n++;
    }
    localStorage.setItem(ATLAS_FUENTE_KEY, m.fuente_sha10);
    return n;
  } catch (e) {
    console.warn("[atlas] no se pudo limpiar arcanum-atlas-v1; se intenta la próxima vez", e);
    return 0;
  }
}
