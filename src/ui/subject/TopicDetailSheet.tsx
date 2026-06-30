"use client";

import { useMemo, useRef, useState } from "react";
import { useArcanum } from "@/app/providers";
import { useActions } from "@/ui/use-actions";
import { useFocusTrap } from "@/ui/use-focus-trap";
import { readableAccent } from "@/lib/accent";
import { FireTest } from "@/ui/FireTest";
import { BlankChallenge } from "@/ui/BlankChallenge";
import { NotesSheet } from "@/ui/NotesSheet";
import { Quiz } from "@/ui/subject/Quiz";
import { ExitGate } from "@/ui/subject/ExitGate";
import { MissionPanel } from "@/ui/subject/MissionPanel";
import { EvaluationPanel } from "@/ui/subject/EvaluationPanel";
import { TutorSheet } from "@/ui/subject/TutorSheet";
import { nodeStatus } from "@/core/roadmap";
import { contentForModule } from "@/lib/subject-content";

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
  const retrievability = useArcanum((s) => s.viewModel.modules.find((m) => m.id === moduleId)?.retrievability ?? 0);
  const { startModule, completeModule } = useActions();
  const [notesOpen, setNotesOpen] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const mod = readModel.modules.find((m) => m.id === moduleId) ?? null;
  const byId = useMemo(() => new Map(readModel.modules.map((m) => [m.id, m])), [readModel.modules]);
  const status = mod ? nodeStatus(mod, readModel.edges, byId) : "sealed";
  const content = contentForModule(moduleId);
  const noteCount = readModel.notes.filter((n) => n.moduleId === moduleId).length;

  useFocusTrap(panelRef);

  if (!mod || mod.archived) return null;
  const goalId = mod.goalId ?? "";

  return (
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

        {/* RETO FIRST — the wall before any resource (methodology intact). */}
        <div className="mt-5 border-t border-line pt-5">
          {mod.status === "idle" ? (
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
              {/* A mission cell closes ONLY via its interrogation (kind:'mission' →
                  isMastered requires gatePassed). Hide the manual "complete" button there
                  so it can't read as a way out — that would be a placebo. */}
              {mod.status === "started" && mod.kind !== "mission" && (
                <button onClick={() => completeModule({ goalId, moduleId: mod.id })} className="min-h-11 text-sm text-text-faint transition hover:text-text">
                  Cerrar tópico · +150 XP
                </button>
              )}
            </div>
          )}
        </div>

        {/* CELL BODY — canonical source anchored, on demand. The resource is AFTER the wall. */}
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

        {/* DIRECTED MISSION (heavy cell) — assign → block → submit evidence → interrogation.
            Passing the interrogation unseals the next cell. Mutually exclusive with the gate. */}
        {content?.mission && (
          <div className="mt-5 border-t border-line pt-4">
            <MissionPanel moduleId={mod.id} mission={content.mission} sourceUrls={content.sourceUrls} accent={accent} />
          </div>
        )}

        {/* EXIT GATE (WHITE ROOM) — adversarial; passing it unseals the next cell. */}
        {content?.gate && (
          <div className="mt-5 border-t border-line pt-4">
            <ExitGate moduleId={mod.id} gate={content.gate} accent={accent} />
          </div>
        )}

        {/* Legacy built-in quiz (cells without a gate). Emits checkpoint.passed → mastery. */}
        {content && content.quiz.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            <Quiz goalId={goalId} moduleId={mod.id} questions={content.quiz} accent={accent} />
          </div>
        )}

        {/* ADVERSARIAL EVALUATION (Bloque 5) — AI or local heuristic fallback. */}
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
      </div>

      <NotesSheet open={notesOpen} moduleId={moduleId} onClose={() => setNotesOpen(false)} />
      {tutorOpen && <TutorSheet moduleId={moduleId} accent={accent} onClose={() => setTutorOpen(false)} />}
    </div>
  );
}
