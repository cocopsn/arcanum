"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useArcanum } from "@/app/providers";
import { useLayoutMode } from "@/ui/layout-mode";
import { useActions } from "@/ui/use-actions";
import { useFocusTrap } from "@/ui/use-focus-trap";
import { readableAccent } from "@/lib/accent";
import { FireTest } from "@/ui/FireTest";
import { BlankChallenge } from "@/ui/BlankChallenge";
import { NotesModule } from "@/ui/notes/NotesModule";
import { Quiz } from "@/ui/subject/Quiz";
import { ExitGate } from "@/ui/subject/ExitGate";
import { MissionPanel } from "@/ui/subject/MissionPanel";
import { LessonMode } from "@/ui/subject/LessonMode";
import { ExerciseMode } from "@/ui/exercises/ExerciseMode";
import { loadBankForModule } from "@/lib/exercise-store";
import { LearningModes } from "@/ui/subject/LearningModes";
import { SourceViewer } from "@/ui/subject/SourceViewer";
import { BookReader } from "@/ui/books/BookReader";
import { getBookForModule, type BookRow } from "@/lib/book-store";
import { audio } from "@/lib/audio";
import { EvaluationPanel } from "@/ui/subject/EvaluationPanel";
import { TutorSheet } from "@/ui/subject/TutorSheet";
import { nodeStatus, prereqsOf, isMastered, crossPathEcho } from "@/core/roadmap";
import { NATURE_STANCE } from "@/lib/gate";
import { contentForModule } from "@/lib/subject-content";
import { modesFor, defaultMode, type DurationMode } from "@/lib/learning-modes";

const STATUS_LABEL = { sealed: "Sellado", available: "Disponible", started: "En curso", completed: "Completado" } as const;

export function TopicDetailSheet({
  moduleId,
  accent,
  onClose,
}: {
  moduleId: string;
  accent: string;
  onClose: () => void;
}) {
  const readModel = useArcanum((s) => s.readModel);
  const viewModel = useArcanum((s) => s.viewModel);
  const retrievability = useArcanum((s) => s.viewModel.modules.find((m) => m.id === moduleId)?.retrievability ?? 0);
  const { startModule, completeModule } = useActions();
  const [notesOpen, setNotesOpen] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [lesson, setLesson] = useState<{ open: boolean; kind: "lesson" | "review" }>({ open: false, kind: "lesson" });
  const [book, setBook] = useState<BookRow | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [exercisesOpen, setExercisesOpen] = useState(false);
  const [hasCurated, setHasCurated] = useState(false);

  useEffect(() => {
    let cancel = false;
    void getBookForModule(moduleId).then((b) => {
      if (!cancel) setBook(b);
    });
    void loadBankForModule(moduleId).then((ex) => {
      if (!cancel) setHasCurated(ex.length > 0);
    });
    return () => {
      cancel = true;
    };
  }, [moduleId]);
  const panelRef = useRef<HTMLDivElement>(null);
  const desktop = useLayoutMode().mode === "desktop";

  const mod = readModel.modules.find((m) => m.id === moduleId) ?? null;
  const byId = useMemo(() => new Map(readModel.modules.map((m) => [m.id, m])), [readModel.modules]);
  const status = mod ? nodeStatus(mod, readModel.edges, byId) : "sealed";
  const content = contentForModule(moduleId);
  const noteCount = readModel.notes.filter((n) => n.moduleId === moduleId).length;
  const modes = mod ? modesFor(mod, viewModel) : { heavy: false, light: false, review: 0 };
  // the selector's choice; lands on the cell's natural primary activity
  const [mode, setMode] = useState<DurationMode>(() => defaultMode(modes));

  useFocusTrap(panelRef);

  if (!mod || mod.archived) return null;
  const goalId = mod.goalId ?? "";
  const goalTitle = readModel.goals.find((g) => g.id === goalId)?.title ?? "";
  const sealed = status === "sealed";

  // unmet prerequisites (LIVE, not archived, not mastered) — derived from the log
  const blockers = sealed
    ? prereqsOf(mod.id, readModel.edges)
        .map((pid) => byId.get(pid))
        .filter((p): p is NonNullable<typeof p> => !!p && !p.archived && !isMastered(p))
    : [];

  // the reto wall — the methodology's challenge-first gate (FireTest if idle, BlankChallenge after)
  const retoWall = (showComplete: boolean) =>
    mod.status === "idle" ? (
      <div className="space-y-4">
        <FireTest goalId={goalId} moduleId={mod.id} title={mod.title} />
        <button
          onClick={() => startModule({ goalId, moduleId: mod.id })}
          className="min-h-11 w-full rounded-[var(--r-sm)] border border-line px-4 py-2 text-sm text-text-muted transition hover:text-text"
          style={{ borderColor: "color-mix(in srgb, " + accent + " 40%, var(--line))" }}
        >
          Iniciar tópico
        </button>
      </div>
    ) : (
      <div className="space-y-4">
        <BlankChallenge goalId={goalId} moduleId={mod.id} title={mod.title} />
        {/* A mission cell closes ONLY via its interrogation (kind:'mission' → isMastered requires
            gatePassed). Hide the manual complete button there so it can't read as a way out. */}
        {showComplete && mod.status === "started" && mod.kind !== "mission" && (
          <button onClick={() => completeModule({ goalId, moduleId: mod.id })} className="min-h-11 text-sm text-text-faint transition hover:text-text">
            Cerrar tópico · +150 XP
          </button>
        )}
      </div>
    );

  return (
    <>
    <div
      className={desktop ? "fixed inset-0 z-[60] flex justify-end" : "fixed inset-0 z-[60] flex items-end justify-center sm:items-center"}
      style={{ background: "var(--overlay-scrim)" }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="topic-title"
        tabIndex={-1}
        className={
          desktop
            ? // DESKTOP — a right-docked side panel (full height), not a bottom sheet that wastes the width
              "scroll-touch flex h-full w-full max-w-[440px] flex-col overflow-y-auto border-l border-line bg-surface-raised p-6 shadow-aura outline-none"
            : "scroll-touch flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-t-[var(--r-lg)] border border-line bg-surface-raised p-6 outline-none sm:rounded-[var(--r-lg)]"
        }
        style={desktop ? undefined : { paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="topic-title" className="font-serif text-xl leading-tight text-text">
              {mod.title}
            </h2>
            <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-text-muted">
              {STATUS_LABEL[status]} · maestría <span className="tnum" style={{ color: readableAccent(accent) }}>{Math.round(retrievability * 100)}%</span>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="-mr-2 -mt-1 min-h-11 px-2 text-2xl leading-none text-text-faint transition hover:text-text">
            ×
          </button>
        </div>

        {/* ── NATURE — structural: it decides which gate you'll face (defend vs. direct+audit) ── */}
        {(() => {
          const stance = NATURE_STANCE[mod.nature ?? "a_mano"];
          const echo = crossPathEcho(mod, readModel.modules, readModel.paths);
          return (
            <>
              <div className="mt-3 rounded-[var(--r-sm)] border border-line bg-surface p-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: readableAccent(accent) }}>
                    {stance.label}
                  </span>
                  {mod.parts.length > 0 && (
                    <span className="text-[10px] uppercase tracking-wider text-text-faint">
                      {mod.parts.map((p) => `${p.name}: ${p.nature === "a_mano" ? "a mano" : "delegable"}`).join(" · ")}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12px] leading-snug text-text-muted">{stance.meaning}</p>
              </div>

              {/* cross-path echo: CONTEXT only — no desbloquea, no da XP, no salta el gate */}
              {echo && (
                <div className="mt-2 rounded-[var(--r-sm)] border border-dashed border-line p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-text-faint">Ya lo viste en {echo.pathName}</div>
                  <p className="mt-1 text-[12px] leading-snug text-text-muted">
                    «{echo.moduleTitle}». Es solo contexto para que conectes los dos caminos — aquí el gate se gana igual.
                  </p>
                </div>
              )}
            </>
          );
        })()}

        {sealed ? (
          /* ── FAIL-CLOSED: a sealed cell shows its locked state but NEVER its work flow ── */
          <div className="mt-5 rounded-[var(--r-md)] border border-dashed border-line bg-surface p-5 text-center">
            <div aria-hidden className="font-display text-2xl text-text-faint">⊘</div>
            <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-text-faint">Territorio sellado</div>
            <p className="mx-auto mt-2 max-w-xs font-serif text-[13px] leading-relaxed text-text-muted">
              Esta celda está bloqueada por fog-of-war. Domina lo anterior para revelarla — no hay atajo.
            </p>
            {blockers.length > 0 && (
              <div className="mt-4 text-left">
                <div className="text-[10px] uppercase tracking-[0.2em] text-text-faint">Falta dominar</div>
                <ul className="mt-1.5 space-y-1">
                  {blockers.map((b) => (
                    <li key={b.id} className="font-serif text-[13px] leading-snug text-text">· {b.title}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* ── Lectura profunda · Fase 1 (leer desde la raíz, offline) ── */}
            <div className="mt-4 rounded-[var(--r-md)] border border-line p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-xs uppercase tracking-[0.22em] text-text-faint">Lectura profunda · Fase 1</h3>
                {book?.meta.readingMinutes != null && <span className="text-[10px] uppercase tracking-wider text-text-faint">{book.meta.readingMinutes} min</span>}
              </div>
              {book ? (
                <>
                  <p className="mt-1 text-[12px] leading-snug text-text-muted">{book.title}{book.source === "seed" ? " · ejemplo semilla" : ""}</p>
                  <button
                    onClick={() => setReaderOpen(true)}
                    className="mt-2 min-h-11 w-full rounded-[var(--r-sm)] border px-4 text-sm transition hover:brightness-125"
                    style={{ borderColor: accent, color: readableAccent(accent) }}
                  >
                    Leer{book.meta.readingMinutes != null ? ` · ${book.meta.readingMinutes} min` : ""}
                  </button>
                </>
              ) : (
                <p className="mt-1 text-[13px] leading-snug text-text-muted">Sin libro — genéralo con IA (Sonnet 5) en el formato de contrato e impórtalo en Lecturas. Cero contenido inventado.</p>
              )}
            </div>

            {/* ── Ejercicios · Fase 2 (escribir código desde cero, ejecutado offline) ── */}
            <div className="mt-4 rounded-[var(--r-md)] border border-line p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-xs uppercase tracking-[0.22em] text-text-faint">Ejercicios · Fase 2</h3>
                <span className="text-[10px] uppercase tracking-wider text-text-faint">JS · Python</span>
              </div>
              <p className="mt-1 text-[12px] leading-snug text-text-muted">
                Escribe la implementación desde cero y ejecútala AQUÍ, sin datos. Te muestra el error real o el caso exacto que falla — nunca la solución. {hasCurated ? "Banco curado + práctica infinita." : "Práctica infinita de sintaxis (JS/Python)."}
              </p>
              <button
                onClick={() => {
                  audio.cue("primary");
                  setExercisesOpen(true);
                }}
                className="mt-3 min-h-11 w-full rounded-[var(--r-sm)] border px-4 text-sm transition hover:brightness-125"
                style={{ borderColor: accent, color: readableAccent(accent) }}
              >
                Entrar a los ejercicios
              </button>
            </div>

            {/* ── the time-by-duration SELECTOR drives the activity below ── */}
            <div className="mt-4">
              <LearningModes
                modes={modes}
                active={mode}
                onSelect={(m) => {
                  audio.cue("toggle"); // a select, not a command
                  setMode(m);
                }}
                accent={accent}
              />
            </div>

            {/* ── ACTIVITY — only the SELECTED mode's flow renders (the selector really switches) ── */}
            {mode === "heavy" && (
              <div className="mt-5 space-y-5">
                {(modes.heavy || mod.status !== "idle") && <div className="border-t border-line pt-5">{retoWall(true)}</div>}
                {content?.mission && <MissionPanel moduleId={mod.id} mission={content.mission} sourceUrls={content.sourceUrls} accent={accent} mode={content.mode} judge={content.judge} />}
                {content?.gate && <ExitGate moduleId={mod.id} gate={content.gate} accent={accent} />}
                {content && content.quiz.length > 0 && <Quiz goalId={goalId} moduleId={mod.id} questions={content.quiz} accent={accent} />}
              </div>
            )}

            {mode === "light" && (
              <div className="mt-5 border-t border-line pt-5">
                {content && content.sourceUrls.length > 0 ? (
                  <div className="rounded-[var(--r-md)] border border-line p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-xs uppercase tracking-[0.22em] text-text-faint">Lección paso a paso · Capa B</h3>
                      <span className="text-[10px] uppercase tracking-wider text-text-faint">15–25 min</span>
                    </div>
                    <p className="mt-1 text-[12px] leading-snug text-text-muted">
                      Una secuencia de micro-retos contra la fuente real, a pantalla completa. Tres corazones: cada error te
                      hace entenderlo y corregirlo antes de seguir.
                    </p>
                    <button
                      onClick={() => {
                        audio.unlock();
                        setLesson({ open: true, kind: "lesson" });
                      }}
                      className="mt-3 min-h-11 w-full rounded-[var(--r-sm)] border px-4 text-sm transition hover:brightness-125"
                      style={{ borderColor: accent, color: readableAccent(accent) }}
                    >
                      {mod.reinforceCount > 0 ? "Otra lección · ángulo nuevo" : "Entrar a la lección"}
                    </button>
                  </div>
                ) : (
                  <p className="text-[13px] text-text-muted">Esta celda no tiene fuente para una lección. Prueba la misión o el repaso.</p>
                )}
              </div>
            )}

            {mode === "review" && (
              <div className="mt-5 border-t border-line pt-5">
                <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-text-faint">
                  {mod.status === "idle" ? "Reto en blanco · mide tu nivel de entrada" : "Repaso · prueba que aún lo sostienes"}
                </div>
                {/* Capa C — un repaso GENERADO nuevo (variación contra la misma fuente, nunca repetido) */}
                {content && content.sourceUrls.length > 0 && mod.status !== "idle" && (
                  <div className="mb-4 rounded-[var(--r-md)] border border-line p-4">
                    <p className="text-[12px] leading-snug text-text-muted">
                      Un repaso NUEVO cada vez: una variación contra la misma fuente (otro ángulo), nunca la misma lección dos veces.
                    </p>
                    <button
                      onClick={() => {
                        audio.unlock();
                        setLesson({ open: true, kind: "review" });
                      }}
                      className="mt-3 min-h-11 w-full rounded-[var(--r-sm)] border px-4 text-sm transition hover:brightness-125"
                      style={{ borderColor: accent, color: readableAccent(accent) }}
                    >
                      Generar repaso
                    </button>
                  </div>
                )}
                {retoWall(false)}
              </div>
            )}

            {/* ── support (always available, secondary to the chosen activity) ── */}
            {content && (
              <details className="group mt-5 border-t border-line pt-4">
                <summary className="min-h-11 cursor-pointer list-none text-[11px] uppercase tracking-[0.18em] text-text-faint transition hover:text-text-muted">
                  ⌄ Curso · fuentes reales y visor
                </summary>
                <div className="mt-3 space-y-4">
                  <p className="text-[13px] leading-relaxed text-text-muted">
                    {content.summary ??
                      "La secuencia curada de fuentes REALES de este tema. El video corre aquí dentro; las páginas se traen y se leen dentro; nada inventado — solo la fuente."}
                  </p>
                  <SourceViewer
                    cellTitle={mod.title}
                    sources={[...content.sourceUrls, ...content.videos.map((v) => v.url)]}
                    accent={accent}
                  />
                </div>
              </details>
            )}

            {content && content.references.length > 0 && (
              <div className="mt-4 rounded-[var(--r-sm)] border border-line bg-surface p-3">
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-text-faint">Se apoya en · ya vive en otra espina (no se duplica)</h3>
                <ul className="mt-1 space-y-1">
                  {content.references.map((r) => (
                    <li key={r.id} className="text-[12px] leading-snug text-text-muted">· {r.title}</li>
                  ))}
                </ul>
              </div>
            )}

            {content && content.related.length > 0 && (
              <div className="mt-4 rounded-[var(--r-sm)] border border-dashed border-line bg-surface p-3">
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-text-faint">Relacionado · otra naturaleza (celda aparte)</h3>
                <ul className="mt-1 space-y-1">
                  {content.related.map((r) => (
                    <li key={r.id} className="text-[12px] leading-snug text-text-muted">· {r.title}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-5 border-t border-line pt-4">
              <EvaluationPanel moduleId={mod.id} accent={accent} />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-5">
              <button onClick={() => setTutorOpen(true)} className="-mx-2 inline-flex min-h-11 items-center px-2 text-[11px] uppercase tracking-[0.16em] transition" style={{ color: readableAccent(accent) }}>
                Preguntar al tutor
              </button>
              <button onClick={() => setNotesOpen(true)} className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.16em] text-text-muted transition hover:text-topic">
                Notas · {noteCount}
              </button>
            </div>
          </>
        )}
      </div>

      <NotesModule open={notesOpen} moduleId={moduleId} onClose={() => setNotesOpen(false)} />
      {tutorOpen && <TutorSheet moduleId={moduleId} accent={accent} onClose={() => setTutorOpen(false)} />}
    </div>
    {lesson.open && (
      <LessonMode
        moduleId={moduleId}
        goalId={goalId}
        goalTitle={goalTitle}
        cellTitle={mod.title}
        angleIndex={mod.reinforceCount}
        kind={lesson.kind}
        onClose={() => setLesson({ open: false, kind: "lesson" })}
      />
    )}
    {readerOpen && book && <BookReader book={book} onClose={() => setReaderOpen(false)} />}
    {exercisesOpen && (
      <ExerciseMode
        moduleId={moduleId}
        goalId={goalId}
        goalTitle={goalTitle}
        cellTitle={mod.title}
        onClose={() => setExercisesOpen(false)}
      />
    )}
    </>
  );
}
