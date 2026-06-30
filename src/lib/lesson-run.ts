// The LESSON RUN — the pure state machine behind the full-screen step-by-step lesson. Hearts +
// amor fati: a wrong answer costs a heart AND drops the learner into a CORRECTION (understand the
// error, then fix it) before they may advance; resolving it banks an insight. Losing every heart
// is not a wall — it resets the attempt (another turn of the iterative cycle), the insights already
// resolved standing in the log. Pure (no clock, no I/O, no randomness) → fully unit-testable; the
// component just plays the returned EFFECTS (sounds + events) and renders the next state.

export type RunPhase =
  | "answering" // showing a step's challenge, awaiting a first answer
  | "correcting" // the answer missed → understand WHY, then re-answer (amor fati)
  | "passed" // every step cleared → lesson superada
  | "failed"; // hearts exhausted → offer another turn

export interface LessonRun {
  /** number of steps in the lesson */
  total: number;
  /** index of the step the learner is on (== total once passed) */
  current: number;
  /** hearts left in THIS attempt */
  hearts: number;
  /** hearts an attempt starts with (config) */
  maxHearts: number;
  phase: RunPhase;
  /** corrections resolved THIS attempt (cosmetic; the log's error.resolved events are the truth) */
  insights: number;
  /** attempt number, 1-based — a total failure increments it (the "second turn knows where it tripped") */
  round: number;
}

export type RunInput =
  | { type: "graded"; understood: boolean } // verdict on a first answer (valid in "answering")
  | { type: "corrected"; understood: boolean } // verdict on a correction (valid in "correcting")
  | { type: "restart" }; // take another turn after a total failure (valid in "failed")

export type RunEffect =
  | "advance" // moved to the next step
  | "loseHeart" // a heart was spent
  | "enterCorrection" // dropped into the correction of the current step
  | "resolveInsight" // a correction landed → fire error.resolved
  | "passLesson" // the final step cleared → fire checkpoint.passed
  | "failLesson" // the last heart was spent
  | "restart"; // the attempt reset

export function initRun(total: number, maxHearts: number): LessonRun {
  const t = Math.max(0, Math.floor(total));
  const h = Math.max(1, Math.floor(maxHearts));
  return {
    total: t,
    current: 0,
    hearts: h,
    maxHearts: h,
    phase: t > 0 ? "answering" : "passed",
    insights: 0,
    round: 1,
  };
}

/** Advance off a cleared step (shared by a clean pass and a resolved correction). */
function clearStep(state: LessonRun, extraInsight: boolean): { next: LessonRun; effects: RunEffect[] } {
  const nextIdx = state.current + 1;
  const insights = state.insights + (extraInsight ? 1 : 0);
  const done = nextIdx >= state.total;
  const lead: RunEffect[] = extraInsight ? ["resolveInsight"] : [];
  return {
    next: { ...state, current: nextIdx, insights, phase: done ? "passed" : "answering" },
    effects: done ? [...lead, "passLesson"] : [...lead, "advance"],
  };
}

/** Spend a heart; either drop to correction (still hearts left) or fail the attempt. */
function spendHeart(state: LessonRun, onSurvive: RunEffect[]): { next: LessonRun; effects: RunEffect[] } {
  const hearts = state.hearts - 1;
  if (hearts <= 0) {
    return { next: { ...state, hearts: 0, phase: "failed" }, effects: ["loseHeart", "failLesson"] };
  }
  return { next: { ...state, hearts, phase: "correcting" }, effects: ["loseHeart", ...onSurvive] };
}

/** The reducer. Inputs valid only in their phase; anything else is a no-op (returns state, no effects). */
export function reduceRun(state: LessonRun, input: RunInput): { next: LessonRun; effects: RunEffect[] } {
  switch (input.type) {
    case "graded":
      if (state.phase !== "answering") break;
      return input.understood ? clearStep(state, false) : spendHeart(state, ["enterCorrection"]);
    case "corrected":
      if (state.phase !== "correcting") break;
      // a landed correction clears the SAME step and banks an insight; a miss costs another heart but
      // stays in correction (you don't escape the error) until understood or hearts run out.
      if (input.understood) return clearStep(state, true);
      return spendHeart(state, []); // onSurvive empty → remains "correcting" with fresh feedback
    case "restart":
      if (state.phase !== "failed") break;
      return {
        next: { ...state, current: 0, hearts: state.maxHearts, phase: "answering", insights: 0, round: state.round + 1 },
        effects: ["restart"],
      };
  }
  return { next: state, effects: [] };
}
