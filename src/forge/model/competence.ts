// ENGINEERING FORGE — the five-state competence board (design §8.4, RF-V4) and the native-domain line (§8.2).
// PURE derivations over the read model: no clock, no randomness, never a mean. Only verdicts with
// source === "ai" count (the fold already makes `passed` imply it); self-declared evidence never approves anything.
import type { ForgeVerdictRM, ReadModel } from "@/core/read-model";

export const COMPETENCE_STATES = ["no_evaluada", "en_aprendizaje", "con_apoyo", "independiente", "retenida"] as const;
export type CompetenceState = (typeof COMPETENCE_STATES)[number];

/** Text of each state (never a number: «no evaluada» is never shown as 0). */
export const COMPETENCE_LABELS: Readonly<Record<CompetenceState, string>> = {
  no_evaluada: "no evaluada",
  en_aprendizaje: "en aprendizaje",
  con_apoyo: "demostrada con apoyo",
  independiente: "demostrada independiente",
  retenida: "retenida",
};

/** An approved local verdict: scope local, source ai, passed. */
export function isApprovedLocal(v: ForgeVerdictRM): boolean {
  return v.scope === "local" && v.source === "ai" && v.passed === true;
}

/**
 * Approved retention evidence: local (source "local", outcome "correcto", and the item is `forma: codigo`, which
 * the retention runner records as `data.forma === "codigo"`) or AI-judged (`passed === true`, which the fold only
 * sets for source "ai" with a verdict that passes the rule).
 */
export function isApprovedRetention(e: ReadModel["evidence"][number]): boolean {
  if (e.type !== "retencion") return false;
  if (e.passed === true) return true;
  if (e.source !== "local" || e.outcome !== "correcto") return false;
  const d = e.data;
  return !!d && typeof d === "object" && !Array.isArray(d) && (d as Record<string, unknown>).forma === "codigo";
}

export function competenceState(cellId: string, rm: ReadModel): CompetenceState {
  const verdicts = rm.forgeVerdicts.filter((v) => v.moduleId === cellId);
  const evidence = rm.evidence.filter((e) => e.moduleId === cellId);
  const mod = rm.modules.find((m) => m.id === cellId);
  const any =
    evidence.length > 0 ||
    verdicts.length > 0 ||
    rm.missions.some((m) => m.moduleId === cellId) ||
    rm.gates.some((g) => g.moduleId === cellId) ||
    (mod?.reinforceCount ?? 0) > 0;
  if (!any) return "no_evaluada";
  // diagnostic cells record observations: they never go beyond «en aprendizaje»
  if (mod?.kind === "diagnostic") return "en_aprendizaje";
  const approved = verdicts.filter(isApprovedLocal);
  if (approved.length === 0) return "en_aprendizaje";
  const independent = approved.filter((v) => v.apoyo === "independiente");
  if (independent.length === 0) return "con_apoyo";
  const firstIndependentTs = independent[0]!.ts;
  if (evidence.some((e) => isApprovedRetention(e) && e.ts > firstIndependentTs)) return "retenida";
  return "independiente";
}

/** Counts of cells per state (the board shows counts by route and by capability; never an average, CA-36). */
export function competenceCounts(cellIds: readonly string[], rm: ReadModel): Record<CompetenceState, number> {
  const out = Object.fromEntries(COMPETENCE_STATES.map((s) => [s, 0])) as Record<CompetenceState, number>;
  for (const id of cellIds) out[competenceState(id, rm)]++;
  return out;
}

/** «dominio nativo: verificado» once at least one native verdict passed (monotonic: the list only grows);
 *  «pendiente» otherwise (CA-35). A native verdict never opens the compuerta. */
export function nativeDomain(cellId: string, rm: ReadModel): "verificado" | "pendiente" {
  return rm.forgeVerdicts.some((v) => v.moduleId === cellId && v.scope === "nativa" && v.source === "ai" && v.passed === true)
    ? "verificado"
    : "pendiente";
}
