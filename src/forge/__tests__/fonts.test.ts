import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Design §14.3: the six woff2 files are the unmodified latin files of @fontsource/ibm-plex-{sans,mono}@5.2.5, and
// SOURCES.md records each one's sha256. A replaced or re-encoded file turns this red.
const DIR = join(process.cwd(), "src", "forge", "fonts");

describe("Forge fonts (IBM Plex, OFL-1.1)", () => {
  const sources = readFileSync(join(DIR, "SOURCES.md"), "utf8");
  const files = readdirSync(DIR).filter((f) => f.endsWith(".woff2")).sort();

  it("ships exactly the six declared files", () => {
    expect(files).toEqual([
      "ibm-plex-mono-latin-400-normal.woff2",
      "ibm-plex-mono-latin-500-normal.woff2",
      "ibm-plex-sans-latin-300-normal.woff2",
      "ibm-plex-sans-latin-400-normal.woff2",
      "ibm-plex-sans-latin-500-normal.woff2",
      "ibm-plex-sans-latin-600-normal.woff2",
    ]);
  });

  it("each file's sha256 matches SOURCES.md", () => {
    for (const f of files) {
      const sha = createHash("sha256").update(readFileSync(join(DIR, f))).digest("hex");
      const row = sources.split("\n").find((l) => l.startsWith(`| ${f} |`)) ?? "";
      expect(row.includes(sha), `la fuente ${f} no coincide con SOURCES.md`).toBe(true);
    }
  });

  it("plex.ts declares the two families as local fonts without preload", () => {
    const src = readFileSync(join(DIR, "plex.ts"), "utf8");
    expect(src).toMatch(/from "next\/font\/local"/);
    expect(src).toMatch(/--font-forge-sans/);
    expect(src).toMatch(/--font-forge-mono/);
    expect((src.match(/preload: false/g) ?? []).length).toBe(2);
  });
});
