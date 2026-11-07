// Descargar una ruta o el mundo (design poblar §6.4 «Descarga», §6.11; anexo r2 [17]), en este orden fijo: red,
// persist(), plan, espacio, registro de propiedad, libros, bancos, Atlas, Python, figuras y el estado recalculado.
import type { ReadModel } from "@/core/read-model";
import { ensureForgeBank, ensureForgeBook, type EnsureBankResult, type EnsureResult } from "@/forge/loaders";
import { pruneAtlasCache } from "@/forge/atlas/cache";
import { listRouteRows, saveRouteRow, type OfflineRouteRow } from "@/lib/offline-store";
import { deleteFigures, loadImage, warmFigureUrl, writePermittedFigures, type FigureLoad } from "@/lib/offline/figures";
import { warmPython } from "@/lib/offline/python";
import { estimateWarning, previstoBytes } from "@/lib/offline/rules";
import type { DownloadOptions, DownloadResult, OfflineKind, ScopeStatus } from "@/lib/offline/types";
import { requestPersist } from "@/lib/storage";
import type { OfflinePlan } from "./plan";
import { ATLAS_MANIFEST_URL, atlasUrl, scopeStatus } from "./verify";

export interface RunDeps {
  online(): boolean;
  requestPersist(): Promise<boolean>;
  /** bytes libres según estimate() (cuota − uso); null si el navegador no lo informa */
  freeBytes(): Promise<number | null>;
  status(plan: OfflinePlan): Promise<ScopeStatus>;
  saveRoute(row: OfflineRouteRow): Promise<void>;
  listRoutes(): Promise<OfflineRouteRow[]>;
  ensureBook(code: string, readModel: ReadModel): Promise<EnsureResult>;
  ensureBank(code: string): Promise<EnsureBankResult>;
  /** pide un archivo del Atlas; las reglas 4 y 5 del SW lo guardan */
  fetchOk(url: string): Promise<boolean>;
  warmPython(o: { sqlite: boolean }): Promise<{ ok: true } | { ok: false; motivo: string }>;
  writePermitted(urls: string[]): Promise<void>;
  loadImage(src: string, ms: number): Promise<FigureLoad>;
  /** borra la entrada canónica de una figura de arcanum-forge-figuras-v1 (la página es la única que ve que no pintó) */
  forgetFigure(url: string): Promise<void>;
  nonce(): string;
  afterAtlas(): Promise<void>;
  now(): number;
}

export function realRunDeps(): RunDeps {
  return {
    online: () => typeof navigator === "undefined" || navigator.onLine !== false,
    requestPersist,
    async freeBytes() {
      try {
        const e = await navigator.storage?.estimate?.();
        return e && typeof e.quota === "number" && typeof e.usage === "number" ? Math.max(0, e.quota - e.usage) : null;
      } catch {
        return null;
      }
    },
    status: (plan) => scopeStatus(plan),
    saveRoute: saveRouteRow,
    listRoutes: listRouteRows,
    ensureBook: ensureForgeBook,
    ensureBank: ensureForgeBank,
    async fetchOk(url) {
      const r = await fetch(url);
      return r.ok;
    },
    warmPython,
    writePermitted: writePermittedFigures,
    loadImage,
    async forgetFigure(url) {
      await deleteFigures([url]);
    },
    nonce: () => Date.now().toString(36),
    afterAtlas: async () => {
      await pruneAtlasCache();
    },
    now: () => Date.now(),
  };
}

/** Motivos de una figura que no pintó: el navegador no pudo pintarla, o vencieron los 10 s. */
export const FIGURE_ERROR = "la figura respondió con un error";
export const FIGURE_TIMEOUT = "no cargó en 10 s";

const MB = (b: number) => Math.max(1, Math.round(b / 1e6)).toLocaleString("en-US");

/** El texto del aviso de espacio (§6.4 paso 4). */
export function spaceText(libre: number, previsto: number, figuras: number, cuotaFiguras: number): string {
  const base = `Espacio libre ≈ ${MB(libre)} MB; esta descarga ocupa ≈ ${MB(previsto - cuotaFiguras)} MB`;
  if (!figuras) return `${base}.`;
  return `${base}, y las ${figuras} figuras de palantir.com cuentan ≈ ${MB(cuotaFiguras)} MB más de cuota en este navegador.`;
}

const isQuota = (e: unknown) => e instanceof Error && (e.name === "QuotaExceededError" || /quota/i.test(e.message));

/** Corre `fn` sobre `items` con `n` a la vez; para si `stop()` se vuelve verdadero. */
async function pool<T>(items: T[], n: number, stop: () => boolean, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  const worker = async () => {
    while (i < items.length && !stop()) await fn(items[i++]!);
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}

/** Descarga un plan. Nunca escribe en el log; la fila de `routes` es caché del dispositivo. */
export async function runDownload(plan: OfflinePlan, o: DownloadOptions, partial: Partial<RunDeps> = {}): Promise<DownloadResult> {
  const deps: RunDeps = { ...realRunDeps(), ...partial };
  const cancelado = (): DownloadResult => ({ ok: false, motivo: "cancelado", detalle: "Descarga cancelada: lo ya guardado se conserva" });
  // 1
  if (!deps.online()) return { ok: false, motivo: "sin-red", detalle: "La descarga necesita conexión" };
  // 2 · the tap on «Descargar» is the gesture iOS and Chrome ask for
  await deps.requestPersist().catch(() => false);
  // 4 · space, with the current state
  const conFiguras = o.figuras !== false;
  const antes = await deps.status(plan);
  const previsto = previstoBytes(antes, conFiguras);
  const libre = await deps.freeBytes();
  if (!o.forzar && estimateWarning(libre, previsto)) {
    const figuras = conFiguras ? antes.figuras.total - antes.figuras.listos : 0;
    const cuota = conFiguras ? antes.cuotaFiguras : 0;
    return {
      ok: false,
      motivo: "sin-espacio",
      detalle: spaceText(libre ?? 0, previsto, figuras, cuota),
      espacio: { libreBytes: libre ?? 0, previstoBytes: previsto, cuotaFigurasBytes: cuota, figuras },
    };
  }
  if (o.signal?.aborted) return cancelado();
  // 5 · ownership BEFORE downloading anything
  const slug = plan.key.slice("forge:".length);
  await deps.saveRoute({
    key: plan.key,
    world: "forge",
    slug,
    ts: deps.now(),
    recursos: { libros: plan.libros.map((l) => l.code), atlas: plan.atlas.map((a) => a.file), figuras: conFiguras ? [...plan.figuras] : [] },
  });

  const atlasUrls = plan.atlas.length ? [ATLAS_MANIFEST_URL, ...plan.atlas.map((a) => atlasUrl(a.file))] : [];
  const total = plan.libros.length + plan.bancos.length + atlasUrls.length + (plan.python ? 1 : 0) + (conFiguras ? plan.figuras.length : 0);
  let hecho = 0;
  const fallidos: { tipo: OfflineKind; id: string; motivo: string }[] = [];
  let sinEspacio = false;
  const stop = () => sinEspacio || Boolean(o.signal?.aborted);
  const tick = (tipo: OfflineKind) => o.onProgress?.(++hecho, total, tipo);
  const fail = (tipo: OfflineKind, id: string, e: unknown, motivo?: string) => {
    if (isQuota(e)) sinEspacio = true;
    const m = isQuota(e) ? "sin espacio" : (motivo ?? (e instanceof Error ? e.message : String(e)));
    fallidos.push({ tipo, id, motivo: m });
    console.warn(`[offline] ${tipo} ${id}: ${m}`);
  };

  // 6 · books, two at a time
  await pool(plan.libros, 2, stop, async (l) => {
    try {
      const r = await deps.ensureBook(l.code, o.readModel);
      if (!r.ok) fail("libros", l.code, null, r.reason);
    } catch (e) {
      fail("libros", l.code, e);
    }
    tick("libros");
  });
  // 7 · banks (the chunk is precached; this leaves the validated row for the first opening)
  await pool(plan.bancos, 2, stop, async (c) => {
    try {
      const r = await deps.ensureBank(c);
      if (!r.ok) fail("bancos", c, null, r.reason);
    } catch (e) {
      fail("bancos", c, e);
    }
    tick("bancos");
  });
  // 8 · Atlas: the manifest and each file (rules 4 and 5 of the SW store them)
  await pool(atlasUrls, 2, stop, async (u) => {
    try {
      if (!(await deps.fetchOk(u))) fail("atlas", u, null, "no respondió 200");
    } catch (e) {
      fail("atlas", u, e);
    }
    tick("atlas");
  });
  if (atlasUrls.length && !stop()) await deps.afterAtlas().catch((e) => console.warn("[offline] limpieza del Atlas", e));
  // 9 · Python
  if (plan.python && !stop()) {
    const r = await deps.warmPython({ sqlite: plan.sqlite }).catch((e: unknown) => ({ ok: false as const, motivo: String(e) }));
    if (!r.ok) fail("python", "pyodide", null, r.motivo);
    tick("python");
  }
  // 10 · figures: the allowlist first (the union of every registered route), then each one as an image with a
  // per-run nonce, so neither the document's image list nor the memory cache serves it without the SW
  if (conFiguras && plan.figuras.length && !stop()) {
    try {
      const rows = await deps.listRoutes();
      await deps.writePermitted([...new Set(rows.flatMap((r) => r.recursos.figuras))]);
    } catch (e) {
      fail("figuras", "lista de permitidas", e);
    }
    const nonce = deps.nonce();
    await pool(plan.figuras, 2, stop, async (u) => {
      const r = await deps.loadImage(warmFigureUrl(u, nonce), 10_000);
      if (r !== "ok") {
        // the response is opaque, so the SW stored an error (404, 503) like a figure and serves it first, even online:
        // forget it, so the state says it is missing and «Reintentar» goes back to the network (review of offline-motor, MEDIUM 1)
        await deps.forgetFigure(u).catch((e: unknown) => console.warn("[offline] no se pudo olvidar la figura", e));
        fail("figuras", u, null, r === "tiempo" ? FIGURE_TIMEOUT : FIGURE_ERROR);
      }
      tick("figuras");
    });
  }
  if (o.signal?.aborted) return cancelado();
  // 11 · the state recomputed from storage, plus what failed
  return { ok: true, estado: await deps.status(plan), fallidos };
}
