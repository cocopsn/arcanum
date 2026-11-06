import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import manifest from "@/app/manifest";
import { brandIconPrecacheEntries } from "../../scripts/brand-icons-precache.mjs";

// The guardian raven's icon set (scripts/generate-icons.mjs → `pnpm icons`). Pins what browsers rely on: every icon the
// manifest and the <head> declare exists with its declared pixel size; the ?v= of each URL is the file's sha256[:10]
// (a changed URL is what makes Chrome 144+ and the favicon caches take a new icon) and that exact URL is precached;
// favicon.ico carries 16/32/48 and is the only one; the apple-touch-icon is opaque (iOS paints transparency black); the
// maskable keeps the raven inside the launcher's safe circle; Forge never draws the raven (D4: neutrals only).
const ROOT = path.resolve(__dirname, "..", "..");
const sha10 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex").slice(0, 10);
const BG = [0x0c, 0x00, 0x16]; // the raven's own background, #0C0016

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
  return { file: path.join(ROOT, "public", pathname!), v: new URLSearchParams(query).get("v") };
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

// icon URLs in the root layout's metadata (read as text: the module pulls next/font, which only Next can compile)
const layoutIconUrls = [...readFileSync(path.join(ROOT, "src/app/layout.tsx"), "utf8").matchAll(/"(\/[^"\s]*\.(?:png|ico)(?:\?[^"\s]*)?)"/g)].map(
  (m) => m[1]!,
);

describe("brand icons — the guardian raven", () => {
  const icons = manifest().icons ?? [];

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

  it("every icon URL in the manifest and the <head> carries ?v= = sha256[:10] of its file", () => {
    for (const icon of icons) expectVersioned(icon.src, "manifest.ts");
    expect(layoutIconUrls.length, "layout.tsx declares no icon URLs").toBeGreaterThanOrEqual(3);
    for (const url of layoutIconUrls) expectVersioned(url, "layout.tsx");
  });

  it("each of those versioned URLs is precached under that exact URL (next.config.mjs → brandIconPrecacheEntries)", () => {
    const precached = brandIconPrecacheEntries().map((e) => e.url);
    for (const url of [...icons.map((i) => i.src), ...layoutIconUrls])
      expect(precached, `${url} is not in the precache list (scripts/brand-icons-precache.mjs): offline it would only come from the 24 h runtime cache`).toContain(url);
    const cfg = readFileSync(path.join(ROOT, "next.config.mjs"), "utf8");
    expect(cfg, "next.config.mjs no longer appends brandIconPrecacheEntries() to the precache (manifestTransforms)").toMatch(
      /manifestTransforms:[\s\S]{0,200}brandIconPrecacheEntries\(\)/,
    );
  });

  it("favicon.ico lives only in public/ and holds 16, 32 and 48 PNG entries of those sizes", () => {
    expect(existsSync(path.join(ROOT, "src/app/favicon.ico")), "both public/favicon.ico and src/app/favicon.ico exist").toBe(false);
    const ico = readFileSync(path.join(ROOT, "public/favicon.ico"));
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
    const url = layoutIconUrls.find((u) => u.includes("apple-touch-icon"));
    expect(url, "layout.tsx declares no apple-touch-icon").toBeDefined();
    const info = png(readFileSync(versioned(url!).file), "apple-touch-icon");
    expect(info.size, "apple-touch-icon size").toBe("180x180");
    expect([2, 3], `apple-touch-icon has an alpha channel (PNG color type ${info.colorType})`).toContain(info.colorType);
    expect(info.chunks, "apple-touch-icon has a tRNS (transparency) chunk").not.toContain("tRNS");
  });

  it("the maskable icon is full-bleed #0C0016 with the whole raven inside the central 80 % safe circle", async () => {
    const icon = icons.find((i) => i.purpose === "maskable");
    const { data, info } = await sharp(versioned(icon!.src).file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = info;
    const at = (x: number, y: number) => data.subarray((y * w + x) * 4, (y * w + x) * 4 + 4);
    const isBg = (p: Uint8Array) => p[3] === 255 && BG.every((c, k) => Math.abs(p[k]! - c) <= 2);
    const edge: [number, number][] = [[0, 0], [w >> 1, 0], [w - 1, 0], [0, h >> 1], [w - 1, h >> 1], [0, h - 1], [w >> 1, h - 1], [w - 1, h - 1]];
    expect(edge.filter(([x, y]) => !isBg(at(x, y))), "maskable is not full-bleed opaque #0C0016 at its edges").toEqual([]);
    // a raven pixel: some channel more than 24 levels away from the background (RAVEN in scripts/generate-icons.mjs)
    let far = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const p = at(x, y);
        if (!BG.every((c, k) => Math.abs(p[k]! - c) <= 24)) far = Math.max(far, Math.hypot(x + 0.5 - w / 2, y + 0.5 - h / 2));
      }
    expect(far, `maskable: a raven pixel sits ${far.toFixed(1)} px from the center, outside the 80 % safe circle (launchers crop it)`).toBeLessThanOrEqual(
      0.4 * w,
    );
  });

  it("BrandMark's image is in public/, big enough for 64 px at DPR 3", () => {
    const src = readFileSync(path.join(ROOT, "src/ui/BrandMark.tsx"), "utf8").match(/src="(\/icons\/[^"]+\.png)"/)?.[1];
    expect(src, "BrandMark.tsx has no /icons/*.png src").toBeDefined();
    const file = path.join(ROOT, "public", src!);
    expect(existsSync(file), `BrandMark's image ${src} has no file in public/`).toBe(true);
    const [w, h] = png(readFileSync(file), src!).size.split("x").map(Number);
    expect(w === h && w! >= 192, `BrandMark's image ${src} is ${w}x${h}: it must be square and at least 192 px (64 px × DPR 3)`).toBe(true);
  });

  it("Engineering Forge stays monochrome (D4): nothing under src/forge/ draws the raven", () => {
    const offenders = walk(path.join(ROOT, "src/forge"))
      .filter((f) => /\.(?:tsx?|jsx?|mjs|css|json)$/.test(f))
      .filter((f) => /BrandMark|\/icons\/(?:logo-|icon-|apple-touch-icon|favicon)|favicon\.ico|cuervo-guardian/.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(ROOT, f));
    expect(offenders, "src/forge/ draws the raven: Forge is neutrals only (#0a0a0b to #ffffff, D4)").toEqual([]);
  });
});
