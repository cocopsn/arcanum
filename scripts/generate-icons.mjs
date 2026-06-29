import sharp from "sharp";
import { mkdirSync } from "node:fs";

const OUT = "public/icons";
mkdirSync(OUT, { recursive: true });

function heptagram(cx, cy, r) {
  const pts = Array.from({ length: 7 }, (_, i) => {
    const a = ((-90 + i * (360 / 7)) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  const order = [0, 3, 6, 2, 5, 1, 4, 0];
  return (
    order
      .map((idx, i) => `${i === 0 ? "M" : "L"}${pts[idx][0].toFixed(2)} ${pts[idx][1].toFixed(2)}`)
      .join(" ") + " Z"
  );
}

function svg(size, contentScale) {
  const cx = size / 2;
  const cy = size / 2;
  const ringR = (size / 2) * contentScale * 0.92;
  const starR = ringR * 0.74;
  const sw = Math.max(2, size * 0.014);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#7c4de8"/>
      <stop offset="100%" stop-color="#25b0c9"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="42%" r="62%">
      <stop offset="0%" stop-color="#1b1830"/>
      <stop offset="100%" stop-color="#0c0b12"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#halo)"/>
  <circle cx="${cx}" cy="${cy}" r="${ringR}" fill="none" stroke="url(#g)" stroke-width="${sw}" opacity="0.9"/>
  <path d="${heptagram(cx, cy, starR)}" fill="none" stroke="url(#g)" stroke-width="${sw * 0.8}" stroke-linejoin="round" opacity="0.95"/>
  <circle cx="${cx}" cy="${cy}" r="${size * 0.035}" fill="#cfeaf3"/>
</svg>`;
}

async function png(size, name, contentScale) {
  await sharp(Buffer.from(svg(size, contentScale))).png().toFile(`${OUT}/${name}`);
  console.log("wrote", `${OUT}/${name}`);
}

await png(192, "icon-192.png", 0.86);
await png(512, "icon-512.png", 0.86);
await png(512, "icon-maskable-512.png", 0.7); // maskable safe zone
await png(180, "apple-touch-icon.png", 0.86);
await png(32, "favicon-32.png", 0.9);
