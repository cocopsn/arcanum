/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

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
    ...defaultCache,
  ],
});

serwist.addEventListeners();
