"use client";

import { useEffect, useRef, useState } from "react";
import { useArcanum } from "@/app/providers";
import { useActions } from "@/ui/use-actions";
import { buildTutorContext } from "@/lib/tutor";
import { askTutor } from "@/sync/ai";

type Phase = "ask" | "thinking" | "draft" | "unavailable";

export function TutorSheet({ moduleId, accent, onClose }: { moduleId: string; accent: string; onClose: () => void }) {
  const readModel = useArcanum((s) => s.readModel);
  const { createNote } = useActions();
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<Phase>("ask");
  const [draft, setDraft] = useState("");
  const [provider, setProvider] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const mod = readModel.modules.find((m) => m.id === moduleId) ?? null;

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  async function ask() {
    if (!question.trim() || !mod) return;
    setPhase("thinking");
    const ctx = buildTutorContext(readModel, moduleId, question, Date.now());
    const reply = ctx ? await askTutor(ctx) : null;
    if (!reply) {
      setPhase("unavailable");
      return;
    }
    setProvider(reply.provider);
    setDraft(reply.answer);
    setPhase("draft");
  }

  async function saveAsNote() {
    const title = `Tutor · ${mod?.title ?? "tópico"}`.slice(0, 80);
    await createNote({ moduleId, goalId: mod?.goalId ?? null }, title, draft);
    setSaved(true);
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
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
        aria-label="Tutor del tópico"
        tabIndex={-1}
        className="scroll-touch flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-[var(--r-lg)] border border-line bg-surface-raised p-6 outline-none sm:rounded-[var(--r-lg)]"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg tracking-[0.12em]" style={{ color: accent }}>
              TUTOR
            </h2>
            <p className="mt-1 text-[13px] text-text-muted">
              Adversarial a propósito: no te regala la respuesta — te empuja al primer principio con tu contexto y tus notas.
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="-mr-2 -mt-1 min-h-11 px-2 text-2xl leading-none text-text-faint transition hover:text-text">
            ×
          </button>
        </div>

        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={`Pregunta sobre ${mod?.title ?? "el tópico"}… (te responderá según dónde estás)`}
          rows={3}
          className="w-full resize-none rounded-[var(--r-sm)] border border-line bg-ink px-3 py-2 text-sm text-text placeholder:text-text-faint focus:outline-none"
          style={{ borderColor: "color-mix(in srgb, " + accent + " 30%, var(--line))" }}
        />
        <button
          onClick={() => void ask()}
          disabled={!question.trim() || phase === "thinking"}
          className="min-h-11 rounded-[var(--r-sm)] border px-4 text-sm transition hover:brightness-125 disabled:opacity-40"
          style={{ borderColor: accent, color: accent }}
        >
          {phase === "thinking" ? "Pensando…" : "Preguntar"}
        </button>

        {phase === "unavailable" && (
          <p className="text-[13px] leading-relaxed text-text-faint">
            El tutor (IA) requiere sesión iniciada + keys en la Edge Function. Mientras tanto, el reto en blanco y la
            evaluación heurística funcionan sin conexión.
          </p>
        )}

        {phase === "draft" && (
          <div className="space-y-3 border-t border-line pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] uppercase tracking-[0.18em] text-text-faint">Borrador · edítalo, valídalo</h3>
              {provider && <span className="text-[10px] uppercase tracking-wider text-text-faint">vía {provider}</span>}
            </div>
            <textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setSaved(false);
              }}
              rows={12}
              className="scroll-touch w-full resize-none rounded-[var(--r-sm)] border border-line bg-ink p-3 font-mono text-[13px] text-text focus:border-rank focus:outline-none"
            />
            <button
              onClick={() => void saveAsNote()}
              disabled={!draft.trim() || saved}
              className="min-h-11 w-full rounded-[var(--r-sm)] border border-rank bg-rank-soft px-4 text-sm text-rank transition hover:brightness-125 disabled:opacity-40"
            >
              {saved ? "Guardado como nota ✓" : "Guardar como nota"}
            </button>
            <p className="text-[11px] text-text-faint">
              Es un borrador generado: revísalo y corrígelo antes de tratarlo como verdad. Lo que guardes es tuyo, editado por ti.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
