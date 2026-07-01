import type { ReadModel } from "@/core/read-model";
import { ARCANUM_CONFIG } from "@/core/config";
import { angleAt } from "@/lib/lesson-angles";
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
  /** how many steps the tutor should aim for (config — the single source of the count) */
  stepsMin: number;
  stepsMax: number;
  /** the ANGLE this lesson takes (rotates by reinforceCount) so course/depth/review never repeat */
  angle: string;
}

export interface LessonGradeContext {
  cellTitle: string;
  challenge: string;
  rubric: string[];
  answer: string;
}

/** Build the generate-context for a light lesson, or null if the cell has no real source to
 *  anchor to (then there is nothing honest to teach against). Pure. */
export function buildLessonContext(rm: ReadModel, moduleId: string, angleIndex = 0): LessonContext | null {
  const m = rm.modules.find((x) => x.id === moduleId);
  if (!m) return null;
  const content = contentForModule(moduleId);
  const sourceRefs = content?.sourceUrls ?? cellById(moduleId)?.sourceUrls ?? [];
  if (sourceRefs.length === 0) return null;
  return {
    cellTitle: m.title,
    sourceRefs,
    stepsMin: ARCANUM_CONFIG.lesson.stepsMin,
    stepsMax: ARCANUM_CONFIG.lesson.stepsMax,
    angle: angleAt(angleIndex),
  };
}

/** Build the grade-context once the learner has answered a generated challenge (one step). Pure. */
export function buildLessonGradeContext(
  cellTitle: string,
  challenge: string,
  rubric: string[],
  answer: string,
): LessonGradeContext {
  return { cellTitle, challenge, rubric, answer: answer.trim() };
}

// ── The step-by-step lesson (the full-screen mode) ───────────────────────────────────────────
// A lesson is a SEQUENCE of micro-challenges generated against the cell's real source. One
// concept framing + N steps, each a prompt + rubric the grader scores. Same source-anchoring
// rule (no invented facts); without AI there is no lesson (honest).

export interface LessonStep {
  /** the micro-challenge (justify / complete / implement / produce — never trivial recognition) */
  prompt: string;
  /** 2-4 criteria of a good answer, fed to the grader */
  rubric: string[];
}

export interface LessonCourse {
  /** the concept framing (markdown), taught from first principle */
  concept: string;
  steps: LessonStep[];
}

/** Validate + normalize a raw lesson-course payload from the tutor. Drops malformed steps; returns
 *  null when there is no concept or no usable step (→ the UI degrades honestly, no invented lesson).
 *  Pure — the single place the wire shape is trusted, so it is unit-testable without the network. */
export function normalizeLessonCourse(raw: unknown): LessonCourse | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { concept?: unknown; steps?: unknown };
  const concept = typeof o.concept === "string" ? o.concept.trim() : "";
  const steps: LessonStep[] = Array.isArray(o.steps)
    ? o.steps
        .map((s) => {
          const step = s as { prompt?: unknown; rubric?: unknown };
          return {
            prompt: typeof step?.prompt === "string" ? step.prompt.trim() : "",
            rubric: Array.isArray(step?.rubric) ? step.rubric.map((r) => String(r)) : [],
          };
        })
        .filter((s) => s.prompt.length > 0)
    : [];
  if (!concept || steps.length === 0) return null;
  return { concept, steps };
}
