"use client";

import { useState } from "react";
import { useArcanum } from "@/app/providers";
import { useActions } from "@/ui/use-actions";
import { NoteEditor } from "@/ui/NoteEditor";

export function NotesSheet({
  open,
  onClose,
  moduleId,
  goalId,
}: {
  open: boolean;
  onClose: () => void;
  moduleId?: string | null;
  goalId?: string | null;
}) {
  const notes = useArcanum((s) => s.readModel.notes);
  const { createNote } = useActions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const selected = notes.find((n) => n.id === selectedId) ?? null;
  const scoped =
    moduleId || goalId
      ? notes.filter((n) => (moduleId && n.moduleId === moduleId) || (goalId && n.goalId === goalId))
      : notes;

  async function navigate(title: string) {
    const existing = notes.find((n) => n.title.trim().toLowerCase() === title.trim().toLowerCase());
    if (existing) {
      setSelectedId(existing.id);
      return;
    }
    // create-from-wikilink — the Obsidian flow
    setBusy(true);
    const id = await createNote({ moduleId: moduleId ?? null, goalId: goalId ?? null }, title, "");
    setBusy(false);
    setSelectedId(id);
  }

  async function newNote() {
    setBusy(true);
    const id = await createNote({ moduleId: moduleId ?? null, goalId: goalId ?? null }, "Nueva nota", "");
    setBusy(false);
    setSelectedId(id);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "var(--overlay-scrim)" }}
      onClick={onClose}
    >
      <div
        className="scroll-touch flex max-h-[88vh] w-full max-w-md flex-col overflow-y-auto rounded-t-[var(--r-lg)] border border-line bg-surface-raised p-6 sm:rounded-[var(--r-lg)]"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {selected ? (
          <NoteEditor note={selected} allNotes={notes} onNavigate={navigate} onBack={() => setSelectedId(null)} />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg tracking-[0.14em] text-rank">NOTAS</h2>
              <button
                onClick={newNote}
                disabled={busy}
                className="min-h-11 rounded-[var(--r-sm)] border border-rank px-3 text-sm text-rank transition hover:bg-rank-soft disabled:opacity-40"
              >
                Nueva nota
              </button>
            </div>
            <p className="mb-3 mt-1 text-sm text-text-muted">
              {scoped.length} nota{scoped.length === 1 ? "" : "s"} · markdown crudo, [[wikilinks]] navegables.
            </p>
            <div className="space-y-2">
              {scoped.length === 0 && (
                <p className="text-sm text-text-faint">
                  Aún no hay notas aquí. Una nota nace dentro de un módulo y guarda esa referencia.
                </p>
              )}
              {scoped.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setSelectedId(n.id)}
                  className="block w-full rounded-[var(--r-md)] border border-line bg-surface p-3 text-left transition hover:border-rank"
                >
                  <div className="font-serif text-text">{n.title || "(sin título)"}</div>
                  <div className="mt-0.5 truncate text-xs text-text-faint">
                    {n.markdown.replace(/[#*[\]]/g, "").trim().slice(0, 80) || "vacía"}
                  </div>
                  {(n.links.length > 0 || n.backlinks.length > 0) && (
                    <div className="mt-1 flex gap-3 text-[10px] uppercase tracking-wider text-topic">
                      {n.links.length > 0 && <span>{n.links.length} enlaces</span>}
                      {n.backlinks.length > 0 && <span>{n.backlinks.length} backlinks</span>}
                    </div>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="mt-5 min-h-11 w-full text-xs uppercase tracking-[0.2em] text-text-faint transition hover:text-text-muted"
            >
              Cerrar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
