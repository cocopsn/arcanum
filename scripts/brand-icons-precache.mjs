// The brand icons that the <head> (src/app/layout.tsx) and the manifest (src/app/manifest.ts) request as
// <path>?v=<sha256[:10] of the file>; their URLs come from src/lib/brand-icons.mjs. The icons/** precache
// (next.config.mjs globPublicPatterns) keys them without a query and Serwist's lookup only drops utm_* and fbclid, so
// those versioned URLs missed the precache and resolved offline only from the 24 h runtime cache. next.config.mjs
// appends these entries to the precache: the exact versioned URL with revision null (the ?v= is the version). Ignoring
// `v` in the lookup instead would let an outgoing service worker answer a new ?v= with the old icon.
// src/app/brand-icons.test.ts keeps this list equal to the URLs the <head> and the manifest request.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HEAD_ICONS, MANIFEST_ICONS } from "../src/lib/brand-icons.mjs";

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

/** Pathnames (no query) of the brand icons requested with ?v=. */
export const VERSIONED_BRAND_ICONS = [...Object.values(HEAD_ICONS), ...Object.values(MANIFEST_ICONS)].map((url) => url.split("?")[0]);

/** Precache entries ({ url, revision: null, size }) for the versioned brand icon URLs, read from public/. */
export function brandIconPrecacheEntries() {
  return VERSIONED_BRAND_ICONS.map((pathname) => {
    const file = path.join(PUBLIC_DIR, pathname);
    let buf;
    try {
      buf = readFileSync(file);
    } catch (e) {
      throw new Error(`brand icon ${pathname} (${file}) cannot be read for the precache: run \`pnpm icons\` to regenerate the brand icons (${e.code ?? e.message})`);
    }
    const v = createHash("sha256").update(buf).digest("hex").slice(0, 10);
    return { url: `${pathname}?v=${v}`, revision: null, size: buf.length };
  });
}
