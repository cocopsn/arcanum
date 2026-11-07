// design poblar §10 (Fase 0): los módulos de descarga de Forge (src/forge/offline/) nunca entran al chunk de página;
// la fachada que sí vive ahí (src/lib/offline/api.ts) los carga con import(). budget-report lo comprueba sobre el
// mapa de chunks de un build; esta prueba le da un mapa armado a mano, sin build.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { evaluate } from "../../../scripts/forge/budget-report.mjs";

const PAGE = "static/chunks/app/page-0123456789abcdef.js";
const roots: string[] = [];

/** Un .next mínimo cuyo chunk de página trae `forge` según el mapa de ForgeChunkMapPlugin. */
function buildWithPage(forge: string[]): { root: string; nextDir: string } {
  const root = mkdtempSync(path.join(tmpdir(), "budget-page-"));
  roots.push(root);
  const nextDir = path.join(root, ".next");
  mkdirSync(path.join(nextDir, "static/chunks/app"), { recursive: true });
  writeFileSync(path.join(nextDir, PAGE), "/* chunk de página */\n");
  writeFileSync(path.join(nextDir, "forge-chunks.json"), JSON.stringify({ v: 1, chunks: { [PAGE]: { pagina: true, forge } }, medios: {} }));
  return { root, nextDir };
}
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

describe("budget-report · src/forge/offline/ fuera del chunk de página (poblar §10)", () => {
  it("un módulo de descarga de Forge en el chunk de página es una falla que lo nombra", () => {
    const { fallas } = evaluate(buildWithPage(["src/forge/offline/plan.ts"])) as { fallas: string[] };
    expect(fallas, "budget-report dejó pasar src/forge/offline/plan.ts en el chunk de página").toContain(
      "un evaluador de Forge entró al chunk de página: src/forge/offline/plan.ts",
    );
  });
});
