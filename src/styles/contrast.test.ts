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

// Engineering Forge (D4, design §14.2, CA-62): the monochrome scale, re-measured in both modes, and the proof that
// what is measured is what the theme applies.
function mix(hex: string, white: number): string {
  const c = hex.replace("#", "");
  const ch = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  return "#" + ch.map((v) => Math.round(v + (255 - v) * white).toString(16).padStart(2, "0")).join("");
}

describe("Engineering Forge token contrast (D4, dark and light)", () => {
  const dark = { surface: read("forge-surface"), raised: read("forge-surface-raised"), voidBg: read("forge-void") };
  for (const tier of ["forge-text", "forge-text-muted", "forge-text-faint"]) {
    it(`--${tier} clears 4.5:1 on --forge-surface, --forge-surface-raised and --forge-void`, () => {
      const color = read(tier);
      for (const [name, s] of [["--forge-surface", dark.surface], ["--forge-surface-raised", dark.raised], ["--forge-void", dark.voidBg]] as const) {
        expect(ratio(color, s), `--${tier} no llega a 4.5:1 sobre ${name}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
  it("--forge-control clears 3:1 on both dark surfaces (WCAG 1.4.11)", () => {
    for (const s of [dark.surface, dark.raised]) expect(ratio(read("forge-control"), s)).toBeGreaterThanOrEqual(3);
  });
  it("--forge-text and --forge-text-muted clear 4.5:1 on the worst atmosphere (#1e2124 mixed 10 % with white)", () => {
    const worst = mix(dark.surface, 0.1);
    for (const tier of ["forge-text", "forge-text-muted"]) expect(ratio(read(tier), worst), `--${tier} sobre la atmósfera`).toBeGreaterThanOrEqual(4.5);
  });
  const light = [read("forge-light-bg"), read("forge-light-surface"), read("forge-light-surface-2")];
  for (const tier of ["forge-light-text", "forge-light-text-muted", "forge-light-text-faint"]) {
    it(`--${tier} clears 4.5:1 on the three light surfaces`, () => {
      for (const s of light) expect(ratio(read(tier), s), `--${tier} no llega a 4.5:1 sobre ${s}`).toBeGreaterThanOrEqual(4.5);
    });
  }
  it("--forge-light-control clears 3:1 on the three light surfaces", () => {
    for (const s of light) expect(ratio(read("forge-light-control"), s)).toBeGreaterThanOrEqual(3);
  });
  it("the theme applies exactly the measured tokens (dark vars and light vars)", async () => {
    const { SUBJECT_THEMES } = await import("@/lib/subject-themes");
    const f = SUBJECT_THEMES.forge!;
    expect(f.vars).toMatchObject({
      "--text": "var(--forge-text)", "--text-muted": "var(--forge-text-muted)", "--text-faint": "var(--forge-text-faint)",
      "--surface": "var(--forge-surface)", "--surface-raised": "var(--forge-surface-raised)",
    });
    expect(f.light?.vars).toMatchObject({
      "--text": "var(--forge-light-text)", "--text-muted": "var(--forge-light-text-muted)", "--text-faint": "var(--forge-light-text-faint)",
      "--surface": "var(--forge-light-bg)", "--surface-raised": "var(--forge-light-surface)",
    });
  });
});
