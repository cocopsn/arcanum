import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Legibility anchor (WCAG AA): every text tier must clear 4.5:1 on BOTH surfaces.
// faint carries empty-state copy, confirmations and the × close control, so it is
// held to the same bar, not exempted.

function lum(hex: string): number {
  const c = hex.replace("#", "");
  const ch = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * f(ch[0]!) + 0.7152 * f(ch[1]!) + 0.0722 * f(ch[2]!);
}
function ratio(a: string, b: string): number {
  const L1 = lum(a);
  const L2 = lum(b);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

const tokens = readFileSync(join(process.cwd(), "src", "styles", "tokens.css"), "utf8");
const read = (name: string) => {
  const m = tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token --${name} not found`);
  return m[1]!;
};

describe("token contrast (WCAG AA legibility anchor)", () => {
  const surfaces = [read("surface"), read("surface-raised")];
  for (const tier of ["text", "text-muted", "text-faint"]) {
    it(`--${tier} clears 4.5:1 on both surfaces`, () => {
      const color = read(tier);
      for (const s of surfaces) expect(ratio(color, s)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
