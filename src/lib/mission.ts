import type { ReadModel } from "@/core/read-model";
import type { NodeNature } from "@/core/event";
import { cellById } from "@/lib/spines";
import { natureRubric } from "@/lib/gate";

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
  /** the cell's NATURE — structural: decides whether the interrogation demands a first-principle
   *  DEFENCE ('a_mano') or auditable COMPREHENSION ('delegable'). */
  nature: NodeNature;
  /** the nature's stance, handed to the interrogator so it calibrates its questions */
  natureRubric: string[];
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
  const nature: NodeNature = m.nature ?? "a_mano";
  const stance = natureRubric(nature, m.parts ?? []);
  return {
    cellTitle: m.title,
    // fold the NATURE stance INTO `assignment` — the field the interrogator (Edge) already interpolates
    // into its prompt — so nature actually CHANGES the interrogation (a_mano = defend the design;
    // delegable = prove you can direct + audit) rather than being cosmetic metadata the Edge ignores.
    assignment: `${mission.assignment}\n\nNATURALEZA DE LA CELDA — calibra así la interrogación:\n${stance.join("\n")}`,
    deliverable: mission.deliverable,
    sourceRefs: cell?.sourceUrls ?? [],
    notes: notes.trim(),
    ...(cell?.interrogationMode ? { mode: cell.interrogationMode } : {}),
    nature,
    natureRubric: stance,
  };
}
