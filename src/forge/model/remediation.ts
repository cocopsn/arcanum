// ENGINEERING FORGE — remediation by failure mode (design §8.1 table, §8.5, RF-V5, CA-37). PURE: no clock.
// After two failed local AI verdicts of the same cell with the same non-null failure mode (counted after the last
// fulfilled remediation, deduplicated by queueId), the cell asks for the intervention of §05 before a third attempt.
// It is fulfilled ONLY by evidence written after the second failure:
//   1. a local, correct evidence.recorded of a bank item whose type is in the «Remedia» column of the mode; or,
//   2. when the bank has no item of those types, the completed light lesson (itemId "leccion-ligera",
//      type "remediacion", phase "leccion", outcome "correcto", source "ai").
// No checkpoint.passed fulfils it: bank successes, the production self-attestation and the quiz all emit one, and
// a self-attestation never approves anything (§7.4).
import { compareEvents } from "@/core/event";
import type { ForgeFailureMode } from "@/core/forge-verdict";
import type { EvidenceRM, ForgeVerdictRM, ReadModel } from "@/core/read-model";

export interface FailureModeInfo {
  /** «Diagnóstico» of §05 */
  diagnostico: string;
  /** «Intervención» shown to the learner */
  intervencion: string;
  /** evidence types that remedy it («Remedia», §8.1) */
  remedia: readonly string[];
}

export const FAILURE_MODE_INFO: Readonly<Record<ForgeFailureMode, FailureModeInfo>> = {
  concepto: {
    diagnostico: "Falta un concepto",
    intervencion: "Ejemplo pequeño, dibujo, contraste con un contraejemplo",
    remedia: ["contraejemplo", "desvanecido", "ontologia"],
  },
  ejecucion: {
    diagnostico: "Enfoque correcto, ejecución defectuosa",
    intervencion: "Trazas, tests y práctica del componente que falla",
    remedia: ["code", "mutantes", "historial", "sql", "forense"],
  },
  patron: {
    diagnostico: "No identifica el patrón",
    intervencion: "Problemas contrastados con señales parecidas",
    remedia: ["senal"],
  },
  tutorial: {
    diagnostico: "Dependencia del tutorial",
    intervencion: "Retirar apoyo gradualmente y cambiar el dominio",
    remedia: ["desvanecido"],
  },
  defensa: {
    diagnostico: "Funciona pero no lo puede defender",
    intervencion: "Revisión de código y reconstrucción de invariantes",
    remedia: ["historial", "production", "ontologia", "permisos"],
  },
  happy_path: {
    diagnostico: "Sólo funciona en happy path",
    intervencion: "Fallas parciales e inputs adversariales",
    remedia: ["historial", "mutantes", "contraejemplo", "forense", "recuperacion", "gameday"],
  },
  priorizacion: {
    diagnostico: "Mala priorización",
    intervencion: "Repetir discovery y escoger una vertical más pequeña",
    remedia: ["entrevista", "production", "gameday"],
  },
  olvido: {
    diagnostico: "Olvido diferido",
    intervencion: "Reintroducir recuperación y revisar la carga",
    remedia: ["prediccion"],
  },
};

export const LIGHT_LESSON_ITEM_ID = "leccion-ligera";

export interface RemediationRequired {
  mode: ForgeFailureMode;
  intervencion: string;
  diagnostico: string;
  /** "banco": a bank item of a remedying type is required; "leccion": the light lesson is */
  via: "banco" | "leccion";
  /** the remedying types present in the cell's bank (empty with via "leccion") */
  tipos: string[];
}

/** Failed local AI verdicts of the cell, in fold order, counting once each queueId (first wins: the same queued
 *  submission drained by two devices is ONE failure). */
function failedLocal(cellId: string, verdicts: readonly ForgeVerdictRM[]): ForgeVerdictRM[] {
  const seen = new Set<string>();
  const out: ForgeVerdictRM[] = [];
  for (const v of verdicts) {
    if (v.moduleId !== cellId || v.scope !== "local" || v.source !== "ai" || v.passed) continue;
    if (v.queueId) {
      if (seen.has(v.queueId)) continue;
      seen.add(v.queueId);
    }
    out.push(v);
  }
  return out;
}

function fulfils(e: EvidenceRM, cellId: string, mode: ForgeFailureMode, bankTypes: ReadonlySet<string>): boolean {
  if (e.moduleId !== cellId) return false;
  const remedy = FAILURE_MODE_INFO[mode].remedia.filter((t) => bankTypes.has(t));
  if (remedy.length > 0) return e.source === "local" && e.outcome === "correcto" && remedy.includes(e.type);
  return (
    e.itemId === LIGHT_LESSON_ITEM_ID && e.type === "remediacion" && e.phase === "leccion" && e.outcome === "correcto" && e.source === "ai"
  );
}

/**
 * The pending remediation of a cell, or null. `bankItemTypes` are the types of the items of the cell's bank
 * (empty when the cell has no bank on this device: then only the light lesson can fulfil it).
 */
export function remediationRequired(cellId: string, rm: ReadModel, bankItemTypes: readonly string[]): RemediationRequired | null {
  const bankTypes = new Set(bankItemTypes);
  type Step = { kind: "v"; v: ForgeVerdictRM } | { kind: "e"; e: EvidenceRM };
  const steps: (Step & { ts: number; id: string })[] = [
    ...failedLocal(cellId, rm.forgeVerdicts).map((v) => ({ kind: "v" as const, v, ts: v.ts, id: v.eventId })),
    ...rm.evidence.filter((e) => e.moduleId === cellId).map((e) => ({ kind: "e" as const, e, ts: e.ts, id: e.id })),
  ].sort(compareEvents);
  let failed: ForgeVerdictRM[] = [];
  let pending: ForgeFailureMode | null = null;
  for (const s of steps) {
    if (s.kind === "v") {
      failed.push(s.v);
      const [a, b] = failed.slice(-2);
      pending = a && b && a.failureMode !== null && a.failureMode === b.failureMode ? a.failureMode : null;
      continue;
    }
    if (pending && fulfils(s.e, cellId, pending, bankTypes)) {
      // fulfilled: the failures before it no longer count
      failed = [];
      pending = null;
    }
  }
  if (!pending) return null;
  const info = FAILURE_MODE_INFO[pending];
  const tipos = info.remedia.filter((t) => bankTypes.has(t));
  return { mode: pending, intervencion: info.intervencion, diagnostico: info.diagnostico, via: tipos.length > 0 ? "banco" : "leccion", tipos };
}
