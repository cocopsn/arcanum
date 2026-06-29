"use client";

import { useEffect, useRef, useState } from "react";
import { useArcanum } from "@/app/providers";
import { useActions } from "@/ui/use-actions";
import { NoteEditor } from "@/ui/NoteEditor";
import { ocrImage } from "@/sync/ai";

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
  const [ocr, setOcr] = useState<{ status: "idle" | "processing" | "error"; message?: string }>({
    status: "idle",
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus the panel on open so Escape is captured in THIS sheet's subtree (it is
  // often nested inside another sheet's overlay).
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

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

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setOcr({ status: "processing" });
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("No se pudo leer la imagen."));
        r.readAsDataURL(file);
      });
      const { markdown } = await ocrImage(dataUrl);
      const id = await createNote(
        { moduleId: moduleId ?? null, goalId: goalId ?? null },
        "Página manuscrita",
        markdown,
      );
      setOcr({ status: "idle" });
      setSelectedId(id);
    } catch (e) {
      setOcr({ status: "error", message: e instanceof Error ? e.message : "El OCR falló." });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "var(--overlay-scrim)" }}
      onClick={(e) => {
        // nested inside other sheets — don't bubble the close up and dismiss them too
        e.stopPropagation();
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="scroll-touch flex max-h-[88vh] w-full max-w-md flex-col overflow-y-auto rounded-t-[var(--r-lg)] border border-line bg-surface-raised p-6 outline-none sm:rounded-[var(--r-lg)]"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {selected ? (
          <NoteEditor note={selected} allNotes={notes} onNavigate={navigate} onBack={() => setSelectedId(null)} />
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg tracking-[0.14em] text-rank">NOTAS</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={ocr.status === "processing"}
                  className="min-h-11 rounded-[var(--r-sm)] border border-line px-3 text-sm text-text-muted transition hover:border-topic hover:text-topic disabled:opacity-40"
                >
                  {ocr.status === "processing" ? "Leyendo…" : "OCR"}
                </button>
                <button
                  onClick={newNote}
                  disabled={busy}
                  className="min-h-11 rounded-[var(--r-sm)] border border-rank px-3 text-sm text-rank transition hover:bg-rank-soft disabled:opacity-40"
                >
                  Nueva nota
                </button>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                void handleFile(f);
              }}
            />
            {ocr.status === "error" && <p className="mt-2 text-sm text-amber">{ocr.message}</p>}
            <p className="mb-3 mt-1 text-sm text-text-muted">
              {scoped.length} nota{scoped.length === 1 ? "" : "s"} · markdown crudo, [[wikilinks]] navegables. OCR vía Edge Function.
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
