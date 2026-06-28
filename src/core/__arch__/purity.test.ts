import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walkTs(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      out = out.concat(walkTs(p));
    } else if (p.endsWith(".ts") && !p.endsWith(".test.ts")) {
      out.push(p);
    }
  }
  return out;
}

// src/core must be a pure, framework-free island: no imports from React/Next/
// Dexie/Supabase/Zustand/framer-motion, and no reaching up into the app layers
// (db/sync/store/ui/app). uuidv7 (a pure lib) is permitted.
const FORBIDDEN_PACKAGE =
  /from\s+['"](react|react-dom|next|next\/[^'"]*|dexie|@supabase\/[^'"]+|zustand|framer-motion)['"]/;
const FORBIDDEN_LAYER = /from\s+['"](@\/(db|sync|store|ui|app)\/|\.\.\/(db|sync|store|ui|app)\/)/;

describe("core purity", () => {
  it("src/core imports nothing from frameworks or app layers", () => {
    const coreDir = join(process.cwd(), "src", "core");
    let files: string[] = [];
    try {
      files = walkTs(coreDir);
    } catch {
      files = [];
    }
    const violations: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      if (FORBIDDEN_PACKAGE.test(src) || FORBIDDEN_LAYER.test(src)) {
        violations.push(file.replace(process.cwd(), ""));
      }
    }
    expect(violations).toEqual([]);
  });
});
