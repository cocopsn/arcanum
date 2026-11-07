// offline-index.json (generado por scripts/forge/offline-index.mjs) en su propio chunk perezoso, memoizado. Un chunk
// que no carga da el índice vacío y se reintenta en la siguiente llamada.
import type { OfflineIndex } from "@/lib/offline/types";

const EMPTY: OfflineIndex = { v: 1, atlas_fuente: "", rutas: {} };
let p: Promise<OfflineIndex> | null = null;

export function loadOfflineIndex(): Promise<OfflineIndex> {
  p ??= import("@/forge/data/offline-index.json")
    .then((m) => ((m as { default?: unknown }).default ?? m) as OfflineIndex)
    .catch(() => {
      p = null;
      return EMPTY;
    });
  return p;
}
