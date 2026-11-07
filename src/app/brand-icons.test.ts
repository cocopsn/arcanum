import { describe, it, expect, vi } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createElement } from "react";
import { render } from "@testing-library/react";
import sharp from "sharp";
import manifest from "@/app/manifest";
import { metadata } from "@/app/layout";
import { HEAD_ICONS, MANIFEST_ICONS } from "@/lib/brand-icons.mjs";
import { BRAND_ALT, BrandMark } from "@/ui/BrandMark";
import { serwistOptions } from "../../next.config.mjs";
import { BRAND_BG, RAVEN_THRESHOLD, borderOffender } from "../../scripts/brand-constants.mjs";
import { VERSIONED_BRAND_ICONS } from "../../scripts/brand-icons-precache.mjs";

// The guardian raven's icon set (scripts/generate-icons.mjs → `pnpm icons`). Pins what browsers rely on: every icon the
// manifest and the <head> declare exists with its declared pixel size; the ?v= of each URL is the file's sha256[:10]
// (a changed URL is what makes Chrome 144+ and the favicon caches take a new icon), those URLs come from
// src/lib/brand-icons.mjs and each one is precached under that exact URL; every URL the app requests WITHOUT ?v= is
// precached too; favicon.ico carries 16/32/48 and is the only one; the apple-touch-icon is opaque (iOS paints
// transparency black); the maskable keeps the raven inside the launcher's safe circle; Forge never draws the raven
// (D4: neutrals only).
//
// layout.tsx calls next/font, which only Next's compiler resolves: here every font is a stub, so the test reads the
// real `metadata` object (what Next turns into the <head> links) instead of the file's text.
vi.mock("next/font/google", () => new Proxy({}, { has: () => true, get: (_, name) => (name === "then" ? undefined : () => ({ className: "", variable: "", style: {} })) }));
vi.mock("next/font/local", () => ({ default: () => ({ className: "", variable: "", style: {} }) }));

const ROOT = path.resolve(__dirname, "..", "..");
const PUBLIC = path.join(ROOT, "public");
const sha10 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex").slice(0, 10);
const BG = BRAND_BG; // the raven's own background, #0C0016 (scripts/brand-constants.mjs, shared with the generator)

/** Pixel size, color type and chunk list of a PNG (IHDR is always the first chunk). */
function png(buf: Buffer, what: string) {
  expect(buf.subarray(0, 8).toString("hex"), `${what} is not a PNG`).toBe("89504e470d0a1a0a");
  const chunks: string[] = [];
  for (let o = 8; o + 8 <= buf.length; o += 12 + buf.readUInt32BE(o)) chunks.push(buf.toString("latin1", o + 4, o + 8));
  return { size: `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`, colorType: buf.readUInt8(25), chunks };
}

/** "/icons/a.png?v=0123456789" → the file under public/ and its ?v= (null when absent). */
function versioned(url: string) {
  const [pathname, query = ""] = url.split("?");
  return { file: path.join(PUBLIC, pathname!), v: new URLSearchParams(query).get("v") };
}

function expectVersioned(url: string, where: string) {
  const { file, v } = versioned(url);
  expect(existsSync(file), `${where}: ${url} has no file in public/`).toBe(true);
  expect(v, `${where}: ${url} carries no ?v= — browsers would keep the old icon`).not.toBeNull();
  expect(v, `${where}: ?v= of ${url} is not sha256[:10] of the file (re-run \`pnpm icons\` and copy the printed sha10)`).toBe(
    sha10(readFileSync(file)),
  );
}

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join("/");

/** The icon URLs of the root layout's metadata: `icons` as Next accepts it (a URL, a list, or { icon, shortcut, apple, other }). */
function headIconUrls() {
  type IconLike = string | URL | { url: string | URL };
  const list = (v: unknown) => (v == null ? [] : Array.isArray(v) ? v : [v]) as IconLike[];
  const urlOf = (i: IconLike) => String(typeof i === "object" && "url" in i ? i.url : i);
  const icons = metadata.icons;
  if (!icons || typeof icons === "string" || icons instanceof URL || Array.isArray(icons)) return { all: list(icons).map(urlOf), apple: [] };
  const { icon, shortcut, apple, other } = icons;
  return { all: [...list(icon), ...list(shortcut), ...list(apple), ...list(other)].map(urlOf), apple: list(apple).map(urlOf) };
}

/** The src that BrandMark actually renders. */
function brandMarkSrc() {
  const { container, unmount } = render(createElement(BrandMark, { size: 56 }));
  const src = container.querySelector("img")?.getAttribute("src") ?? null;
  unmount();
  return src;
}

/** Every public URL that app code under src/ requests WITHOUT ?v= ("/icons/…" or "/favicon.ico" written as a whole
 *  literal, plus BrandMark's rendered src), with the files that request it. Tests are not app code. */
function unversionedRequests() {
  const found = new Map<string, Set<string>>();
  const add = (url: string, who: string) => found.set(url, (found.get(url) ?? new Set()).add(who));
  for (const f of walk(path.join(ROOT, "src"))) {
    if (!/\.(?:tsx?|jsx?|mjs|css)$/.test(f) || /\.test\.[jt]sx?$/.test(f)) continue;
    for (const m of readFileSync(f, "utf8").matchAll(/["'`(](\/(?:icons\/[^"'`()\s?#$]+|favicon\.ico))(?=["'`)?#])(\?v=)?/g)) if (!m[2]) add(m[1]!, rel(f));
  }
  const mark = brandMarkSrc();
  if (mark && !mark.includes("?v=")) add(mark, "src/ui/BrandMark.tsx");
  return found;
}

// @serwist/next builds the public/ part of the precache with its own `glob` package: globSync(globPublicPatterns,
// { nodir, follow, cwd: public/ }) minus the worker files, one entry per file under its bare URL. The test uses that same
// package (resolved from @serwist/next) and the options next.config.mjs exports, so it sees what the build sees.
const serwistGlob = createRequire(realpathSync(path.join(ROOT, "node_modules/@serwist/next/package.json")))("glob").globSync as (
  patterns: string[],
  options: object,
) => string[];

/** The precache URLs that come from public/: the glob's (bare URLs) and the ones manifestTransforms append. */
async function precache() {
  const glob = serwistGlob(serwistOptions.globPublicPatterns, { nodir: true, follow: true, cwd: PUBLIC, ignore: ["swe-worker-*.js", "sw.js", "sw.js.map"] }).map(
    (f) => "/" + f.split(path.sep).join("/"),
  );
  let transformed: { url: string }[] = [];
  for (const t of serwistOptions.manifestTransforms ?? []) transformed = (await t(transformed)).manifest;
  return { glob, transformed: transformed.map((e) => e.url) };
}

describe("brand icons — the guardian raven", () => {
  const icons = manifest().icons ?? [];
  const head = headIconUrls();

  it("every manifest icon exists as a PNG of its declared size, with purpose any and maskable", () => {
    for (const icon of icons) {
      const { file } = versioned(icon.src);
      expect(existsSync(file), `manifest icon ${icon.src} has no file in public/`).toBe(true);
      expect(icon.type, `manifest icon ${icon.src}: type`).toBe("image/png");
      expect(png(readFileSync(file), icon.src).size, `manifest icon ${icon.src}: real size vs declared sizes`).toBe(icon.sizes);
    }
    const purposes = icons.map((i) => i.purpose ?? "any");
    expect(purposes, "manifest needs a purpose:any icon").toContain("any");
    expect(purposes, "manifest needs a purpose:maskable icon").toContain("maskable");
    expect(
      icons.filter((i) => (i.purpose ?? "any") === "any").map((i) => i.sizes),
      "purpose:any icons must cover 192x192 and 512x512",
    ).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  });

  it("every icon URL in the manifest and the <head> carries ?v= = sha256[:10] of its file, from src/lib/brand-icons.mjs", () => {
    for (const icon of icons) expectVersioned(icon.src, "manifest.ts");
    for (const url of head.all) expectVersioned(url, "layout.tsx");
    const declared = [...Object.values(HEAD_ICONS), ...Object.values(MANIFEST_ICONS)];
    const outside = [
      ...head.all.filter((u) => !declared.includes(u)).map((u) => `${u} (layout.tsx)`),
      ...icons.filter((i) => !declared.includes(i.src)).map((i) => `${i.src} (manifest.ts)`),
    ];
    expect(outside, "icon URLs declared outside src/lib/brand-icons.mjs: the module is their single source").toEqual([]);
    // the other direction (review #7): every versioned entry the precache adds is a URL the <head> or the manifest requests
    const requested = new Set([...head.all, ...icons.map((i) => i.src)].map((u) => u.split("?")[0]));
    expect(
      VERSIONED_BRAND_ICONS.filter((p) => !requested.has(p)),
      "VERSIONED_BRAND_ICONS lists icons that neither the <head> nor the manifest requests: dead weight in the install download",
    ).toEqual([]);
  });

  it("each of those versioned URLs is precached under that exact URL (next.config.mjs manifestTransforms → brandIconPrecacheEntries)", async () => {
    const { transformed } = await precache();
    expect(
      [...icons.map((i) => i.src), ...head.all].filter((u) => !transformed.includes(u)),
      "versioned icon URLs not precached under that URL: next.config.mjs manifestTransforms must add them (scripts/brand-icons-precache.mjs), or offline they only come from the 24 h runtime cache",
    ).toEqual([]);
  });

  it("every URL the app requests WITHOUT ?v= is precached (BrandMark, the audiobook lock-screen artwork)", async () => {
    const { glob } = await precache();
    expect(
      [...unversionedRequests()].filter(([url]) => !glob.includes(url)).map(([url, who]) => `${url} (requested without ?v= by ${[...who].join(", ")})`),
      "URLs the app requests without ?v= that are not in the precache: next.config.mjs globPublicPatterns must cover them, or they break offline",
    ).toEqual([]);
  });

  it("the glob precaches nothing the app does not request without ?v= (no icon downloaded twice at install)", async () => {
    const { glob } = await precache();
    const bare = unversionedRequests();
    expect(
      glob.filter((url) => !bare.has(url)),
      "next.config.mjs globPublicPatterns precaches files nobody requests without ?v=: they are already precached under their ?v= URL, so the install downloads them twice (review #4)",
    ).toEqual([]);
  });

  it("the OG card is 1200x630 and has its alt text", () => {
    expect(png(readFileSync(path.join(ROOT, "src/app/opengraph-image.png")), "opengraph-image.png").size, "opengraph-image.png size").toBe("1200x630");
    const alt = path.join(ROOT, "src/app/opengraph-image.alt.txt");
    expect(existsSync(alt), "src/app/opengraph-image.alt.txt is missing: Next would emit og:image without og:image:alt").toBe(true);
    expect(readFileSync(alt, "utf8").trim(), "opengraph-image.alt.txt is empty").not.toBe("");
  });

  it("borderOffender (the generator's precondition) finds a non-background pixel on the canvas border, and only there", () => {
    const W = 4, H = 3;
    const canvas = () => Buffer.from(Array.from({ length: W * H }, () => BRAND_BG).flat());
    expect(borderOffender(canvas(), W, H, BRAND_BG, RAVEN_THRESHOLD), "a flat background canvas has no offender").toBeNull();
    const inner = canvas();
    inner.set([255, 255, 255], (1 * W + 1) * 3);
    expect(borderOffender(inner, W, H, BRAND_BG, RAVEN_THRESHOLD), "an interior subject pixel is not a border offender").toBeNull();
    const edge = canvas();
    edge.set([255, 255, 255], (1 * W + 3) * 3); // right column, middle row: only the column scan sees it
    expect(borderOffender(edge, W, H, BRAND_BG, RAVEN_THRESHOLD), "a subject pixel on the border must be reported").toEqual({ x: 3, y: 1 });
  });

  it("BrandMark is decorative by default (its uses sit next to the word ARCANUM) and takes a descriptive alt when alone", () => {
    const { container, unmount } = render(createElement(BrandMark, { size: 56 }));
    expect(container.querySelector("img")?.getAttribute("alt"), "BrandMark default alt must be empty: screen readers would announce the brand twice").toBe("");
    unmount();
    const alone = render(createElement(BrandMark, { size: 56, alt: BRAND_ALT }));
    expect(alone.container.querySelector("img")?.getAttribute("alt"), "BrandMark must pass its alt prop through").toBe(BRAND_ALT);
    alone.unmount();
  });

  it("favicon.ico lives only in public/ and holds 16, 32 and 48 PNG entries of those sizes", () => {
    expect(existsSync(path.join(ROOT, "src/app/favicon.ico")), "both public/favicon.ico and src/app/favicon.ico exist").toBe(false);
    const ico = readFileSync(path.join(PUBLIC, "favicon.ico"));
    expect([ico.readUInt16LE(0), ico.readUInt16LE(2)], "favicon.ico header (reserved 0, type 1 = icon)").toEqual([0, 1]);
    const sizes: number[] = [];
    for (let k = 0; k < ico.readUInt16LE(4); k++) {
      const o = 6 + 16 * k;
      const side = ico.readUInt8(o) || 256;
      const entry = ico.subarray(ico.readUInt32LE(o + 12), ico.readUInt32LE(o + 12) + ico.readUInt32LE(o + 8));
      expect(png(entry, `favicon.ico entry ${side}`).size, `favicon.ico entry ${side}: directory vs image size`).toBe(`${side}x${side}`);
      sizes.push(side);
    }
    expect(sizes.sort((a, b) => a - b), "favicon.ico sizes").toEqual([16, 32, 48]);
  });

  it("apple-touch-icon is 180x180 and opaque", () => {
    const url = head.apple[0];
    expect(url, "layout.tsx declares no apple-touch-icon").toBeDefined();
    const info = png(readFileSync(versioned(url!).file), "apple-touch-icon");
    expect(info.size, "apple-touch-icon size").toBe("180x180");
    expect([2, 3], `apple-touch-icon has an alpha channel (PNG color type ${info.colorType})`).toContain(info.colorType);
    expect(info.chunks, "apple-touch-icon has a tRNS (transparency) chunk").not.toContain("tRNS");
  });

  it("the maskable icon is full-bleed #0C0016 with the whole raven inside the central 80 % safe circle", async () => {
    const icon = icons.find((i) => i.purpose === "maskable");
    expect(icon, "manifest declares no purpose:maskable icon").toBeDefined();
    const { data, info } = await sharp(versioned(icon!.src).file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = info;
    const at = (x: number, y: number) => data.subarray((y * w + x) * 4, (y * w + x) * 4 + 4);
    const isBg = (p: Uint8Array) => p[3] === 255 && BG.every((c, k) => Math.abs(p[k]! - c) <= 2);
    const edge: [number, number][] = [[0, 0], [w >> 1, 0], [w - 1, 0], [0, h >> 1], [w - 1, h >> 1], [0, h - 1], [w >> 1, h - 1], [w - 1, h - 1]];
    expect(edge.filter(([x, y]) => !isBg(at(x, y))), "maskable is not full-bleed opaque #0C0016 at its edges").toEqual([]);
    // a raven pixel: some channel more than RAVEN_THRESHOLD levels away from the background (as in the generator)
    let far = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const p = at(x, y);
        if (!BG.every((c, k) => Math.abs(p[k]! - c) <= RAVEN_THRESHOLD)) far = Math.max(far, Math.hypot(x + 0.5 - w / 2, y + 0.5 - h / 2));
      }
    expect(far, `maskable: a raven pixel sits ${far.toFixed(1)} px from the center, outside the 80 % safe circle (launchers crop it)`).toBeLessThanOrEqual(
      0.4 * w,
    );
  });

  it("BrandMark's image is in public/, big enough for 64 px at DPR 3", () => {
    const src = brandMarkSrc();
    expect(src, "BrandMark renders no <img src>").toBeTruthy();
    const file = path.join(PUBLIC, src!.split("?")[0]!);
    expect(existsSync(file), `BrandMark's image ${src} has no file in public/`).toBe(true);
    const [w, h] = png(readFileSync(file), src!).size.split("x").map(Number);
    expect(w === h && w! >= 192, `BrandMark's image ${src} is ${w}x${h}: it must be square and at least 192 px (64 px × DPR 3)`).toBe(true);
  });

  it("Engineering Forge stays monochrome (D4): nothing under src/forge/ draws the raven", () => {
    const forgeDir = path.join(ROOT, "src/forge");
    expect(existsSync(forgeDir), "src/forge/ does not exist: Forge moved, so this D4 check no longer looks at it — point it at the new folder").toBe(true);
    const offenders = walk(forgeDir)
      .filter((f) => /\.(?:tsx?|jsx?|mjs|css|json)$/.test(f))
      .filter((f) => /BrandMark|\/icons\/(?:logo-|icon-|apple-touch-icon|favicon)|favicon\.ico|cuervo-guardian/.test(readFileSync(f, "utf8")))
      .map(rel);
    expect(offenders, "src/forge/ draws the raven: Forge is neutrals only (#0a0a0b to #ffffff, D4)").toEqual([]);
  });
});
