import type { ReadModel } from "@/core/read-model";
import { cellById } from "@/lib/spines";

// The DIRECTED MISSION loop for HEAVY cells (kind:'mission'). The cell gives a concrete
// ORDER anchored to a real canonical source, BLOCKS the next node until the loop closes,
// and on the learner's return INTERROGATES the submitted evidence: the Asuka evaluator
// (Edge Function, gpt-4o-mini primary) GENERATES pointed questions against THAT mission's
// real lecture content and judges the evidence at the 0.1% standard. Only a pass opens the
// next node. OFFLINE / no interrogator → the evidence is ENQUEUED (ai.queued) AND kept durable in
// mission.submitted; the interrogation runs for real on reconnect, never faked. Pure — no clock, no I/O.

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
