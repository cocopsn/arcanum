// Tipos del offline de Engineering Forge (design poblar §6.4). Contrato congelado de la Fase 0: el índice de descarga
// (src/forge/data/offline-index.json, generado por scripts/forge/offline-index.mjs) y lo que reciben y devuelven las
// funciones de la fachada (src/lib/offline/api.ts). Sólo tipos.
import type { ReadModel } from "@/core/read-model";

/** 19 slugs de ruta. */
export interface OfflineIndex {
  v: 1;
  atlas_fuente: string;
  rutas: Record<string, OfflineRoute>;
}

export interface OfflineRoute {
  libros: { code: string; file: string; bytes: number }[];
  /** códigos con banco */
  bancos: string[];
  /** alguna cerca python/py/python3, o sqlite */
  python: boolean;
  /** algún ítem sql o forense */
  sqlite: boolean;
  /** relativos a /atlas/v1/, sin repetir */
  atlas: { file: string; bytes: number }[];
  /** https://www.palantir.com/docs/resources/…, sin repetir */
  figuras: string[];
  /** "<código> <url>" de citas que ninguna partición tiene; hoy vacío */
  sin_resolver: string[];
}

export type OfflineKind = "libros" | "bancos" | "atlas" | "python" | "figuras" | "app";

export interface ResourceCount {
  listos: number;
  total: number;
  /** hasta 20 ids, archivos o URLs */
  faltan: string[];
  /** medidos en el dispositivo; null si no se pueden medir (opacas) */
  bytes: number | null;
}

export interface ScopeStatus {
  libros: ResourceCount;
  bancos: ResourceCount;
  atlas: ResourceCount;
  /** null: el alcance no necesita Python */
  python: ResourceCount | null;
  /** se informa aparte; no decide «completa» */
  figuras: ResourceCount;
  /** precache; null: sin SW o SW anterior a este diseño */
  app: { listos: number; total: number } | null;
  /** libros, bancos, atlas y python completos, y app completa */
  completa: boolean;
  /** lo que falta de libros + atlas + python */
  bytesPrevistos: number;
  /** figuras que faltan × OPAQUE_PAD_BYTES */
  cuotaFiguras: number;
}

export interface DownloadOptions {
  /** ensureForgeBook lo necesita; un módulo sin React no puede leer el store (H28) */
  readModel: ReadModel;
  /** true por omisión; «Descargar sin figuras» pasa false */
  figuras?: boolean;
  /** salta el aviso de espacio */
  forzar?: boolean;
  signal?: AbortSignal;
  onProgress?(hecho: number, total: number, tipo: OfflineKind): void;
}

export type DownloadResult =
  | { ok: true; estado: ScopeStatus; fallidos: { tipo: OfflineKind; id: string; motivo: string }[] }
  | {
      ok: false;
      motivo: "sin-red" | "sin-espacio" | "no-disponible";
      detalle: string;
      espacio?: { libreBytes: number; previstoBytes: number; cuotaFigurasBytes: number; figuras: number };
    };

export interface DeleteResult {
  liberadosBytes: number;
  compartidosBytes: number;
  figurasBorradas: number;
  errores: string[];
}

export interface StorageReport {
  persistente: boolean | null;
  usoBytes: number | null;
  cuotaBytes: number | null;
  iosSinInstalar: boolean;
}
