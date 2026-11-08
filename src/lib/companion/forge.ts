// Adaptador de Forge del compañero (design §2.1 regla de capas, §9.4). ES EL ÚNICO archivo del compañero que importa
// valores de @/forge/loaders, model/*, ai, data/* y offline/* (importaciones.test.ts lo vigila). Se carga con import()
// en el chunk companion-forge. En esta tarea no lleva Atlas. NO importa src/forge/bank/check/* ni src/forge/eval/*.
// Expone lecturas sin materializar nada (nunca ensureForgeBook/ensureForgeBank, DC-26): libro de celda, banco y ruta.
import type { ReadModel } from "@/core/read-model";
import type { ForgeRouteData, ForgeCellData } from "@/forge/route-data";
import { forgeCellId, isDiagnosticCode } from "@/forge/ids";
import { getBookForModule } from "@/lib/book-store";
import { loadForgeBookMd, loadForgeRoute, forgeBankSource } from "@/forge/loaders";

/** Markdown del libro de una celda de Forge, sin materializar (§9.4): el BookRow si ya está, o loadForgeBookMd. */
export async function libroForgeMd(code: string): Promise<string | null> {
  const row = await getBookForModule(forgeCellId(code)).catch(() => null);
  if (row) return row.md;
  return loadForgeBookMd(code).catch(() => null);
}

/** Markdown del banco de una celda de Forge (chunk precacheado; funciona sin red). null si el chunk no carga. */
export async function bancoForgeMd(code: string): Promise<string | null> {
  try {
    return await forgeBankSource.load(code);
  } catch {
    return null;
  }
}

/** La celda de una ruta de Forge por su código (para hidratar su ficha, §9.4). */
export async function celdaForge(slug: string, code: string): Promise<ForgeCellData | null> {
  const ruta = await loadForgeRoute(slug);
  return ruta?.cells.find((c) => c.code === code) ?? null;
}

/** La ruta completa (para la ubicación de Forge). */
export function rutaForgeData(slug: string): Promise<ForgeRouteData | null> {
  return loadForgeRoute(slug);
}

/**
 * Regla de primer intento de un diagnóstico (§8.6, §9.5), replicada de loaders.ts:112 (hasFirstPassObservation no se
 * exporta): un documento de una celda D1-D8 sólo entra si esa celda ya tiene evidencia.
 */
export function diagnosticoVisible(code: string, readModel: ReadModel): boolean {
  if (!isDiagnosticCode(code)) return true;
  const id = forgeCellId(code);
  return readModel.evidence.some((e) => e.moduleId === id);
}

// ---- Atlas (P1, §9.3) ----
import { ATLAS_BASE, ATLAS_MANIFEST_PATH, type AtlasIndexRow, type AtlasManifest } from "@/forge/atlas/types";
import { kAtlasValida } from "./citas";

/** Tamaño de tanda al armar el índice en memoria (§9.3): 500 filas con `await` entre tandas. */
export const TANDA_ATLAS = 500;

/** Lee una URL del Atlas: primero `caches.match` (CacheFirst de arcanum-atlas-v1, sin red), si no, `fetch`. null si no
 *  está en caché y no hay red (o la API no existe en este entorno). */
async function leerAtlas(url: string): Promise<Response | null> {
  try {
    if (typeof caches !== "undefined" && typeof caches.match === "function") {
      const c = await caches.match(url);
      if (c) return c;
    }
  } catch {
    /* sin Cache API: se intenta fetch */
  }
  if (typeof fetch !== "function") return null;
  try {
    const r = await fetch(url);
    return r.ok ? r : null;
  } catch {
    return null;
  }
}

/** Una fila `AtlasIndexRow` es válida si es la tupla de 10 campos esperada y su `k` es un path seguro (sin `..`). */
export function filaAtlasValida(fila: unknown): fila is AtlasIndexRow {
  if (!Array.isArray(fila) || fila.length !== 10) return false;
  const [k, archivo, titulo, migas, tokens, encabezados, p, c, s, codigos] = fila as unknown[];
  if (typeof k !== "string" || !kAtlasValida(k)) return false;
  if (typeof archivo !== "string" || typeof titulo !== "string" || typeof tokens !== "string") return false;
  if (typeof p !== "string" || typeof c !== "string" || typeof s !== "string") return false;
  if (!Array.isArray(migas) || !Array.isArray(encabezados) || !Array.isArray(codigos)) return false;
  return true;
}

/**
 * Arma el índice del Atlas en inglés (§9.3): recorre `indices[lang="en"].files` del manifiesto, lee cada archivo con
 * `caches.match` y si no con `fetch`, valida cada fila y su `k` (una fila inválida se SALTA, nunca da enlace) y las va
 * entregando en tandas de 500 con `await` entre tandas (`alAvanzar` pinta «Cargando el Atlas»). Devuelve las filas
 * válidas; una fila con `k` que trae `..` o fuera de la lista blanca no entra, así el visor nunca arma un enlace fuera
 * de palantir.com/docs. Inyectables (`leer`, `base`) para las pruebas.
 */
export async function cargarIndiceAtlas(
  opts: { base?: string; leer?: (url: string) => Promise<Response | null>; alAvanzar?: (cargadas: number, total: number) => void; manifiesto?: AtlasManifest } = {},
): Promise<{ filas: AtlasIndexRow[]; saltadas: number }> {
  const base = opts.base ?? ATLAS_BASE;
  const leer = opts.leer ?? leerAtlas;
  const manifiesto = opts.manifiesto ?? (await (async () => {
    const r = await leer(opts.base ? `${base}/manifest.json` : ATLAS_MANIFEST_PATH);
    return r ? ((await r.json()) as AtlasManifest) : null;
  })());
  if (!manifiesto) return { filas: [], saltadas: 0 };
  const en = manifiesto.indices.find((i) => i.lang === "en");
  if (!en) return { filas: [], saltadas: 0 };

  const filas: AtlasIndexRow[] = [];
  let saltadas = 0;
  const total = en.rows || 0;
  for (const archivo of en.files) {
    const r = await leer(`${base}/${archivo}`);
    if (!r) continue;
    let datos: unknown;
    try {
      datos = await r.json();
    } catch {
      continue;
    }
    const crudas: unknown[] = Array.isArray(datos) ? datos : Array.isArray((datos as { rows?: unknown[] }).rows) ? (datos as { rows: unknown[] }).rows : [];
    for (let i = 0; i < crudas.length; i += TANDA_ATLAS) {
      for (const fila of crudas.slice(i, i + TANDA_ATLAS)) {
        if (filaAtlasValida(fila)) filas.push(fila);
        else saltadas++;
      }
      opts.alAvanzar?.(filas.length, total);
      await Promise.resolve(); // cede el hilo entre tandas (§9.3)
    }
  }
  return { filas, saltadas };
}

/** Lo que forge.ts expone al resto del compañero (pasajes.ts, ubicacion.ts), inyectado tras el import() perezoso. */
export interface AdaptadorForge {
  libroForgeMd: typeof libroForgeMd;
  bancoForgeMd: typeof bancoForgeMd;
  celdaForge: typeof celdaForge;
  rutaForgeData: typeof rutaForgeData;
  diagnosticoVisible: typeof diagnosticoVisible;
}

/** Carga el adaptador en el chunk companion-forge (§9.4). */
export const adaptadorForge: AdaptadorForge = { libroForgeMd, bancoForgeMd, celdaForge, rutaForgeData, diagnosticoVisible };
