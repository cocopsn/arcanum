"use client";

import { useEffect, useRef, useState } from "react";
import { useActions } from "@/ui/use-actions";
import { readableAccent } from "@/lib/accent";
import type { LessonDraft, LessonGrade } from "@/sync/ai";

// Capa B — the on-demand LIGHT lesson (10-25 min). The tutor generates a short first-principle
// lesson + a challenge against the cell's REAL source; the answer is graded fairly and reinforces
// mastery (checkpoint.passed). Without AI there is NO lesson (honest — no invented content); the
// real source still works. Visual language reused from MissionPanel/ExitGate (no redesign).

export function LessonPanel({
  moduleId,
  goalId,
  cellTitle,
  sourceUrls,
  accent,
}: {
  moduleId: string;
  goalId: string;
  cellTitle: string;
  sourceUrls: string[];
  accent: string;
}) {
  const { generateLesson, gradeLesson } = useActions();
  const [draft, setDraft] = useState<LessonDraft | null>(null);
  const [noAi, setNoAi] = useState(false);
  const [answer, setAnswer] = useState("");
  const [grade, setGrade] = useState<LessonGrade | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [gradeBusy, setGradeBusy] = useState(false);
  const gen = useRef(false);
  const grading = useRef(false);
  const answerRef = useRef<HTMLTextAreaElement>(null);

  // When the draft mounts, the focused "Generar lección" button unmounts — move focus to the
  // answer textarea (the natural next step) so keyboard/SR focus stays inside the dialog.
  useEffect(() => {
    if (draft) answerRef.current?.focus();
  }, [draft]);

  async function generate() {
    if (gen.current) return;
    gen.current = true;
    setGenBusy(true);
    setNoAi(false);
    setGrade(null);
    setAnswer("");
    try {
      const d = await generateLesson(moduleId);
      if (d) setDraft(d);
      else {
        setDraft(null);
        setNoAi(true); // honest: no AI → no invented lesson
      }
    } finally {
      gen.current = false;
      setGenBusy(false);
    }
  }

  async function evaluate() {
    if (!draft || !answer.trim() || grading.current) return;
    grading.current = true;
    setGradeBusy(true);
    try {
      const g = await gradeLesson({ goalId, moduleId }, cellTitle, draft.challenge, draft.rubric, answer);
      setGrade(g); // null → no AI; UI says so honestly (no placebo reinforcement)
    } finally {
      grading.current = false;
      setGradeBusy(false);
    }
  }

  return (
    <div className="rounded-[var(--r-md)] border border-line p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xs uppercase tracking-[0.22em] text-text-faint">Lección corta · Capa B</h3>
        <span className="text-[10px] uppercase tracking-wider text-text-faint">10–25 min</span>
      </div>
      <p className="mt-1 text-[12px] leading-snug text-text-muted">
        Un concepto de la fuente real + un reto evaluado. Refuerza tu maestría sin la misión completa.
      </p>

      {!draft && (
        <>
          <button
            onClick={() => void generate()}
            disabled={genBusy}
            aria-busy={genBusy}
            className="mt-3 min-h-11 w-full rounded-[var(--r-sm)] border px-4 text-sm transition hover:brightness-125 disabled:opacity-40"
            style={{ borderColor: accent, color: readableAccent(accent) }}
          >
            {genBusy ? "Generando…" : "Generar lección"}
          </button>
          <span className="sr-only" role="status" aria-live="polite">
            {genBusy ? "Generando la lección…" : ""}
          </span>
          {noAi && (
            <div role="status" aria-live="polite" className="mt-2 text-[12px] leading-snug text-text-muted">
              La lección corta requiere el generador (IA) y una sesión iniciada. Sin IA queda pendiente — abre la
              fuente real y trabaja directo (cero contenido inventado):
              {sourceUrls[0] && (
                <a
                  href={sourceUrls[0]}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-1 block min-h-11 py-2 text-[13px] transition hover:underline"
                  style={{ color: readableAccent(accent) }}
                >
                  {sourceUrls[0].replace(/^https?:\/\//, "").slice(0, 48)} ↗
                </a>
              )}
            </div>
          )}
        </>
      )}

      {draft && (
        <div className="mt-3 space-y-3">
          <div className="rounded-[var(--r-sm)] border border-line bg-surface p-3">
            <h4 className="text-[10px] uppercase tracking-[0.2em] text-text-faint">El concepto</h4>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-text">{draft.concept}</p>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-text-faint">vía IA · {draft.provider}</div>
          </div>
          <div>
            <h4 className="text-[10px] uppercase tracking-[0.2em] text-text-faint">El reto</h4>
            <p className="mt-1 font-serif text-[14px] leading-snug text-text">{draft.challenge}</p>
            {draft.rubric.length > 0 && (
              <ul className="mt-1.5 space-y-1">
                {draft.rubric.map((r, i) => (
                  <li key={i} className="text-[12px] leading-snug text-text-muted">· {r}</li>
                ))}
              </ul>
            )}
          </div>
          <textarea
            ref={answerRef}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            aria-label="Tu respuesta al reto de la lección"
            rows={5}
            placeholder="Responde desde el primer principio — el porqué, no el qué."
            className="scroll-touch w-full resize-none rounded-[var(--r-sm)] border border-line bg-ink p-3 font-mono text-[13px] text-text placeholder:text-text-faint focus:outline-none"
            style={{ borderColor: "color-mix(in srgb, " + accent + " 30%, var(--line))" }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void evaluate()}
              disabled={!answer.trim() || gradeBusy}
              aria-busy={gradeBusy}
              className="min-h-11 flex-1 rounded-[var(--r-sm)] border px-4 text-sm transition hover:brightness-125 disabled:opacity-40"
              style={{ borderColor: accent, color: readableAccent(accent) }}
            >
              {gradeBusy ? "Evaluando…" : "Evaluar respuesta"}
            </button>
            <button
              onClick={() => void generate()}
              disabled={genBusy}
              className="min-h-11 px-2 text-[11px] uppercase tracking-[0.16em] text-text-faint transition hover:text-text-muted"
            >
              Otra lección
            </button>
          </div>
          <span className="sr-only" role="status" aria-live="polite">
            {gradeBusy ? "Evaluando tu respuesta…" : ""}
          </span>
          <div role="status" aria-live="polite" aria-atomic="true">
            {grade && (
              <div className="rounded-[var(--r-md)] border p-3" style={{ borderColor: grade.understood ? accent : "var(--amber)" }}>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[11px] uppercase tracking-[0.16em]"
                    style={{ color: grade.understood ? readableAccent(accent) : "var(--amber)" }}
                  >
                    {grade.understood ? "Reforzado" : "A medias — sigue"}
                  </span>
                  <span className="tnum text-[11px] text-text-faint">{Math.round(grade.score * 100)}%</span>
                </div>
                <p className="mt-1.5 text-[13px] leading-snug text-text-muted">{grade.feedback}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
