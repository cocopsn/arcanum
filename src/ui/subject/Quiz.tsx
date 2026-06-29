"use client";

import { useRef, useState } from "react";
import { useActions } from "@/ui/use-actions";
import { scoreQuiz } from "@/lib/quiz";
import { readableAccent } from "@/lib/accent";
import type { QuizQuestion } from "@/lib/subject-content";

export function Quiz({
  goalId,
  moduleId,
  questions,
  accent,
}: {
  goalId: string;
  moduleId: string;
  questions: QuizQuestion[];
  accent: string;
}) {
  const { submitQuiz } = useActions();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState<{ correct: number; total: number; score: number } | null>(null);
  const submitting = useRef(false);

  if (questions.length === 0) return null;
  const q = questions[i]!;
  const chosen = answers[i];

  function choose(opt: number) {
    if (revealed) return;
    setAnswers((a) => a.map((v, idx) => (idx === i ? opt : v)));
    setRevealed(true);
  }

  async function next() {
    if (i < questions.length - 1) {
      setI(i + 1);
      setRevealed(false);
      return;
    }
    // Guard the non-idempotent submit synchronously: a rapid double-tap on "Terminar"
    // must NOT fire two checkpoint.passed (double mastery reinforcement).
    if (submitting.current || done) return;
    submitting.current = true;
    const result = scoreQuiz(questions, answers);
    setDone(result);
    await submitQuiz({ goalId, moduleId }, result.score); // → checkpoint.passed → mastery + XP
  }

  if (done) {
    const pct = Math.round(done.score * 100);
    return (
      <div role="status" aria-live="polite" className="rounded-[var(--r-md)] border border-line bg-surface p-4 text-center">
        <div className="tnum font-display text-3xl" style={{ color: accent }}>
          {done.correct}/{done.total}
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {pct >= 80 ? "Dominado. La maestría sube." : pct >= 50 ? "Vas. Reintenta lo que falló." : "El muro aguanta. Vuelve al reto y reintenta."}
        </p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-text-faint">Checkpoint registrado · +XP</p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--r-md)] border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-text-faint">
        <span>Quiz</span>
        <span className="tnum">
          {i + 1}/{questions.length}
        </span>
      </div>
      <p className="font-serif text-[15px] leading-snug text-text">{q.prompt}</p>
      <div className="mt-3 space-y-2">
        {q.options.map((opt, idx) => {
          const isAnswer = idx === q.answer;
          const wrongChosen = revealed && idx === chosen && !isAnswer;
          let cls = "border-line text-text-muted hover:border-text-faint";
          if (revealed && isAnswer) cls = "";
          else if (wrongChosen) cls = "border-amber text-amber";
          return (
            <button
              key={idx}
              onClick={() => choose(idx)}
              disabled={revealed}
              className={`flex min-h-11 w-full items-center gap-2 rounded-[var(--r-sm)] border px-3 text-left text-sm transition disabled:cursor-default ${cls}`}
              style={revealed && isAnswer ? { borderColor: accent, color: readableAccent(accent) } : undefined}
            >
              {revealed && isAnswer && <span aria-hidden>✓</span>}
              {wrongChosen && <span aria-hidden>✕</span>}
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
      {revealed && (
        <div className="mt-3">
          <p className="text-[13px] leading-snug text-text-muted">{q.rationale}</p>
          <button
            onClick={() => void next()}
            className="mt-3 min-h-11 w-full rounded-[var(--r-sm)] border px-4 text-sm transition hover:brightness-125"
            style={{ borderColor: accent, color: readableAccent(accent), background: "color-mix(in srgb, var(--surface) 88%, " + accent + ")" }}
          >
            {i < questions.length - 1 ? "Siguiente" : "Terminar quiz"}
          </button>
        </div>
      )}
    </div>
  );
}
