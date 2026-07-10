/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, NetworkFirst, NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// The app SHELL cache. The shell (`/`) is a dynamic Next route → it is NOT in the precache manifest, so
// by default it only lands in cache AFTER a first controlled navigation. That left a real offline hole:
// right after a deploy the fresh SW starts with a COLD nav cache, and on iOS/WebKit an offline reload
// before any navigation had no shell to serve → "PWA fails offline". We fix it two ways: (1) WARM `/`
// into this cache at install, so the shell is available offline from the very first load; (2) serve
// navigations from an explicit NetworkFirst on this cache — fresh when online, the warmed/cached shell
// when offline. This is the app-shell pattern, and it is what makes offline robust on Safari.
const SHELL_CACHE = "arcanum-shell";
const SHELL_URL = "/";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // NEVER cache the auth routes (/api/login|session|logout). defaultCache caches GET /api/* with
  // NetworkFirst (24h) → it would serve a STALE session verdict: lock out a valid user on slow
  // net, or keep a revoked device "in". NetworkOnly makes /api/session truly fail offline so
  // AccessGate falls back to its localStorage flag (the documented offline path). Must precede defaultCache.
  runtimeCaching: [
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    {
      // Pyodide (CPython WASM) — versioned/immutable assets. Cache on first load so the Python code
      // runner works 100% OFFLINE afterward (the learner rarely has data). CacheFirst = never re-fetch.
      matcher: ({ url }) => url.href.startsWith("https://cdn.jsdelivr.net/pyodide/"),
      handler: new CacheFirst({ cacheName: "arcanum-pyodide" }),
    },
    {
      // App shell: full-page navigations (reload / cold open) → fresh online, warmed/cached shell offline.
      // request.mode === "navigate" is ONLY the document navigation (not Next's client RSC fetches, which
      // stay on defaultCache), so this doesn't disturb client-side routing. Precedes defaultCache.
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({ cacheName: SHELL_CACHE, networkTimeoutSeconds: 3 }),
    },
    ...defaultCache,
  ],
});

// Warm the shell into SHELL_CACHE at install so the FIRST offline navigation (or a cold cache right after
// a deploy) still resolves. Best-effort — install runs online; a failure just defers to the runtime handler.
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(SHELL_CACHE);
        await cache.add(new Request(SHELL_URL, { cache: "reload" }));
      } catch {
        /* offline/opaque at install → the NetworkFirst nav handler fills it on the next online load */
      }
    })(),
  );
});

serwist.addEventListeners();
