import { describe, it, expect } from "vitest";
import { PROCEDURAL_TEMPLATES, generateVariant, mulberry32 } from "@/lib/procedural";
import { execCode } from "@/lib/js-runner";
import { deepEqual } from "@/lib/exercise";

describe("procedural — Layer 2 honest infinite variants", () => {
  it("every template's JS reference solution PASSES its own generated cases (self-consistent, never faked)", () => {
    for (const t of PROCEDURAL_TEMPLATES) {
      const ex = t.generate(mulberry32(123), "js");
      const out = execCode(ex.referenceSolution, ex.functionName, ex.testCases.map((c) => c.input));
      expect("results" in out, `${t.id}: ref parses`).toBe(true);
      if ("results" in out) {
        ex.testCases.forEach((c, i) => {
          const r = out.results[i]!;
          expect(r.ok && deepEqual(r.value, c.expected), `${t.id} case ${i}: ${JSON.stringify(c)}`).toBe(true);
        });
      }
    }
  });

  it("different seeds produce DIFFERENT variants (never repeats); same seed reproduces (deterministic)", () => {
    const a = generateVariant("reverse-array", "js", 1)!;
    const b = generateVariant("reverse-array", "js", 999)!;
    const a2 = generateVariant("reverse-array", "js", 1)!;
    expect(JSON.stringify(a.testCases)).not.toBe(JSON.stringify(b.testCases));
    expect(JSON.stringify(a.testCases)).toBe(JSON.stringify(a2.testCases));
  });

  it("each variant gets a UNIQUE id per (seed, lang) so a keyed consumer remounts (no stale passed state)", () => {
    const a = generateVariant("reverse-array", "js", 1)!;
    const b = generateVariant("reverse-array", "js", 999)!;
    const py = generateVariant("reverse-array", "python", 1)!;
    expect(a.id).not.toBe(b.id); // different seed → different id → React key changes → remount
    expect(a.id).not.toBe(py.id); // different lang → different id too
    expect(generateVariant("reverse-array", "js", 1)!.id).toBe(a.id); // deterministic for the same inputs
  });

  it("includes edge cases (empty + single element) — 0.1% rigor, not just the happy path", () => {
    const ex = generateVariant("reverse-array", "js", 7)!;
    const lens = ex.testCases.map((c) => (c.input[0] as unknown[]).length);
    expect(lens).toContain(0);
    expect(lens).toContain(1);
  });

  it("never leaks the implementation in the starter (only the signature + TODO)", () => {
    for (const t of PROCEDURAL_TEMPLATES) {
      const ex = t.generate(mulberry32(5), "js");
      expect(ex.starter).toMatch(/tu código/);
      expect(ex.starter).not.toContain("return [...a].reverse()"); // no implementation given
    }
  });
});
