import type { QuizQuestion } from "@/lib/subject-content";

export interface QuizResult {
  correct: number;
  total: number;
  /** correct / total ∈ [0,1] — feeds checkpoint.passed → mastery */
  score: number;
}

/** Pure scoring. `answers[i]` is the chosen option index, or null if unanswered. */
export function scoreQuiz(questions: QuizQuestion[], answers: (number | null)[]): QuizResult {
  const total = questions.length;
  let correct = 0;
  for (let i = 0; i < total; i++) {
    if (answers[i] != null && answers[i] === questions[i]!.answer) correct++;
  }
  return { correct, total, score: total === 0 ? 0 : correct / total };
}
