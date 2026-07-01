"use client";

import { useMemo, useRef, useState } from "react";
import { useArcanum } from "@/app/providers";
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
import { LearningModes } from "@/ui/subject/LearningModes";
import { audio } from "@/lib/audio";
import { EvaluationPanel } from "@/ui/subject/EvaluationPanel";
import { TutorSheet } from "@/ui/subject/TutorSheet";
import { nodeStatus, prereqsOf, isMastered } from "@/core/roadmap";
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
  const [lessonOpen, setLessonOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
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
        className="scroll-touch flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-t-[var(--r-lg)] border border-line bg-surface-raised p-6 outline-none sm:rounded-[var(--r-lg)]"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
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
            {/* ── the time-by-duration SELECTOR drives the activity below ── */}
            <div className="mt-4">
              <LearningModes modes={modes} active={mode} onSelect={setMode} accent={accent} />
            </div>

            {/* ── ACTIVITY — only the SELECTED mode's flow renders (the selector really switches) ── */}
            {mode === "heavy" && (
              <div className="mt-5 space-y-5">
                {(modes.heavy || mod.status !== "idle") && <div className="border-t border-line pt-5">{retoWall(true)}</div>}
                {content?.mission && <MissionPanel moduleId={mod.id} mission={content.mission} sourceUrls={content.sourceUrls} accent={accent} mode={content.mode} />}
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
                        setLessonOpen(true);
                      }}
                      className="mt-3 min-h-11 w-full rounded-[var(--r-sm)] border px-4 text-sm transition hover:brightness-125"
                      style={{ borderColor: accent, color: readableAccent(accent) }}
                    >
                      Entrar a la lección
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
                  {mod.status === "idle" ? "Reto en blanco · mide tu nivel de entrada" : "Repaso rápido · prueba que aún lo sostienes"}
                </div>
                {retoWall(false)}
              </div>
            )}

            {/* ── support (always available, secondary to the chosen activity) ── */}
            {content && (
              <details className="group mt-5 border-t border-line pt-4">
                <summary className="min-h-11 cursor-pointer list-none text-[11px] uppercase tracking-[0.18em] text-text-faint transition hover:text-text-muted">
                  ⌄ Cuerpo de la celda · fuente canónica
                </summary>
                <div className="mt-3 space-y-4">
                  <p className="text-[13px] leading-relaxed text-text-muted">
                    {content.summary ??
                      "El cuerpo se llena bajo demanda: trabaja el reto, y cuando choques, pregúntale al tutor (borrador editable). Aquí no hay contenido pre-inventado — solo la fuente real."}
                  </p>
                  {content.sourceUrls.length > 0 && (
                    <div>
                      <h3 className="text-[10px] uppercase tracking-[0.2em] text-text-faint">Fuente</h3>
                      <div className="mt-1 space-y-1">
                        {content.sourceUrls.map((url) => (
                          <a key={url} href={url} target="_blank" rel="noreferrer noopener" className="block min-h-11 py-2 text-[13px] text-topic transition hover:underline">
                            {url.replace(/^https?:\/\//, "").slice(0, 52)} ↗
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {content.videos.length > 0 && (
                    <div>
                      <h3 className="text-[10px] uppercase tracking-[0.2em] text-text-faint">Video</h3>
                      <div className="mt-1 space-y-1">
                        {content.videos.map((v) => (
                          <a key={v.url} href={v.url} target="_blank" rel="noreferrer noopener" className="block min-h-11 py-2 text-[13px] text-topic transition hover:underline">
                            {v.title} ↗
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
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
    {lessonOpen && (
      <LessonMode moduleId={moduleId} goalId={goalId} goalTitle={goalTitle} cellTitle={mod.title} onClose={() => setLessonOpen(false)} />
    )}
    </>
  );
}
