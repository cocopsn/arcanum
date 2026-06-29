import type { ReadModel } from "@/core/read-model";
import { contentForModule } from "@/lib/subject-content";

// The adversarial EXIT GATE (WHITE ROOM). The user answers a justify-not-recognize
// question; the AI evaluator grades the justification against the cell's rubric
// (anchored to the canonical source) and DECIDES pass/fail — real power over
// progression. The local heuristic NEVER auto-passes: it is honest that the gate
// requires the evaluator. Pure.

export interface GateContext {
  cellTitle: string;
  question: string;
  rubric: string[];
  /** the learner's justification (their answer) */
  justification: string;
  /** canonical source URLs the rubric is anchored to */
  sourceRefs: string[];
}

export interface GateVerdict {
  passed: boolean;
  score: number;
  summary: string;
  feedback: string;
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

/**
 * Honest fallback when the evaluator (AI) is unavailable. It does NOT open the gate
 * — only the rubric-anchored evaluator can. Anti-gaming: a trivially short or empty
 * justification is rejected outright; otherwise it explains the gate needs the
 * evaluator (offline, the reto + content still work; progression via this gate waits).
 */
export function heuristicGate(ctx: GateContext): GateVerdict {
  const words = ctx.justification.trim().split(/\s+/).filter(Boolean).length;
  if (words < 12) {
    return {
      passed: false,
      score: 0,
      summary: "Insuficiente.",
      feedback:
        "Una justificación de primer principio no cabe en una línea. Argumenta el PORQUÉ desde la invariante/recurrencia, no el qué.",
    };
  }
  return {
    passed: false,
    score: 0,
    summary: "Requiere el evaluador.",
    feedback:
      "La compuerta no se abre sola: tu justificación necesita ser calificada por el evaluador adversarial (IA) contra la rúbrica de la fuente. Sin sesión/IA queda pendiente — el reto y el contenido canónico funcionan offline.",
  };
}
