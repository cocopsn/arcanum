// Brand icon URLs — the SINGLE source (same pattern as src/lib/csp.mjs: plain .mjs, so next.config.mjs and the build
// scripts import it as is and TypeScript through allowJs). src/app/layout.tsx declares the <head> ones,
// src/app/manifest.ts the manifest ones, scripts/brand-icons-precache.mjs precaches each one under its exact URL and
// src/app/brand-icons.test.ts checks every ?v= against its file.
//
// ?v= = sha256[:10] of the file. Chrome (144+) re-fetches an installed app's icons only when their URL changes, and the
// favicon caches behave the same, so the URL has to change with the file: `pnpm icons` prints each sha10; copy it here.

/** <head>: rel=icon (favicon.ico with 16/32/48, the 32 px PNG) and rel=apple-touch-icon (180×180, opaque). */
export const HEAD_ICONS = {
  favicon: "/favicon.ico?v=746ff5c916",
  favicon32: "/icons/favicon-32.png?v=ecfe2855bc",
  appleTouch: "/icons/apple-touch-icon.png?v=bea11a0e15",
};

/** Web app manifest: purpose any at 192 and 512, and the maskable 512. */
export const MANIFEST_ICONS = {
  any192: "/icons/icon-192.png?v=af8f4bcc6d",
  any512: "/icons/icon-512.png?v=65ebe62da3",
  maskable512: "/icons/icon-maskable-512.png?v=43190331ca",
};
