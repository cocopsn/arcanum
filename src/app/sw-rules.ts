// Reglas puras del service worker (design poblar §6.2, §6.5, §6.9). sw.ts sólo las conecta con Serwist; aquí no se
// importa Serwist, así vitest las prueba con cachés y fetch falsos (dependencias inyectadas).
// relativo, no `@/`: el SW se compila aparte del resto de la app
import { PYODIDE_BASE, PYODIDE_CACHE } from "../lib/pyodide-files";

export const SHELL_CACHE = "arcanum-shell";
export const BOOKS_CACHE = "arcanum-forge-books-v1";
export const ATLAS_CACHE = "arcanum-atlas-v1";
export const FIGURES_CACHE = "arcanum-forge-figuras-v1";
export { PYODIDE_CACHE };

/** Lo único que el SW contesta por mensaje: cuántas entradas de su precache están guardadas. */
export const PRECACHE_STATUS_MSG = "ARCANUM_PRECACHE_STATUS";

export interface MatchArgs {
  url: URL;
  request: Request;
  sameOrigin: boolean;
}

const FIGURE_ORIGIN = "https://www.palantir.com";
const FIGURE_PATH = "/docs/resources/";
const BOOK_PATH = /^\/forge\/books\/v1\/[a-z0-9-]+\.[0-9a-f]{10}\.md$/;
const ATLAS_HASHED = /^\/atlas\/v1\/.+\.[0-9a-f]{10}\.json$/;
const ATLAS_VIDEOS = new Set(["/atlas/v1/videos/oembed.json", "/atlas/v1/videos/canales.json"]);

/** 1 · `/api/` del mismo origen: NetworkOnly (sesión, login, progreso). */
export const isApi = ({ url, sameOrigin }: MatchArgs) => sameOrigin && url.pathname.startsWith("/api/");
/** 2 · Pyodide en jsDelivr: NetworkOnly. El worker guarda sus seis archivos él mismo (§6.3): un solo escritor. */
export const isPyodide = ({ url }: MatchArgs) => url.href.startsWith("https://cdn.jsdelivr.net/pyodide/");
/** 3 · Un libro de Forge publicado: el nombre lleva su sha10, así que el archivo es inmutable (CacheFirst). */
export const isForgeBook = ({ url, sameOrigin }: MatchArgs) => sameOrigin && BOOK_PATH.test(url.pathname);
/** 4 · Particiones, índices y archivos del Atlas con sha10 (CacheFirst). */
export const isAtlasHashed = ({ url, sameOrigin }: MatchArgs) => sameOrigin && ATLAS_HASHED.test(url.pathname);
/** 5 · El manifiesto del Atlas: cambia con cada captura (NetworkFirst). */
export const isAtlasManifest = ({ url, sameOrigin }: MatchArgs) => sameOrigin && url.pathname === "/atlas/v1/manifest.json";
/** 6 · Los archivos de video del Atlas sin sha10 (NetworkFirst con expiración de 30 días). */
export const isAtlasVideos = ({ url, sameOrigin }: MatchArgs) => sameOrigin && ATLAS_VIDEOS.has(url.pathname);
/** 8 · El manifiesto de la app: desde arcanum-shell sin red (NetworkFirst). */
export const isWebManifest = ({ url, sameOrigin }: MatchArgs) => sameOrigin && url.pathname === "/manifest.webmanifest";
/** 9 · Navegaciones de documento (el shell). */
export const isNavigation = ({ request }: MatchArgs) => request.mode === "navigate";

// ── figuras de palantir.com (§6.5) ─────────────────────────────────────────────────────────────────────────────
/** Clave sintética de la lista de figuras permitidas, en la misma caché; nunca va a la red. */
export const FIGURES_PERMIT_KEY = "/__arcanum/figuras-permitidas.json";
/** Parámetro con el que la descarga calienta una figura sin chocar con la caché de imágenes del documento. */
export const FIGURE_WARM_PARAM = "arcanum_fig";
const WARM_SEARCH = new RegExp(`^\\?${FIGURE_WARM_PARAM}=[0-9a-z]{1,16}$`);
const MAX_PERMITTED = 500;

/** 7 · Una imagen de https://www.palantir.com/docs/resources/… sin consulta o con exactamente `?arcanum_fig=<nonce>`. */
export function isFigureRequest({ url, request }: MatchArgs): boolean {
  return (
    request.destination === "image" &&
    url.origin === FIGURE_ORIGIN &&
    url.pathname.startsWith(FIGURE_PATH) &&
    (url.search === "" || WARM_SEARCH.test(url.search))
  );
}

/** La URL canónica (la del libro): quita sólo el parámetro de calentamiento. */
export function figureKey(url: string): string {
  const u = new URL(url);
  u.searchParams.delete(FIGURE_WARM_PARAM);
  return u.href;
}

/** Una URL que puede entrar a la lista de permitidas: https://www.palantir.com/docs/resources/…, sin consulta. */
export function isPermittableFigure(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.origin === FIGURE_ORIGIN && u.pathname.startsWith(FIGURE_PATH) && u.search === "" && u.hash === "" && u.href === url;
  } catch {
    return false;
  }
}

/** Lee la lista `{ v: 1, urls }`. JSON inválido, ausente, de otra versión o con más de 500 URLs → nada permitido. */
export async function readPermitted(cache: Cache): Promise<Set<string>> {
  try {
    const r = await cache.match(FIGURES_PERMIT_KEY);
    if (!r) return new Set();
    const j = (await r.json()) as { v?: unknown; urls?: unknown };
    if (j?.v !== 1 || !Array.isArray(j.urls) || j.urls.length > MAX_PERMITTED) return new Set();
    return new Set(j.urls.filter(isPermittableFigure));
  } catch {
    return new Set();
  }
}

/** La respuesta que se guarda como lista de permitidas (la escribe la página, §6.4 paso 10). */
export function permitResponse(urls: Iterable<string>): Response {
  const list = [...new Set([...urls].filter(isPermittableFigure))].slice(0, MAX_PERMITTED);
  return new Response(JSON.stringify({ v: 1, urls: list }), { headers: { "content-type": "application/json" } });
}

/** Manejador de la regla 7. Sirve la copia guardada bajo la URL canónica; si no hay, reenvía la petición (destino
 *  image → img-src, H9) y la guarda sólo si la figura está permitida. Un `put` que falla (cuota) no quita la figura. */
export function makeFigureHandler(deps: { caches: CacheStorage; fetch: (r: Request) => Promise<Response> }) {
  return async ({ request }: { request: Request }): Promise<Response> => {
    const key = figureKey(request.url);
    const cache = await deps.caches.open(FIGURES_CACHE);
    const hit = await cache.match(key, { ignoreVary: true });
    if (hit) return hit;
    const res = await deps.fetch(request);
    if ((res.type === "opaque" || res.ok) && (await readPermitted(cache)).has(key)) {
      try {
        await cache.put(key, res.clone());
      } catch {
        /* cuota llena: isFigureCached lo reporta */
      }
    }
    return res;
  };
}

// ── ciclo de vida (§6.2, §6.9) ──────────────────────────────────────────────────────────────────────────────────
/** Borra de arcanum-pyodide toda entrada que no sea de la versión vigente; devuelve cuántas borró. Sin la caché, 0. */
export async function prunePyodide(storage: CacheStorage, base: string = PYODIDE_BASE): Promise<number> {
  if (!(await storage.has(PYODIDE_CACHE))) return 0;
  const cache = await storage.open(PYODIDE_CACHE);
  let n = 0;
  for (const req of await cache.keys()) {
    if (!req.url.startsWith(base)) {
      await cache.delete(req);
      n++;
    }
  }
  return n;
}

/** `total` = entradas del manifiesto de precache; `listos` = las que están en la caché del precache. */
export async function precacheCounts(urlsToKeys: Map<string, string>, cache: Pick<Cache, "match">): Promise<{ listos: number; total: number }> {
  let listos = 0;
  for (const key of urlsToKeys.values()) if (await cache.match(key)) listos++;
  return { listos, total: urlsToKeys.size };
}
