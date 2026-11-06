import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseExercisesMd } from "@/lib/exercises-md";
import snapshot from "@/lib/__fixtures__/exercises-parse-0098936.json";

// COMPATIBILITY (design §9.2): the extended parser (id:/rol: lines, dispatch to the 16 Forge types) must parse the
// 39 banks that exist at 0098936 EXACTLY as the parser of 0098936 did. The snapshot was captured with that parser
// BEFORE it was touched (2026-11-06 05:47:34, sha256[:10] f64e68fd12). Never regenerate it.

const dir = join(process.cwd(), "content", "exercises");
const files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
const snap = snapshot as Record<string, unknown>;

describe("exercises-md compat with the 0098936 parser", () => {
  it("covers the same 39 banks as the snapshot", () => {
    expect(files).toEqual(Object.keys(snap).sort());
    expect(files.length).toBe(39);
  });

  it.each(files)("%s parses identically to the 0098936 snapshot", (f) => {
    const parsed = JSON.parse(JSON.stringify(parseExercisesMd(readFileSync(join(dir, f), "utf8"))));
    expect(parsed, `el parser nuevo cambió el resultado de ${f} respecto de 0098936`).toEqual(snap[f]);
  });
});
