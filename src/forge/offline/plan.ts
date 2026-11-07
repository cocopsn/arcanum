// Plan de descarga (design poblar §6.4 paso 3), puro: la entrada de offline-index.json para una ruta, o la unión de
// las 19 rutas sin repetir archivos para el mundo.
import type { OfflineIndex, OfflineRoute } from "@/lib/offline/types";

export interface OfflinePlan {
  /** "forge:<slug>" o "forge:mundo" */
  key: string;
  libros: OfflineRoute["libros"];
  bancos: string[];
  python: boolean;
  sqlite: boolean;
  atlas: OfflineRoute["atlas"];
  figuras: string[];
}

export const WORLD_KEY = "forge:mundo";
export const routeKey = (slug: string) => `forge:${slug}`;

/** El plan de una ruta; null si el slug no está en el índice. */
export function routePlan(index: OfflineIndex, slug: string): OfflinePlan | null {
  if (!Object.prototype.hasOwnProperty.call(index.rutas, slug)) return null;
  const r = index.rutas[slug]!;
  return { key: routeKey(slug), libros: [...r.libros], bancos: [...r.bancos], python: r.python, sqlite: r.sqlite, atlas: [...r.atlas], figuras: [...r.figuras] };
}

/** El plan del mundo: la unión de todas las rutas, cada libro, banco, partición y figura una sola vez. */
export function worldPlan(index: OfflineIndex): OfflinePlan {
  const libros = new Map<string, OfflineRoute["libros"][number]>();
  const bancos = new Set<string>();
  const atlas = new Map<string, OfflineRoute["atlas"][number]>();
  const figuras = new Set<string>();
  let python = false;
  let sqlite = false;
  for (const r of Object.values(index.rutas)) {
    for (const l of r.libros) if (!libros.has(l.code)) libros.set(l.code, l);
    for (const b of r.bancos) bancos.add(b);
    for (const a of r.atlas) if (!atlas.has(a.file)) atlas.set(a.file, a);
    for (const f of r.figuras) figuras.add(f);
    python ||= r.python;
    sqlite ||= r.sqlite;
  }
  return { key: WORLD_KEY, libros: [...libros.values()], bancos: [...bancos], python, sqlite, atlas: [...atlas.values()], figuras: [...figuras] };
}
