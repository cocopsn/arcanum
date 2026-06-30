import type { ReadModel } from "@/core/read-model";
import { cellById } from "@/lib/spines";
import { contentForModule } from "@/lib/subject-content";

// Capa B — on-demand LIGHT lessons (the "infinite" layer). The tutor generates a short
// first-principle lesson + a challenge against the cell's REAL source, and grades the answer
// fairly (reinforces mastery via checkpoint.passed — NOT the 0.1% exit gate). Nothing is
// invented: without AI there is no lesson (honest), and the real source still works offline.
// Pure — no clock, no I/O.

export interface LessonContext {
  cellTitle: string;
  /** REAL canonical source URLs the lesson is anchored to */
  sourceRefs: string[];
}

export interface LessonGradeContext {
  cellTitle: string;
  challenge: string;
  rubric: string[];
  answer: string;
}

/** Build the generate-context for a light lesson, or null if the cell has no real source to
 *  anchor to (then there is nothing honest to teach against). Pure. */
export function buildLessonContext(rm: ReadModel, moduleId: string): LessonContext | null {
  const m = rm.modules.find((x) => x.id === moduleId);
  if (!m) return null;
  const content = contentForModule(moduleId);
  const sourceRefs = content?.sourceUrls ?? cellById(moduleId)?.sourceUrls ?? [];
  if (sourceRefs.length === 0) return null;
  return { cellTitle: m.title, sourceRefs };
}

/** Build the grade-context once the learner has answered the generated challenge. Pure. */
export function buildLessonGradeContext(
  cellTitle: string,
  challenge: string,
  rubric: string[],
  answer: string,
): LessonGradeContext {
  return { cellTitle, challenge, rubric, answer: answer.trim() };
}
