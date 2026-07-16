"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useActions } from "@/ui/use-actions";
import { useFocusTrap } from "@/ui/use-focus-trap";
import { useReward } from "@/ui/reward/RewardProvider";
import { EnterRitual } from "@/ui/subject/EnterRitual";
import { ARCANUM_CONFIG } from "@/core/config";
import { initRun, reduceRun, type LessonRun, type RunEffect } from "@/lib/lesson-run";
import { themeForGoal, worldVars } from "@/lib/subject-themes";
import { readableAccent } from "@/lib/accent";
import { audio } from "@/lib/audio";
import type { LessonCourseReply, LessonGrade } from "@/sync/ai";

// The step-by-step LIGHT lesson, full-screen. A sequence of micro-challenges against the cell's
// REAL source; 3 hearts; a miss costs a heart AND forces the amor-fati CORRECTION (understand WHY,
// then fix it → error.resolved). All hearts gone is not a wall — another turn, insights kept. The
// whole lesson cleared → checkpoint.passed. World-skinned, audio per event, iPhone-first.

const HEARTS = ARCANUM_CONFIG.lesson.hearts;
// normalize an answer for the anti-gaming "must differ" guard — collapse case + whitespace so a
// cosmetic tweak (Caps, doubled spaces) of a rejected answer doesn't pass as "different".
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function LessonMode({
  moduleId,
  goalId,
  goalTitle,
  cellTitle,
  angleIndex = 0,
  kind = "lesson",
  onClose,
}: {
  moduleId: string;
  goalId: string;
  goalTitle: string;
  cellTitle: string;
  /** rotation index → the angle this lesson takes (course/depth/review never repeat) */
  angleIndex?: number;
  /** framing only — "review" reuses the SAME generator with the next angle (Capa C) */
  kind?: "lesson" | "review";
  onClose: () => void;
}) {
  const { generateLessonCourse, gradeLessonStep, resolveError, passLesson } = useActions();
  const reward = useReward();
  const theme = themeForGoal(goalTitle);
  const accent = theme.accent;
  const ink = readableAccent(accent);
  const reduce = useReducedMotion();
  const [entering, setEntering] = useState(true); // the threshold ritual on open

  const [loading, setLoading] = useState(true);
  const [noAi, setNoAi] = useState(false);
  const [course, setCourse] = useState<LessonCourseReply | null>(null);
  const [run, setRun] = useState<LessonRun | null>(null);
  const [answer, setAnswer] = useState("");
  const [grading, setGrading] = useState(false);
  const [hiccup, setHiccup] = useState(false);
  const [lastGrade, setLastGrade] = useState<LessonGrade | null>(null);
  const [attempts, setAttempts] = useState<string[]>([]); // normalized answers already tried for the CURRENT step
  const [scores, setScores] = useState<number[]>([]);
  const [showConcept, setShowConcept] = useState(true);

  const rootRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const passed = useRef(false);
  const busy = useRef(false); // SYNCHRONOUS in-flight latch — React's `grading` state lags a frame

  useFocusTrap(rootRef);

  // generate the course once (the real AI; null → honest no-lesson screen)
  useEffect(() => {
    let cancel = false;
    setLoading(true);
    audio.unlock();
    void (async () => {
      const c = await generateLessonCourse(moduleId, angleIndex);
      if (cancel) return;
      if (!c) {
        setNoAi(true);
        setLoading(false);
        return;
      }
      setCourse(c);
      setRun(initRun(c.steps.length, HEARTS));
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  // keep focus on the answer field as steps/correction change
  useEffect(() => {
    if (run && (run.phase === "answering" || run.phase === "correcting")) areaRef.current?.focus();
  }, [run?.current, run?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  function playSounds(effects: RunEffect[]) {
    for (const e of effects) {
      // POSITIVE moments route through the reward system (sound + a scaled, variable flourish); the
      // crafted sfx is preserved via the sfx override. Tension moments (heart lost, fail) stay plain —
      // they are not rewards. resolveInsight = overcoming the wall → it earns a small celebration
      // (fallar-y-corregir es dopaminérgico, no punitivo).
      if (e === "advance") reward("micro", { accent, sfx: "step" });
      else if (e === "resolveInsight") reward("small", { accent, sfx: "resolve" });
      else if (e === "passLesson") reward("medium", { accent, sfx: "lessonwin" });
      else if (e === "loseHeart") audio.sfx("heart");
      else if (e === "failLesson") audio.sfx("error");
      else if (e === "restart") audio.sfx("reveal");
    }
  }

  function firePass(finalScores: number[]) {
    if (passed.current) return;
    passed.current = true;
    const avg = finalScores.length ? finalScores.reduce((a, b) => a + b, 0) / finalScores.length : 0;
    void passLesson({ goalId, moduleId }, Math.max(0, Math.min(1, avg)));
  }

  // shared submit for both the first answer (answering) and the re-answer (correcting). The SYNCHRONOUS
  // `busy` latch is the real re-entrancy gate: `grading` state lags a frame, so two fast taps could both
  // pass it and double-dispatch error.resolved (double XP) on a corrected step. The ref blocks that.
  async function submit(kind: "graded" | "corrected") {
    if (!course || !run || busy.current || grading || !answer.trim()) return;
    const tried = norm(answer);
    if (kind === "corrected" && attempts.includes(tried)) return; // anti-gaming: differ from ANY prior try this step
    const step = course.steps[run.current];
    if (!step) return;
    busy.current = true;
    setGrading(true);
    setHiccup(false);
    try {
      const g = await gradeLessonStep(cellTitle, step.prompt, step.rubric, answer);
      if (!g) {
        setHiccup(true); // no AI mid-lesson → honest; stay in place, let them retry
        return;
      }
      setLastGrade(g);
      const { next, effects } = reduceRun(run, { type: kind, understood: g.understood });
      playSounds(effects);
      if (effects.includes("resolveInsight")) {
        const insight = `Lección · ${cellTitle}: corregí «${step.prompt.slice(0, 90)}» — ${g.feedback.slice(0, 160)}`;
        void resolveError({ goalId, moduleId }, insight);
      }
      const nextScores = g.understood ? [...scores, g.score] : scores;
      if (g.understood) {
        setScores(nextScores);
        setAttempts([]); // step cleared → fresh attempt set for the next step
      } else {
        setAttempts((a) => (a.includes(tried) ? a : [...a, tried])); // remember this miss for the guard
      }
      if (effects.includes("passLesson")) firePass(nextScores);
      setAnswer("");
      setRun(next);
    } finally {
      setGrading(false);
      busy.current = false;
    }
  }

  function restart() {
    if (!run || run.phase !== "failed") return;
    const { next, effects } = reduceRun(run, { type: "restart" });
    playSounds(effects);
    passed.current = false;
    busy.current = false;
    setScores([]);
    setLastGrade(null);
    setAttempts([]);
    setAnswer("");
    setHiccup(false);
    setRun(next);
  }

  const cleared = run ? run.current : 0;
  const total = course?.steps.length ?? 0;
  const frac = total ? cleared / total : 0;
  const stepTransition = reduce ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Lección · ${cellTitle}`}
      tabIndex={-1}
      className="fixed inset-0 z-[80] flex flex-col outline-none"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      style={
        {
          ...worldVars(theme),
          background: `radial-gradient(120% 80% at 50% -10%, ${theme.glow}, transparent 55%), linear-gradient(168deg, ${theme.bg2}, ${theme.bg})`,
          paddingTop: "max(0.75rem, env(safe-area-inset-top))",
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        } as CSSProperties
      }
    >
      {/* the THRESHOLD ritual — the world dims to the realm's sigil, a beat, then it fades to the lesson */}
      <AnimatePresence>
        {entering && <EnterRitual title={cellTitle} glyph={theme.glyph} accent={accent} onDone={() => setEntering(false)} />}
      </AnimatePresence>
      {/* ── header: progress + hearts + close ── */}
      <header className="mx-auto flex w-full max-w-md shrink-0 items-center gap-3 px-4">
        <button
          onClick={onClose}
          aria-label="Salir de la lección"
          className="-ml-1 min-h-11 px-1 text-2xl leading-none text-text-faint transition hover:text-text"
        >
          ×
        </button>
        <div className="relative h-2 flex-1 overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--world-fog) 80%, transparent)" }}>
          {/* scaleX (GPU-composited), not width — keeps the only chrome animation at 60fps */}
          <div
            className="h-full w-full origin-left rounded-full transition-transform duration-500 ease-out"
            style={{ transform: `scaleX(${frac})`, background: `linear-gradient(90deg, ${accent}, ${theme.accent2})` }}
          />
        </div>
        <Hearts hearts={run?.hearts ?? HEARTS} max={HEARTS} accent={accent} />
        {/* hearing users feel the heart cost via the sfx; this is the SR-equivalent status */}
        <span className="sr-only" role="status" aria-live="polite">
          {run ? `Te quedan ${run.hearts} de ${HEARTS} corazones` : ""}
        </span>
      </header>

      {/* ── body ── */}
      <main className="scroll-touch mx-auto w-full max-w-md flex-1 overflow-y-auto px-4 pt-4">
        {loading && <Centered glyph={theme.glyph} accent={accent}>{kind === "review" ? "Forjando un repaso NUEVO contra la fuente real…" : "Forjando la lección contra la fuente real…"}</Centered>}

        {noAi && (
          <Centered glyph="⊘" accent={accent}>
            <span className="block">
              La lección paso a paso requiere el generador (IA) y una sesión iniciada. Sin IA no se inventa contenido —
              abre la fuente real y trabaja directo.
            </span>
            <button
              onClick={onClose}
              className="mt-5 inline-flex min-h-11 items-center rounded-[var(--r-sm)] border px-5 text-sm uppercase tracking-[0.16em] transition hover:brightness-125"
              style={{ borderColor: accent, color: ink }}
            >
              Volver
            </button>
          </Centered>
        )}

        {course && run && (run.phase === "answering" || run.phase === "correcting") && (
          <>
            {/* the concept framing — open by default, collapsible */}
            <div className="mb-4 rounded-[var(--r-sm)] border border-line" style={{ background: "color-mix(in srgb, var(--world-fog) 45%, transparent)" }}>
              <button
                onClick={() => setShowConcept((v) => !v)}
                aria-expanded={showConcept}
                className="flex min-h-11 w-full items-center justify-between px-3 text-left text-[10px] uppercase tracking-[0.2em] text-text-faint"
              >
                <span>El concepto · {theme.temper}</span>
                <span aria-hidden>{showConcept ? "▴" : "▾"}</span>
              </button>
              {showConcept && (
                <p className="whitespace-pre-wrap px-3 pb-3 text-[13px] leading-relaxed text-text-muted">{course.concept}</p>
              )}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${run.round}-${run.current}-${run.phase}`}
                initial={reduce ? false : { opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
                transition={stepTransition}
              >
                <div className="text-[11px] uppercase tracking-[0.2em] text-text-faint">
                  Paso <span className="tnum">{run.current + 1}</span> de <span className="tnum">{total}</span>
                  {run.round > 1 && <span style={{ color: ink }}> · vuelta {run.round}</span>}
                </div>

                {run.phase === "correcting" ? (
                  <div className="mt-3 rounded-[var(--r-md)] border p-4" style={{ borderColor: "var(--amber)", background: "color-mix(in srgb, var(--amber) 8%, transparent)" }}>
                    <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--amber)" }}>
                      Corrige para seguir · amor fati
                    </div>
                    <p role="alert" className="mt-2 text-[13px] leading-snug text-text">{lastGrade?.feedback || "Esa no fue. Entiende por qué y vuélvelo a intentar."}</p>
                    <p className="mt-3 font-serif text-[15px] leading-snug text-text">{course.steps[run.current]?.prompt}</p>
                  </div>
                ) : (
                  <p className="mt-3 font-serif text-[17px] leading-snug text-text">{course.steps[run.current]?.prompt}</p>
                )}

                {course.steps[run.current] && course.steps[run.current]!.rubric.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {course.steps[run.current]!.rubric.map((r, i) => (
                      <li key={i} className="text-[12px] leading-snug text-text-faint">· {r}</li>
                    ))}
                  </ul>
                )}
              </motion.div>
            </AnimatePresence>

            <textarea
              ref={areaRef}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              aria-label={run.phase === "correcting" ? "Tu corrección" : "Tu respuesta"}
              rows={5}
              placeholder={run.phase === "correcting" ? "Corrige entendiendo el porqué — no copies lo de antes." : "Responde desde el primer principio — el porqué, no el qué."}
              className="scroll-touch mt-4 w-full resize-none rounded-[var(--r-sm)] border bg-ink p-3 font-mono text-[13px] text-text placeholder:text-text-faint focus:outline-none"
              style={{ borderColor: `color-mix(in srgb, ${accent} 32%, var(--line))` }}
            />

            {run.phase === "correcting" && answer.trim() && attempts.includes(norm(answer)) && (
              <p className="mt-1 text-[12px]" role="status" aria-live="polite" style={{ color: "var(--amber)" }}>Ya intentaste esa — cámbiala para mostrar que entendiste.</p>
            )}
            {hiccup && (
              <p role="status" aria-live="polite" className="mt-1 text-[12px] text-text-muted">La IA no respondió. Reintenta en un momento.</p>
            )}

            <button
              onClick={() => void submit(run.phase === "correcting" ? "corrected" : "graded")}
              disabled={grading || !answer.trim() || (run.phase === "correcting" && attempts.includes(norm(answer)))}
              aria-busy={grading}
              className="mt-3 min-h-12 w-full rounded-[var(--r-sm)] border font-display text-sm uppercase tracking-[0.18em] transition hover:brightness-125 disabled:opacity-40"
              style={{ borderColor: accent, color: ink, background: `color-mix(in srgb, ${accent} 10%, transparent)` }}
            >
              {grading ? "Evaluando…" : run.phase === "correcting" ? "Corregir" : "Responder"}
            </button>
            <span className="sr-only" role="status" aria-live="polite">{grading ? "Evaluando tu respuesta…" : ""}</span>
          </>
        )}

        {course && run && run.phase === "passed" && (
          <Centered glyph={theme.glyph} accent={accent}>
            <div className="font-display text-2xl tracking-[0.12em]" style={{ color: ink, textShadow: `0 0 22px ${theme.glow}` }}>
              Lección superada
            </div>
            <p className="mt-2 text-[13px] text-text-muted">
              Cerraste los <span className="tnum">{total}</span> pasos · +{ARCANUM_CONFIG.xp.checkpoint} XP
              {run.insights > 0 && (
                <>
                  {" "}· <span className="tnum">{run.insights}</span> insight{run.insights === 1 ? "" : "s"} de tus errores
                </>
              )}
            </p>
            <button
              onClick={onClose}
              className="mt-6 inline-flex min-h-11 items-center rounded-[var(--r-sm)] border px-6 text-sm uppercase tracking-[0.16em] transition hover:brightness-125"
              style={{ borderColor: accent, color: ink }}
            >
              Volver al territorio
            </button>
          </Centered>
        )}

        {course && run && run.phase === "failed" && (
          <Centered glyph="✕" accent="var(--amber)">
            <div className="font-display text-xl tracking-[0.1em] text-text">Se acabaron los corazones</div>
            <p className="mt-2 text-[13px] leading-relaxed text-text-muted">
              No es una pared — es otra vuelta del ciclo. Lo que corregiste ya quedó marcado
              {run.insights > 0 ? <> (<span className="tnum">{run.insights}</span> insight{run.insights === 1 ? "" : "s"})</> : null}; la
              segunda vuelta empieza sabiendo dónde tropezaste.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={restart}
                className="inline-flex min-h-11 items-center rounded-[var(--r-sm)] border px-6 text-sm uppercase tracking-[0.16em] transition hover:brightness-125"
                style={{ borderColor: accent, color: ink }}
              >
                Otra vuelta
              </button>
              <button onClick={onClose} className="min-h-11 px-3 text-[12px] uppercase tracking-[0.16em] text-text-faint transition hover:text-text">
                Salir
              </button>
            </div>
          </Centered>
        )}
      </main>
    </div>
  );
}

function Hearts({ hearts, max, accent }: { hearts: number; max: number; accent: string }) {
  return (
    <div className="flex shrink-0 items-center gap-1" role="img" aria-label={`${hearts} de ${max} corazones`}>
      {Array.from({ length: max }, (_, i) => {
        const alive = i < hearts;
        return (
          <svg key={i} width="16" height="16" viewBox="0 0 24 24" aria-hidden className="transition-opacity duration-300" style={{ opacity: alive ? 1 : 0.28 }}>
            <path
              d="M12 21s-7.5-4.8-9.7-9.2C1 8.5 2.4 5.5 5.4 5.1c1.9-.3 3.6.8 4.6 2.2 1-1.4 2.7-2.5 4.6-2.2 3 .4 4.4 3.4 3.1 6.7C19.5 16.2 12 21 12 21z"
              fill={alive ? accent : "none"}
              stroke={alive ? accent : "var(--text-faint)"}
              strokeWidth="1.5"
            />
          </svg>
        );
      })}
    </div>
  );
}

function Centered({ glyph, accent, children }: { glyph: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div className="max-w-xs px-2">
        <div aria-hidden className="font-display text-4xl" style={{ color: accent, textShadow: "0 0 18px var(--world-glow)" }}>
          {glyph}
        </div>
        <div className="mt-4 font-serif text-[14px] leading-relaxed text-text-muted">{children}</div>
      </div>
    </div>
  );
}
