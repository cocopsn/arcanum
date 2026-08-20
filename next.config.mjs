import withSerwistInit from "@serwist/next";

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
});

// Content-Security-Policy — defense-in-depth for a PUBLIC-repo app that executes learner code. The code
// runner NEEDS 'unsafe-eval' (new Function) + blob workers + Pyodide from jsdelivr, so script/worker are
// necessarily permissive; the meaningful restriction is connect-src (egress) scoped to self + Supabase +
// the Pyodide CDN, so learner code cannot exfiltrate to an arbitrary host. Worker-level storage isolation
// is enforced separately in js-runner/py-runner (WORKER_SHIELD); CSP does not gate same-origin IndexedDB.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data: https://*.supabase.co wss://*.supabase.co https://cdn.jsdelivr.net",
  // media-src does NOT fall back gracefully for the audiobook's silent data: WAV anchor (audio focus /
  // lock-screen controls): without this line it falls to default-src 'self' and the <audio> is blocked.
  "media-src 'self' data: blob:",
  "manifest-src 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "Content-Security-Policy", value: CSP }] }];
  },
  // import seed books (content/books/*.md) as RAW strings so they bundle offline (no CDN, no fs).
  webpack: (config) => {
    config.module.rules.push({ test: /\.md$/, type: "asset/source" });
    return config;
  },
};

export default withSerwist(nextConfig);
