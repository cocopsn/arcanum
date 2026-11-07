// Brand icons — ONE source for every derived icon: the guardian raven, assets/brand/cuervo-guardian-1254.png
// (1254×1254 RGB, background #0C0016). `pnpm icons` regenerates them all, deterministically.
//
// Nothing is recolored or redrawn. The source carries an invisible grain (sd ≈ 0.6 levels per channel) that made
// the PNGs ~6× bigger, so every pixel within ±FLAT levels of one of the image's own flat colors (medians measured
// here) is set to that color; edges and anti-aliasing are left alone. Then each output is cropped, scaled with
// Lanczos3 (sharp's default kernel) and, where the window leaves the image, padded with the image's background.
//
//   public/favicon.ico                  16 + 32 + 48 (PNG entries), tight crop
//   public/icons/favicon-32.png         tight crop
//   public/icons/apple-touch-icon.png   180, whole composition, opaque
//   public/icons/icon-192.png           purpose any, whole composition (also the audiobook lock-screen artwork)
//   public/icons/icon-512.png           purpose any, whole composition (idem)
//   public/icons/icon-maskable-512.png  full-bleed #0C0016, the whole raven inside the central 80 % safe circle
//   public/icons/logo-256.png           in-app mark (home header, access screen, boot screens) — never in Forge
//   src/app/opengraph-image.png         1200×630, raven centered on #0C0016
//
// The ?v= of the icon URLs in src/lib/brand-icons.mjs (the <head> and the manifest import them) is sha256[:10] of each
// file (printed at the end); src/app/brand-icons.test.ts fails when a file and its ?v= drift apart.
import sharp from "sharp";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const SRC = "assets/brand/cuervo-guardian-1254.png";
const RAVEN = 24; // a pixel is raven when some channel is more than this away from the background
const FLAT = 4; // grain amplitude flattened to the image's own flat colors
const MASKABLE_FILL = 0.96; // the raven's enclosing circle uses 96 % of the 80 % safe circle's radius

const sha10 = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 10);
const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

const src = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = src.info;
const px = src.data;
const N = W * H;
const near = (i, c, t) =>
  Math.abs(px[i] - c[0]) <= t && Math.abs(px[i + 1] - c[1]) <= t && Math.abs(px[i + 2] - c[2]) <= t;
/** Per-channel median of the pixels accepted by `keep(i)`. */
const medianOf = (keep) => {
  const ch = [[], [], []];
  for (let i = 0; i < px.length; i += 3) if (keep(i)) for (let c = 0; c < 3; c++) ch[c].push(px[i + c]);
  return ch.map((v) => v.sort((a, b) => a - b)[v.length >> 1]);
};

// 1. the image's flat colors: each dominant 8-level bin (≥ 1 % of the pixels) → median of its pixels → refined to the
//    median of every pixel within 2·FLAT of that; colors ≤ FLAT apart are one. The first one is the background.
const binOf = (i) => ((px[i] >> 3) << 10) | ((px[i + 1] >> 3) << 5) | (px[i + 2] >> 3);
const counts = new Map();
for (let i = 0; i < px.length; i += 3) counts.set(binOf(i), (counts.get(binOf(i)) ?? 0) + 1);
const flats = [];
for (const [bin, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
  if (count < N / 100) break;
  const seed = medianOf((i) => binOf(i) === bin);
  const color = medianOf((i) => near(i, seed, 2 * FLAT));
  if (!flats.some((f) => f.every((v, c) => Math.abs(v - color[c]) <= FLAT))) flats.push(color);
}
const BG = flats[0];
const background = { r: BG[0], g: BG[1], b: BG[2] };

// 2. flatten the grain
const flat = Buffer.from(px);
let flattened = 0;
for (let i = 0; i < px.length; i += 3) {
  const f = flats.find((c) => near(i, c, FLAT));
  if (!f) continue;
  flat[i] = f[0];
  flat[i + 1] = f[1];
  flat[i + 2] = f[2];
  flattened++;
}

// 3. raven geometry: bounding box, and per-row extremes (they hold every convex-hull vertex) for the minimal
//    enclosing circle — f(center) = distance to the farthest extreme is convex, so a coarse grid then a fine one
//    around its best point finds the minimum.
let x0 = W, x1 = -1, y0 = H, y1 = -1;
const ex = [];
for (let y = 0; y < H; y++) {
  let lo = -1, hi = -1;
  for (let x = 0; x < W; x++) {
    if (near((y * W + x) * 3, BG, RAVEN)) continue;
    if (lo < 0) lo = x;
    hi = x;
  }
  if (lo < 0) continue;
  ex.push(lo + 0.5, y + 0.5, hi + 0.5, y + 0.5);
  x0 = Math.min(x0, lo);
  x1 = Math.max(x1, hi);
  y0 = Math.min(y0, y);
  y1 = Math.max(y1, y);
}
const farthest = (cx, cy) => {
  let m = 0;
  for (let k = 0; k < ex.length; k += 2) m = Math.max(m, (ex[k] - cx) ** 2 + (ex[k + 1] - cy) ** 2);
  return Math.sqrt(m);
};
let mec = { r: Infinity, cx: 0, cy: 0 };
const scan = (xa, xb, ya, yb, step) => {
  for (let cy = ya; cy <= yb; cy += step)
    for (let cx = xa; cx <= xb; cx += step) {
      const r = farthest(cx, cy);
      if (r < mec.r) mec = { r, cx, cy };
    }
};
scan(x0, x1, y0, y1, 4);
scan(mec.cx - 4, mec.cx + 4, mec.cy - 4, mec.cy + 4, 0.25);
const box = { cx: (x0 + x1 + 1) / 2, cy: (y0 + y1 + 1) / 2, side: Math.max(x1 - x0, y1 - y0) + 1, h: y1 - y0 + 1 };

// 4. a window of the flattened source (center + size in source px) → output size; outside the image = background
//    (a window that would leave the padded canvas makes sharp's extract throw — no silent clipping)
const PAD = Math.ceil(W / 2);
const padded = await sharp(flat, { raw: { width: W, height: H, channels: 3 } })
  .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background })
  .raw()
  .toBuffer({ resolveWithObject: true });
const view = (cx, cy, w, h, outW, outH) =>
  sharp(padded.data, { raw: padded.info })
    .extract({ left: Math.round(cx - w / 2) + PAD, top: Math.round(cy - h / 2) + PAD, width: Math.round(w), height: Math.round(h) })
    .resize(outW, outH, { kernel: "lanczos3", fit: "fill" });
const png = (img) => img.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();

const whole = (size) => view(W / 2, H / 2, W, H, size, size); // the composition as delivered
const tightSide = box.side / 0.92; // favicons: the raven fills 92 % of the square (only dark margin is cut)
const tight = (size) => view(box.cx, box.cy, tightSide, tightSide, size, size);
const markSide = box.side / 0.8; // in-app mark: 80 % fill, room for the rounded corners
const maskSide = 512 / ((0.4 * 512 * MASKABLE_FILL) / mec.r); // source px shown by the maskable icon
const ogScale = (0.8 * 630) / box.h; // OG card: the raven is 80 % of its height

// favicon.ico: PNG-compressed entries (RGBA, what the format expects), smallest first
const entries = [];
for (const size of [16, 32, 48]) entries.push({ size, buf: await tight(size).ensureAlpha().png({ compressionLevel: 9 }).toBuffer() });
const head = Buffer.alloc(6 + 16 * entries.length);
head.writeUInt16LE(0, 0); // reserved
head.writeUInt16LE(1, 2); // type: icon
head.writeUInt16LE(entries.length, 4);
let offset = head.length;
entries.forEach(({ size, buf }, k) => {
  const o = 6 + 16 * k;
  head.writeUInt8(size, o); // width
  head.writeUInt8(size, o + 1); // height
  head.writeUInt8(0, o + 2); // palette entries
  head.writeUInt8(0, o + 3); // reserved
  head.writeUInt16LE(1, o + 4); // color planes
  head.writeUInt16LE(32, o + 6); // bits per pixel
  head.writeUInt32LE(buf.length, o + 8);
  head.writeUInt32LE(offset, o + 12);
  offset += buf.length;
});

const outputs = [
  ["public/favicon.ico", Buffer.concat([head, ...entries.map((e) => e.buf)])],
  ["public/icons/favicon-32.png", await png(tight(32))],
  ["public/icons/apple-touch-icon.png", await png(whole(180))],
  ["public/icons/icon-192.png", await png(whole(192))],
  ["public/icons/icon-512.png", await png(whole(512))],
  ["public/icons/icon-maskable-512.png", await png(view(mec.cx, mec.cy, maskSide, maskSide, 512, 512))],
  ["public/icons/logo-256.png", await png(view(box.cx, box.cy, markSide, markSide, 256, 256))],
  ["src/app/opengraph-image.png", await png(view(box.cx, box.cy, 1200 / ogScale, 630 / ogScale, 1200, 630))],
];

mkdirSync("public/icons", { recursive: true });
console.log(`source ${SRC} ${W}x${H} sha10=${sha10(readFileSync(SRC))}`);
console.log(`flat colors ${flats.map(hex).join(" ")} · ${((100 * flattened) / N).toFixed(1)} % of pixels flattened (±${FLAT})`);
console.log(`raven box x[${x0},${x1}] y[${y0},${y1}] · enclosing circle (${mec.cx}, ${mec.cy}) r=${mec.r.toFixed(1)}`);
for (const [file, buf] of outputs) {
  writeFileSync(file, buf);
  console.log(`wrote ${file.padEnd(36)} ${String(buf.length).padStart(7)} B  sha10=${sha10(buf)}`);
}
