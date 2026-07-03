import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
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
