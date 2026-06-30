import type { ReadModel } from "@/core/read-model";
import { cellById } from "@/lib/spines";

// The DIRECTED MISSION loop for HEAVY cells (kind:'mission'). The cell gives a concrete
// ORDER anchored to a real canonical source, BLOCKS the next node until the loop closes,
// and on the learner's return INTERROGATES the submitted evidence: the Asuka evaluator
// (Edge Function, gpt-4o-mini primary) GENERATES pointed questions against THAT mission's
// real lecture content and judges the evidence at the 0.1% standard. Only a pass opens the
// next node. The local heuristic NEVER auto-passes (honest: it requires the interrogator).
// Pure — no clock, no I/O.

export interface MissionAssignment {
  /** the concrete order, with a deliverable, anchored to the real source */
  assignment: string;
  /** what the learner must bring back as evidence */
  deliverable: string;
}

export interface InterrogationContext {
  cellTitle: string;
  assignment: string;
  deliverable: string;
  /** canonical source URLs the mission is anchored to (real, extracted) */
  sourceRefs: string[];
  /** the learner's submitted evidence (their own notes + reflections) */
  notes: string;
  /** interrogation calibration: 'pattern' (competitive ICPC) vs first-principle (absent) */
  mode?: "pattern";
}

export interface InterrogationVerdict {
  /** the pointed questions the interrogator generated against the real lecture */
  questions: string[];
  passed: boolean;
  score: number;
  summary: string;
  feedback: string;
}

/** The mission authored on this cell, or null if it is not a heavy mission cell. Pure. */
export function missionForModule(moduleId: string): MissionAssignment | null {
  return cellById(moduleId)?.mission ?? null;
}

/**
 * Build the interrogation context from the log + the cell's authored mission. Returns
 * null when the cell carries no mission (nothing to interrogate). The notes are the
 * learner's returned evidence (trimmed). Pure.
 */
export function buildInterrogationContext(
  rm: ReadModel,
  moduleId: string,
  notes: string,
): InterrogationContext | null {
  const m = rm.modules.find((x) => x.id === moduleId);
  if (!m) return null;
  const cell = cellById(moduleId);
  const mission = cell?.mission;
  if (!mission) return null;
  return {
    cellTitle: m.title,
    assignment: mission.assignment,
    deliverable: mission.deliverable,
    sourceRefs: cell?.sourceUrls ?? [],
    notes: notes.trim(),
    ...(cell?.interrogationMode ? { mode: cell.interrogationMode } : {}),
  };
}

/**
 * Honest fallback when the interrogator (AI) is unavailable. It does NOT open the gate —
 * only the adversarial interrogator can. Anti-gaming: empty/trivial evidence is rejected
 * outright (a mission demands real proof of work, more than a one-liner); otherwise it
 * explains the interrogation needs the evaluator. The submitted notes are still logged.
 */
export function heuristicInterrogation(ctx: InterrogationContext): InterrogationVerdict {
  const words = ctx.notes.split(/\s+/).filter(Boolean).length;
  if (words < 25) {
    return {
      questions: [],
      passed: false,
      score: 0,
      summary: "Evidencia insuficiente.",
      feedback:
        "Entregaste muy poco para probar que viviste la misión. Trae TUS notas y reflexiones sustanciales sobre la fuente real — no una línea ni un resumen genérico.",
    };
  }
  return {
    questions: [],
    passed: false,
    score: 0,
    summary: "Requiere el interrogador.",
    feedback:
      "El interrogatorio no se abre solo: tus notas deben ser interrogadas por el evaluador adversarial (IA) contra el contenido real de la misión. Sin sesión/IA queda pendiente — la asignación y la fuente funcionan offline, y tu evidencia SE GUARDA en el log.",
  };
}
