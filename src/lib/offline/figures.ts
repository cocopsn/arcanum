// Figuras de palantir.com en arcanum-forge-figuras-v1 (design poblar §6.5). La página escribe la lista de permitidas
// y dispara la carga con new Image(); el SW (regla 7) decide si guarda, siempre bajo la URL canónica.
import { FIGURE_WARM_PARAM, FIGURES_CACHE, FIGURES_PERMIT_KEY, figureKey, permitResponse, readPermitted } from "@/app/sw-rules";

/** Si la figura (por su URL canónica) está guardada; null sin Cache API o si falla. */
export async function isFigureCached(url: string): Promise<boolean | null> {
  if (typeof caches === "undefined") return null;
  try {
    if (!(await caches.has(FIGURES_CACHE))) return false;
    const cache = await caches.open(FIGURES_CACHE);
    return Boolean(await cache.match(figureKey(url), { ignoreVary: true }));
  } catch {
    return null;
  }
}

/** Reescribe la lista de permitidas con estas URLs (la unión de las rutas registradas). */
export async function writePermittedFigures(urls: Iterable<string>): Promise<void> {
  const cache = await caches.open(FIGURES_CACHE);
  await cache.put(FIGURES_PERMIT_KEY, permitResponse(urls));
}

/** Las URLs permitidas hoy (vacío sin caché). */
export async function permittedFigures(): Promise<Set<string>> {
  if (typeof caches === "undefined" || !(await caches.has(FIGURES_CACHE))) return new Set();
  return readPermitted(await caches.open(FIGURES_CACHE));
}

/** Borra estas figuras de la caché; devuelve cuántas había. */
export async function deleteFigures(urls: Iterable<string>): Promise<number> {
  if (typeof caches === "undefined" || !(await caches.has(FIGURES_CACHE))) return 0;
  const cache = await caches.open(FIGURES_CACHE);
  let n = 0;
  for (const u of urls) if (await cache.delete(figureKey(u))) n++;
  return n;
}

/** La URL con la que la descarga calienta una figura: distinta de la del libro, para que ni la lista de imágenes del
 *  documento ni la caché de memoria la sirvan sin pasar por el SW; el nonce cambia en cada corrida. */
export function warmFigureUrl(url: string, nonce: string): string {
  const u = new URL(url);
  u.searchParams.set(FIGURE_WARM_PARAM, nonce);
  return u.href;
}

/** Cómo terminó la carga de una figura: pintó, el navegador no pudo pintarla (`onerror`: un 404, un 503 o una página de
 *  error, que el SW guarda igual porque la respuesta es opaca) o vencieron los `ms`. */
export type FigureLoad = "ok" | "error" | "tiempo";

/** Pide la figura como imagen (destino image → img-src, H9) y espera a que cargue, falle o venzan `ms`. */
export function loadImage(src: string, ms = 10_000): Promise<FigureLoad> {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const end = (r: FigureLoad) => {
      if (done) return;
      done = true;
      clearTimeout(t);
      img.onload = img.onerror = null;
      resolve(r);
    };
    const t = setTimeout(() => end("tiempo"), ms);
    img.referrerPolicy = "no-referrer";
    img.onload = () => end("ok");
    img.onerror = () => end("error");
    img.src = src;
  });
}
