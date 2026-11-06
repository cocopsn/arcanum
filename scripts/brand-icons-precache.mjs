// The brand icons that the <head> (src/app/layout.tsx) and the manifest (src/app/manifest.ts) request as
// <path>?v=<sha256[:10] of the file>. The icons/** precache (next.config.mjs globPublicPatterns) keys them without a
// query and Serwist's lookup only drops utm_* and fbclid, so those versioned URLs missed the precache and resolved
// offline only from the 24 h runtime cache. next.config.mjs appends these entries to the precache: the exact versioned
// URL with revision null (the ?v= is the version). Ignoring `v` in the lookup instead would let an outgoing service
// worker answer a new ?v= with the old icon. src/app/brand-icons.test.ts keeps this list in step with the URLs.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

export const VERSIONED_BRAND_ICONS = [
  "/favicon.ico",
  "/icons/favicon-32.png",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];

/** Precache entries ({ url, revision: null, size }) for the versioned brand icon URLs, read from public/. */
export function brandIconPrecacheEntries() {
  return VERSIONED_BRAND_ICONS.map((pathname) => {
    const buf = readFileSync(path.join(PUBLIC_DIR, pathname));
    const v = createHash("sha256").update(buf).digest("hex").slice(0, 10);
    return { url: `${pathname}?v=${v}`, revision: null, size: buf.length };
  });
}
