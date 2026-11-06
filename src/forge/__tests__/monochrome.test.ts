import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { SUBJECT_THEMES, type WorldTheme } from "@/lib/subject-themes";
import { MONO_PRISM } from "@/lib/prism-mono";

// D4 — «nada salmón, blanco negro carbón místico»: NO chromatic colour in Forge's interface. Chroma = max − min of
// R, G, B (0-255); the D4 scale reaches 6 at #1e2124, so every colour must be ≤ 6. Third-party content (figures,
// videos) is not interface and is not scanned.
const MAX_CHROMA = 6;
const ROOT = process.cwd();

function chromaOf(color: string): number | null {
  const c = color.trim().toLowerCase();
  let m = c.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1]!;
    if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split("").map((x) => x + x).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return Math.max(...rgb) - Math.min(...rgb);
  }
  m = c.match(/^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/);
  if (m) {
    const rgb = [m[1], m[2], m[3]].map(Number);
    return Math.max(...rgb) - Math.min(...rgb);
  }
  return null;
}
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;
const colorsIn = (s: string) => s.match(COLOR_LITERAL) ?? [];

function chromatic(where: string, values: Iterable<string>): string[] {
  const bad: string[] = [];
  for (const v of values) for (const lit of colorsIn(v)) {
    const k = chromaOf(lit);
    if (k !== null && k > MAX_CHROMA) bad.push(`color cromático en la interfaz de Forge: ${lit} en ${where}`);
  }
  return bad;
}

function themeValues(t: WorldTheme): string[] {
  const out = [t.accent, t.accent2, t.glow, t.bg, t.bg2, t.fog, ...Object.values(t.vars ?? {})];
  return t.light ? [...out, ...themeValues(t.light)] : out;
}

function walk(dir: string, exts: string[]): string[] {
  if (!existsSync(dir)) return [];
  let out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out = out.concat(walk(p, exts));
    else if (exts.some((x) => p.endsWith(x)) && !/\.test\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const globals = existsSync(join(ROOT, "src", "app", "globals.css")) ? readFileSync(join(ROOT, "src", "app", "globals.css"), "utf8") : "";
const bodyBlock = globals.match(/body\[data-world="forge"\]\s*\{([^}]*)\}/)?.[1] ?? null;

describe("monochrome (D4)", () => {
  it("every --forge-* token has chroma ≤ 6", () => {
    const tokens = readFileSync(join(ROOT, "src", "styles", "tokens.css"), "utf8");
    const forge = [...tokens.matchAll(/--forge-[a-z0-9-]+:\s*([^;]+);/g)].map((m) => m[1]!);
    expect(forge.length).toBeGreaterThanOrEqual(19);
    const badT = chromatic("tokens.css", forge);
    expect(badT, badT.join("; ")).toEqual([]);
  });

  it("SUBJECT_THEMES.forge (with vars and light) and MONO_PRISM have no chromatic colour", () => {
    const f = SUBJECT_THEMES.forge!;
    expect(f.monochrome).toBe(true);
    expect(f.light?.monochrome).toBe(true);
    const badTheme = chromatic("subject-themes.ts", themeValues(f));
    expect(badTheme, badTheme.join("; ")).toEqual([]);
    const prism = [MONO_PRISM.plain.color ?? "", MONO_PRISM.plain.backgroundColor ?? "", ...MONO_PRISM.styles.map((s) => String(s.style.color ?? ""))];
    const badPrism = chromatic("prism-mono.ts", prism);
    expect(badPrism, badPrism.join("; ")).toEqual([]);
    expect(prism.filter((c) => c && c !== "transparent").every((c) => /^var\(--text(-muted|-faint)?\)$/.test(c))).toBe(true);
  });

  it("every colour literal in src/forge/ui/**, src/ui/media/** and src/forge/**/*.css has chroma ≤ 6", () => {
    const files = [
      ...walk(join(ROOT, "src", "forge", "ui"), [".ts", ".tsx", ".css"]),
      ...walk(join(ROOT, "src", "ui", "media"), [".ts", ".tsx", ".css"]),
      ...walk(join(ROOT, "src", "forge"), [".css"]),
    ];
    const bad = files.flatMap((f) => chromatic(f.replace(ROOT, ""), [readFileSync(f, "utf8")]));
    expect(bad, bad.join("; ")).toEqual([]);
  });

  it.skipIf(bodyBlock === null)("the body[data-world=\"forge\"] block of globals.css only uses var(--forge-*) and mirrors vars", () => {
    const decls = [...(bodyBlock ?? "").matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()] as const);
    for (const [, v] of decls) expect(v, "el bloque de body usa un valor propio en vez de un token --forge-*").toMatch(/^var\(--forge-[a-z0-9-]+\)$/);
    const vars = SUBJECT_THEMES.forge!.vars ?? {};
    for (const [k, v] of decls) if (k in vars && vars[k]!.startsWith("var(--forge-")) expect(v, k).toBe(vars[k]);
  });
});
