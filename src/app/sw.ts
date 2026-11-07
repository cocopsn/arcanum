/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheableResponsePlugin, CacheFirst, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from "serwist";
import {
  ATLAS_CACHE,
  BOOKS_CACHE,
  FIGURES_CACHE,
  isApi,
  isAtlasHashed,
  isAtlasManifest,
  isAtlasVideos,
  isFigureRequest,
  isForgeBook,
  isNavigation,
  isPyodide,
  isWebManifest,
  makeFigureHandler,
  precacheCounts,
  PRECACHE_STATUS_MSG,
  prunePyodide,
  SHELL_CACHE,
} from "./sw-rules";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Rules and cache names live in sw-rules.ts (pure, unit-tested); this file only wires them (design poblar §6.2).
//
// The app SHELL cache. The shell (`/`) is a dynamic Next route → it is NOT in the precache manifest, so
// by default it only lands in cache AFTER a first controlled navigation. That left a real offline hole:
// right after a deploy the fresh SW starts with a COLD nav cache, and on iOS/WebKit an offline reload
// before any navigation had no shell to serve → "PWA fails offline". We fix it two ways: (1) WARM `/`
// into this cache at install, so the shell is available offline from the very first load; (2) serve
// navigations from an explicit NetworkFirst on this cache — fresh when online, the warmed/cached shell
// when offline. This is the app-shell pattern, and it is what makes offline robust on Safari.
const SHELL_URL = "/";
const WEB_MANIFEST_URL = "/manifest.webmanifest";
const only200 = () => [new CacheableResponsePlugin({ statuses: [200] })];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // Order matters: every rule here precedes defaultCache (design poblar §6.2, rules 1 to 10).
  runtimeCaching: [
    // 1 · NEVER cache the auth routes (/api/login|session|logout). defaultCache caches GET /api/* with
    // NetworkFirst (24h) → it would serve a STALE session verdict: lock out a valid user on slow
    // net, or keep a revoked device "in". NetworkOnly makes /api/session truly fail offline so
    // AccessGate falls back to its localStorage flag (the documented offline path).
    { matcher: isApi, handler: new NetworkOnly() },
    // 2 · Pyodide (CPython WASM): the py-runner WORKER keeps its six files in arcanum-pyodide itself (§6.3), so
    // Python works offline without depending on the SW intercepting a blob: worker. One writer only: the SW never
    // stores there, and defaultCache's cross-origin rule (1 h) never touches these files.
    { matcher: isPyodide, handler: new NetworkOnly() },
    // 3 · Forge books: the file name carries its sha10 → immutable, no expiration; cleanup is explicit (§6.9).
    { matcher: isForgeBook, handler: new CacheFirst({ cacheName: BOOKS_CACHE, plugins: only200() }) },
    // 4 · Atlas partitions, indexes and files with sha10.
    { matcher: isAtlasHashed, handler: new CacheFirst({ cacheName: ATLAS_CACHE, plugins: only200() }) },
    // 5 · Atlas manifest: changes with each capture.
    { matcher: isAtlasManifest, handler: new NetworkFirst({ cacheName: ATLAS_CACHE, networkTimeoutSeconds: 3, plugins: only200() }) },
    // 6 · Atlas video files without sha10: only what THIS rule stored expires (no maxEntries).
    {
      matcher: isAtlasVideos,
      handler: new NetworkFirst({
        cacheName: ATLAS_CACHE,
        networkTimeoutSeconds: 3,
        plugins: [...only200(), new ExpirationPlugin({ maxAgeSeconds: 30 * 24 * 3600 })],
      }),
    },
    // 7 · Figures of palantir.com: stored opaque, and only those of downloaded routes (§6.5).
    { matcher: isFigureRequest, handler: makeFigureHandler({ caches: self.caches, fetch: (r) => fetch(r) }) },
    // 8 · The web manifest, from arcanum-shell offline (warmed at install).
    { matcher: isWebManifest, handler: new NetworkFirst({ cacheName: SHELL_CACHE, networkTimeoutSeconds: 3, plugins: only200() }) },
    // 9 · App shell: full-page navigations (reload / cold open) → fresh online, warmed/cached shell offline.
    // request.mode === "navigate" is ONLY the document navigation (not Next's client RSC fetches, which
    // stay on defaultCache), so this doesn't disturb client-side routing.
    { matcher: isNavigation, handler: new NetworkFirst({ cacheName: SHELL_CACHE, networkTimeoutSeconds: 3 }) },
    ...defaultCache,
  ],
});

// Warm the shell and the web manifest into SHELL_CACHE at install so the FIRST offline navigation (or a cold cache
// right after a deploy) still resolves. Best-effort and independent — install runs online; a failure just defers to
// the runtime handlers.
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE).catch(() => null);
      if (!cache) return;
      for (const url of [SHELL_URL, WEB_MANIFEST_URL]) {
        try {
          await cache.add(new Request(url, { cache: "reload" }));
        } catch {
          /* offline/opaque at install → the NetworkFirst handler fills it on the next online load */
        }
      }
    })(),
  );
});

// A new Pyodide version leaves the old files behind: prune them. Never rejects the activation.
self.addEventListener("activate", (event) => {
  event.waitUntil(prunePyodide(self.caches).then(() => undefined, (e) => console.warn("[sw] prunePyodide", e)));
});

// Only ARCANUM_PRECACHE_STATUS, answered on the port it came with. Any other type is ignored, and nothing here
// fetches a URL that arrives in a message.
self.addEventListener("message", (event) => {
  const data = event.data as { type?: unknown } | null;
  const port = event.ports?.[0];
  if (!data || data.type !== PRECACHE_STATUS_MSG || !port) return;
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(serwist.precacheStrategy.cacheName);
        port.postMessage(await precacheCounts(serwist.getUrlsToPrecacheKeys(), cache));
      } catch {
        port.postMessage(null);
      }
    })(),
  );
});

serwist.addEventListeners();
