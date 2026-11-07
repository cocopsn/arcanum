// design poblar §6.10 (lives in src/app/ and not in src/forge/__tests__/: brand-icons.test.ts keeps icon paths out of src/forge/, D4): budget-report fails when an emitted file of .next/static or a brand icon with ?v= is missing
// from the precache of public/sw.js, naming it. Fixtures armed by hand, no build. Red-checks in
// redchecks-offline-motor.md (removing each check).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { evaluate } from "../../scripts/forge/budget-report.mjs";

const PAGE = "static/chunks/app/page-0123456789abcdef.js";
const CHUNK = "static/chunks/4512-aaaaaaaaaaaaaaaa.js";
const ICON = "/icons/icon-192.png?v=af8f4bcc6d";
const roots: string[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

function fixture(precached: string[]) {
  const root = mkdtempSync(path.join(tmpdir(), "budget-precache-"));
  roots.push(root);
  const nextDir = path.join(root, ".next");
  mkdirSync(path.join(nextDir, "static/chunks/app"), { recursive: true });
  writeFileSync(path.join(nextDir, PAGE), "/* página */\n");
  writeFileSync(path.join(nextDir, CHUNK), "/* chunk */\n");
  writeFileSync(path.join(nextDir, "forge-chunks.json"), JSON.stringify({ v: 1, chunks: { [PAGE]: { pagina: true, forge: [] } }, medios: {} }));
  mkdirSync(path.join(root, "public"), { recursive: true });
  // what Serwist writes: self.__SW_MANIFEST = [{ url: "...", revision: ... }, ...]
  writeFileSync(path.join(root, "public/sw.js"), `self.__SW_MANIFEST=[${precached.map((u) => `{url:"${u}",revision:null}`).join(",")}];`);
  return { root, nextDir };
}
const all = ["/_next/" + PAGE, "/_next/" + CHUNK, ICON];
const fallasOf = (precached: string[]) => (evaluate({ ...fixture(precached), iconUrls: [ICON] }) as { fallas: string[] }).fallas;

describe("budget-report · precache completo (poblar §6.10)", () => {
  it("con todo en el manifiesto no hay fallas de precache", () => {
    expect(fallasOf(all).filter((f) => /precache/.test(f))).toEqual([]);
  });
  it("un archivo emitido que no está en el sw.js es una falla que lo nombra", () => {
    expect(fallasOf(all.filter((u) => !u.endsWith(CHUNK))), "budget-report dejó pasar un chunk fuera del precache").toContain(
      `un archivo de .next/static quedó fuera del precache: ${CHUNK}`,
    );
  });
  it("un ícono con ?v= que no está en el sw.js (sin la línea de manifestTransforms) es una falla que lo nombra", () => {
    expect(fallasOf(all.filter((u) => u !== ICON)), "budget-report dejó pasar un ícono con ?v= fuera del precache").toContain(
      `el ícono ${ICON} no está en el precache`,
    );
  });
  it("por omisión toma los íconos de brandIconPrecacheEntries() del repo", () => {
    const { fallas } = evaluate(fixture(all)) as { fallas: string[] };
    // the fixture precaches only icon-192 (with the repo's real ?v=): the other five brand icons are missing
    expect(fallas.filter((f) => f.startsWith("el ícono ")).length).toBe(5);
  });
});
