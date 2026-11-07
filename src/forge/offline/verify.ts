// Estado de una ruta o del mundo, verificado contra el almacenamiento (design poblar §6.4 «Estado», §5.3). Nada aquí
// lee una bandera: libros con bookAvailability (Dexie + Cache Storage), bancos con su fila de Dexie o el precache,
// Atlas con caches.match, Python con pyodideStatus, figuras con isFigureCached y la app con el SW.
import { ATLAS_CACHE } from "@/app/sw-rules";
import { forgeCellId } from "@/forge/ids";
import { sha10 } from "@/forge/loaders";
import { getBookForModule } from "@/lib/book-store";
import { getBanksForModule } from "@/lib/exercise-store";
import { forgeBookCacheFiles } from "@/lib/offline/books-cache";
import { isFigureCached } from "@/lib/offline/figures";
import { pythonStatus } from "@/lib/offline/python";
import { bookAvailability, OPAQUE_PAD_BYTES } from "@/lib/offline/rules";
import { precacheStatus } from "@/lib/offline/sw-client";
import type { ResourceCount, ScopeStatus } from "@/lib/offline/types";
import { PYODIDE_FILES, pyodideFilesFor, type PyodideFile } from "@/lib/pyodide-files";
import type { OfflinePlan } from "./plan";

export const ATLAS_MANIFEST_URL = "/atlas/v1/manifest.json";
export const atlasUrl = (file: string) => `/atlas/v1/${file}`;
const MAX_FALTAN = 20;

export interface VerifyDeps {
  /** la fila de arcanum-books del libro de la celda, con el sha10 de su md; null sin fila */
  bookRow(code: string): Promise<{ source: "seed" | "import"; sha10: string } | null>;
  bookCacheFiles(): Promise<ReadonlySet<string> | null>;
  /** una fila de banco importada, o sembrada con el md vigente (sha10 del índice) */
  bankRow(code: string): Promise<boolean>;
  atlasCached(url: string): Promise<boolean>;
  python(o: { sqlite: boolean }): Promise<ResourceCount | null>;
  figureCached(url: string): Promise<boolean | null>;
  precache(): Promise<{ listos: number; total: number } | null>;
}

let bankIdx: Promise<Record<string, { sha10?: string }>> | null = null;
function bankIndex(): Promise<Record<string, { sha10?: string }>> {
  bankIdx ??= import("@/forge/data/bank-index.json")
    .then((m) => ((m as { default?: unknown }).default ?? m) as Record<string, { sha10?: string }>)
    .catch(() => {
      bankIdx = null;
      return {};
    });
  return bankIdx;
}

/** Las dependencias reales: Dexie, Cache Storage y el SW. */
export function realVerifyDeps(): VerifyDeps {
  return {
    async bookRow(code) {
      const row = await getBookForModule(forgeCellId(code)).catch(() => null);
      return row ? { source: row.source, sha10: await sha10(row.md) } : null;
    },
    bookCacheFiles: forgeBookCacheFiles,
    async bankRow(code) {
      const rows = await getBanksForModule(forgeCellId(code)).catch(() => []);
      if (rows.some((r) => r.source === "import")) return true;
      const want = (await bankIndex())[code]?.sha10;
      for (const r of rows) if (r.source === "seed" && want && (await sha10(r.md)) === want) return true;
      return false;
    },
    async atlasCached(url) {
      if (typeof caches === "undefined") return false;
      try {
        return Boolean(await caches.match(url, { cacheName: ATLAS_CACHE }));
      } catch {
        return false;
      }
    },
    python: pythonStatus,
    figureCached: isFigureCached,
    precache: () => precacheStatus(),
  };
}

const count = (ids: string[], ready: boolean[], bytesOf: ((i: number) => number) | null): ResourceCount => ({
  listos: ready.filter(Boolean).length,
  total: ids.length,
  faltan: ids.filter((_, i) => !ready[i]).slice(0, MAX_FALTAN),
  bytes: bytesOf ? ready.reduce((n, r, i) => n + (r ? bytesOf(i) : 0), 0) : null,
});
const complete = (c: ResourceCount | null) => c === null || c.listos === c.total;

/** El estado de un plan, recalculado desde el almacenamiento. */
export async function scopeStatus(plan: OfflinePlan, deps: VerifyDeps = realVerifyDeps()): Promise<ScopeStatus> {
  const cacheFiles = await deps.bookCacheFiles();
  const librosReady = await Promise.all(
    plan.libros.map(async (l) => {
      const current = { file: l.file, sha10: l.file.slice(-13, -3) };
      return bookAvailability({ row: await deps.bookRow(l.code), current, cacheFiles }).disponible === "si";
    }),
  );
  const libros = count(plan.libros.map((l) => l.code), librosReady, (i) => plan.libros[i]!.bytes);

  const app = await deps.precache();
  const appComplete = app !== null && app.listos === app.total;
  // with the whole precache, a bank's chunk is on the device and ensureForgeBank ingests it offline
  const bancosReady = await Promise.all(plan.bancos.map(async (c) => appComplete || (await deps.bankRow(c))));
  const bancos = count(plan.bancos, bancosReady, null);

  const atlasUrls = plan.atlas.length ? [ATLAS_MANIFEST_URL, ...plan.atlas.map((a) => atlasUrl(a.file))] : [];
  const atlasReady = await Promise.all(atlasUrls.map((u) => deps.atlasCached(u)));
  const atlasBytes = (i: number) => (i === 0 ? 0 : plan.atlas[i - 1]!.bytes);
  const atlas = count(atlasUrls, atlasReady, atlasBytes);

  let python: ResourceCount | null = null;
  if (plan.python) {
    const files = pyodideFilesFor(plan.sqlite);
    python = (await deps.python({ sqlite: plan.sqlite })) ?? { listos: 0, total: files.length, faltan: [...files], bytes: 0 };
  }

  const figReady = await Promise.all(plan.figuras.map(async (u) => (await deps.figureCached(u)) === true));
  const figuras = count(plan.figuras, figReady, null);

  const missingBytes =
    plan.libros.reduce((n, l, i) => n + (librosReady[i] ? 0 : l.bytes), 0) +
    atlasUrls.reduce((n, _, i) => n + (atlasReady[i] ? 0 : atlasBytes(i)), 0) +
    (python?.faltan ?? []).reduce((n, f) => n + (PYODIDE_FILES[f as PyodideFile]?.bytes ?? 0), 0);
  const figurasFaltan = figReady.filter((r) => !r).length;

  return {
    libros,
    bancos,
    atlas,
    python,
    figuras,
    app,
    completa: complete(libros) && complete(bancos) && complete(atlas) && complete(python) && appComplete,
    bytesPrevistos: missingBytes,
    cuotaFiguras: figurasFaltan * OPAQUE_PAD_BYTES,
  };
}

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

/** Texto de un alcance que no quedó completo (§6.4): «7 de 8 libros listos sin red; 1 falló: Reintentar», una frase
 *  por tipo que falta, unidas con « · ». null si está completo. */
export function partialText(s: ScopeStatus): string | null {
  if (s.completa) return null;
  const parts: string[] = [];
  const add = (c: ResourceCount | null, nombre: string, listos: "listos" | "listas") => {
    if (!c || c.listos >= c.total) return;
    const f = c.total - c.listos;
    parts.push(`${c.listos} de ${c.total} ${nombre} ${listos} sin red; ${f} ${plural(f, "falló", "fallaron")}: Reintentar`);
  };
  add(s.libros, "libros", "listos");
  add(s.bancos, "bancos", "listos");
  add(s.atlas, "archivos del Atlas", "listos");
  add(s.python, "archivos de Python", "listos");
  if (!s.app) parts.push("La app aún no está instalada para usarse sin red: ábrela una vez con conexión");
  else add({ ...s.app, faltan: [], bytes: null }, "partes de la app", "listas");
  return parts.join(" · ");
}
