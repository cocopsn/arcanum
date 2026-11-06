import withSerwistInit from "@serwist/next";
import { brandIconPrecacheEntries } from "./scripts/brand-icons-precache.mjs";
import { ForgeChunkMapPlugin } from "./scripts/forge/forge-chunk-map.mjs";
import { buildCsp } from "./src/lib/csp.mjs";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  // the app page chunk bundles the seed books+banks (~2.5 MB) — raise the precache limit so the
  // OFFLINE shell stays whole after a deploy (a chunk outside the precache is exactly the cold-
  // offline hole the app-shell fix closed; the one-time install download is the books, i.e. the point)
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  // 🔴 Serwist's DEFAULT is true: its injected client does `addEventListener("online", () =>
  // location.reload())` — a FULL page reload every time the device regains connectivity. For a
  // local-first PWA that is destructive, not helpful: it killed the audiobook mid-listen when the
  // phone auto-joined a WiFi (captive portals included) and refreshed background tabs on any
  // network blip, landing on home. Reproduced live on prod (sentinel + synthetic online event →
  // navigation type "reload"). Sync + the AI queue already have their own gentle `online`
  // listeners — nothing here needs a reload to use the network again.
  reloadOnOnline: false,
  // Precache ONLY the icons from public/: public/atlas/** and public/forge/** (Atlas data, Forge books) are
  // loaded on demand and must never enter the install download (Forge design §6.6, CA-57).
  globPublicPatterns: ["icons/**/*"],
  // ...plus the brand icons under the exact ?v= URLs that the <head> and the manifest request, so those resolve offline
  // too (scripts/brand-icons-precache.mjs). Appended here: `additionalPrecacheEntries` would replace the glob above.
  manifestTransforms: [(entries) => ({ manifest: [...entries, ...brandIconPrecacheEntries()], warnings: [] })],
});

// Content-Security-Policy — the single source is src/lib/csp.mjs (Forge design §12.1). VideoEmbed and the figure
// paragraph of BookReader check URLs against the same origin lists; everything else relies on this header alone.
const CSP = buildCsp();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "Content-Security-Policy", value: CSP }] }];
  },
  // import seed books (content/books/*.md) as RAW strings so they bundle offline (no CDN, no fs).
  webpack: (config, { isServer, dev }) => {
    config.module.rules.push({ test: /\.md$/, type: "asset/source" });
    // Forge: .next/forge-chunks.json from the module graph, production client build only (budget-report, §6.7).
    if (!isServer && !dev) config.plugins.push(new ForgeChunkMapPlugin());
    return config;
  },
};

export default withSerwist(nextConfig);
