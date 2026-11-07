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
