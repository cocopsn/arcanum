import type { ReadModel } from "@/core/read-model";
import { contentForModule } from "@/lib/subject-content";

// The adversarial EXIT GATE (WHITE ROOM). The user answers a justify-not-recognize
// question; the AI evaluator grades the justification against the cell's rubric
// (anchored to the canonical source) and DECIDES pass/fail — real power over
// progression. OFFLINE / no evaluator → the submission is ENQUEUED (ai.queued), never
// faked: the gate opens ONLY when the real evaluator judges it on reconnect. Pure.

export interface GateContext {
  cellTitle: string;
  question: string;
  rubric: string[];
  /** the learner's justification (their answer) */
  justification: string;
  /** canonical source URLs the rubric is anchored to */
  sourceRefs: string[];
}

/** Build the gate context from the log + the cell's authored gate. null if the cell
 *  has no gate (then there is nothing to evaluate). Pure. */
export function buildGateContext(rm: ReadModel, moduleId: string, justification: string): GateContext | null {
  const m = rm.modules.find((x) => x.id === moduleId);
  if (!m) return null;
  const content = contentForModule(moduleId);
  const gate = content?.gate;
  if (!gate) return null;
  return {
    cellTitle: m.title,
    question: gate.question,
    rubric: gate.rubric,
    justification: justification.trim(),
    sourceRefs: content?.sourceUrls ?? [],
  };
}
