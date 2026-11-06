// Live counts of the Forge console (design §14.5, RF-X5): every figure on screen comes from the read model (or the
// Atlas manifest, passed in). Pure: same read model → same numbers (CA-66 compares it with a fixture).
import type { ReadModel, ModuleRM } from "@/core/read-model";
import { nodeStatus } from "@/core/roadmap";
import { FORGE_SPINE } from "@/lib/spines-forge";
import { forgeCodeForCellId, isDiagnosticCode } from "@/forge/ids";
import type { CubeState } from "@/forge/ui/cube";

export interface ForgeConsoleStats {
  /** cells of the world by visible state */
  porEstado: Record<CubeState, number>;
  /** mastered / total per path slug */
  porRuta: Record<string, { dominadas: number; total: number }>;
  /** Forge verdicts waiting in the AI queue */
  pendientesIa: number;
  /** diagnostic cells observed, of the 8 */
  diagnosticoObservadas: number;
  /** Atlas pages from the manifest; null while it has not been read */
  atlasPaginas: number | null;
}

/** The visible state of one Forge cell, from the log (never from colour or a stored flag). */
export function forgeCellState(m: ModuleRM | undefined, readModel: ReadModel, byId: Map<string, ModuleRM>): CubeState {
  if (!m) return "sellado";
  const s = nodeStatus(m, readModel.edges, byId);
  const code = forgeCodeForCellId(m.id);
  if (code && isDiagnosticCode(code)) {
    // a diagnostic is observed, never «mastered» (§8.6): ✓ never appears on a D cell
    if (s === "completed" || s === "started") return "observado";
    return s === "sealed" ? "sellado" : "disponible";
  }
  if (s === "completed") return "dominado";
  if (s === "started") return "en-curso";
  if (s === "available") return "disponible";
  return "sellado";
}

export function forgeConsoleStats(readModel: ReadModel, atlasPaginas: number | null = null): ForgeConsoleStats {
  const byId = new Map(readModel.modules.map((m) => [m.id, m]));
  const porEstado: Record<CubeState, number> = { sellado: 0, disponible: 0, "en-curso": 0, dominado: 0, observado: 0, reprobado: 0 };
  const porRuta: Record<string, { dominadas: number; total: number }> = {};
  const firstSlug = FORGE_SPINE.paths[0]!.slug;
  let diagnosticoObservadas = 0;
  for (const cell of FORGE_SPINE.cells) {
    const slug = cell.pathSlug ?? firstSlug;
    const state = forgeCellState(byId.get(cell.id), readModel, byId);
    porEstado[state] += 1;
    const r = (porRuta[slug] ??= { dominadas: 0, total: 0 });
    r.total += 1;
    if (state === "dominado") r.dominadas += 1;
    if (state === "observado") diagnosticoObservadas += 1;
  }
  const pendientesIa = readModel.pendingAi.filter((p) => p.kind === "forge").length;
  return { porEstado, porRuta, pendientesIa, diagnosticoObservadas, atlasPaginas };
}
