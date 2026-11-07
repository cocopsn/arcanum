// Content-Security-Policy — the SINGLE source (Forge design §12.1, RD-7). next.config.mjs applies buildCsp() to
// /:path*. Two components read these lists today: VideoEmbed (isAllowedFrameUrl) and the figure paragraph of
// BookReader (isAllowedImageUrl). Nothing else checks them; for any other <img> or <iframe> only the header applies.
//
// Defense-in-depth for a PUBLIC-repo app that executes learner code. The code runner NEEDS 'unsafe-eval'
// (new Function) + blob workers + Pyodide from jsdelivr, so script/worker are necessarily permissive; the
// meaningful restriction is connect-src (egress) scoped to self + Supabase + the Pyodide CDN, so learner code
// cannot exfiltrate to an arbitrary host. Worker-level storage isolation is enforced separately in
// js-runner/py-runner (WORKER_SHIELD); CSP does not gate same-origin IndexedDB.

/** Image origins observed by the crawl: docs figures (www.palantir.com) and build figures (build.palantir.com). */
export const IMG_ORIGINS = ["https://www.palantir.com", "https://build.palantir.com"];

/** Player origins: the YouTube ids of docs and the master program (privacy-enhanced host) and the build tours. */
export const FRAME_ORIGINS = ["https://www.youtube-nocookie.com", "https://player.vimeo.com"];

/** The 14 directives, in order. Values are exact; no new wildcard. */
export const CSP_DIRECTIVES = [
  ["default-src", ["'self'"]],
  ["base-uri", ["'self'"]],
  ["object-src", ["'none'"]],
  ["frame-ancestors", ["'none'"]],
  ["form-action", ["'self'"]],
  ["script-src", ["'self'", "'unsafe-inline'", "'unsafe-eval'", "'wasm-unsafe-eval'", "blob:", "https://cdn.jsdelivr.net"]],
  ["worker-src", ["'self'", "blob:"]],
  ["style-src", ["'self'", "'unsafe-inline'"]],
  ["img-src", ["'self'", "data:", "blob:", ...IMG_ORIGINS]],
  ["font-src", ["'self'", "data:"]],
  ["connect-src", ["'self'", "blob:", "data:", "https://*.supabase.co", "wss://*.supabase.co", "https://cdn.jsdelivr.net"]],
  // media-src does NOT fall back gracefully for the audiobook's silent data: WAV anchor (audio focus /
  // lock-screen controls): without data: it falls to default-src 'self' and the <audio> is blocked.
  ["media-src", ["'self'", "data:", "blob:"]],
  ["frame-src", [...FRAME_ORIGINS]],
  ["manifest-src", ["'self'"]],
];

/** The header value: «directive v1 v2; directive …». */
export function buildCsp() {
  return CSP_DIRECTIVES.map(([name, values]) => `${name} ${values.join(" ")}`).join("; ");
}

/** Extra connect-src origins of the SERVICE WORKER only (design poblar §6.5, anexo r2 [21] plan B, measured in
 *  Chromium on 2026-11-07): Chromium judges the SW's fetch(event.request) of a figure by connect-src, not img-src,
 *  so without this the figures of a downloaded route never get stored. The page policy does not change, and learner
 *  code runs in blob: workers of the page, which inherit the PAGE policy, so its egress stays the same. */
export const SW_CONNECT_EXTRA = ["https://www.palantir.com"];

/** The policy served with /sw.js: the page policy with SW_CONNECT_EXTRA added to connect-src. */
export function buildSwCsp() {
  return CSP_DIRECTIVES.map(([name, values]) => `${name} ${(name === "connect-src" ? [...values, ...SW_CONNECT_EXTRA] : values).join(" ")}`).join("; ");
}

/** True only for an https URL whose origin is in IMG_ORIGINS (what img-src allows beyond self/data/blob). */
export function isAllowedImageUrl(src) {
  try {
    const u = new URL(String(src));
    return u.protocol === "https:" && IMG_ORIGINS.includes(u.origin);
  } catch {
    return false;
  }
}

/** True only for an https URL whose origin is in FRAME_ORIGINS (what frame-src allows). */
export function isAllowedFrameUrl(src) {
  try {
    const u = new URL(String(src));
    return u.protocol === "https:" && FRAME_ORIGINS.includes(u.origin);
  } catch {
    return false;
  }
}
