"use client";

import { useMemo, useRef, useState } from "react";
import { useArcanum } from "@/app/providers";
import { useActions } from "@/ui/use-actions";
import { useFocusTrap } from "@/ui/use-focus-trap";
import { ocrImage } from "@/sync/ai";
import { NoteWysiwyg } from "@/ui/notes/NoteWysiwyg";
import { NotesGraph } from "@/ui/notes/NotesGraph";
import { splitInk } from "@/lib/note-ink";

// The Notes MODULE — full-screen second brain (replaces the old dropdown sheet). Three surfaces: the
// list (scoped to a cell when opened from one), the WYSIWYG editor, and the graph (note↔note +
// note↔cell). The markdown serialized by the editor is the source of truth in the log; everything here
// is derived. iPhone-first.

type View = "list" | "editor" | "graph";

export function NotesModule({
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
  const modules = useArcanum((s) => s.readModel.modules);
  const { createNote } = useActions();
  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ocr, setOcr] = useState<{ status: "idle" | "processing" | "error"; message?: string }>({ status: "idle" });
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useFocusTrap(rootRef);

  const cells = useMemo(
    () => modules.filter((m) => !m.archived).map((m) => ({ id: m.id, title: m.title })),
    [modules],
  );

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
      setView("editor");
      return;
    }
    setBusy(true);
    const id = await createNote({ moduleId: moduleId ?? null, goalId: goalId ?? null }, title, "");
    setBusy(false);
    setSelectedId(id);
    setView("editor");
  }

  async function newNote() {
    setBusy(true);
    const id = await createNote({ moduleId: moduleId ?? null, goalId: goalId ?? null }, "Nueva nota", "");
    setBusy(false);
    setSelectedId(id);
    setView("editor");
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
      const id = await createNote({ moduleId: moduleId ?? null, goalId: goalId ?? null }, "Página manuscrita", markdown);
      setOcr({ status: "idle" });
      setSelectedId(id);
      setView("editor");
    } catch (e) {
      setOcr({ status: "error", message: e instanceof Error ? e.message : "El OCR falló." });
    }
  }

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Notas"
      tabIndex={-1}
      className="fixed inset-0 z-[70] flex flex-col bg-ink outline-none"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      // full-screen → it owns its clicks; stop them reaching any click-to-close backdrop it's nested in
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          if (view === "editor") {
            setView("list");
            setSelectedId(null);
          } else onClose();
        }
      }}
    >
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-4">
        <span className="font-display text-sm tracking-[0.3em] text-rank">NOTAS</span>
        <div className="flex items-center gap-1">
          {view !== "editor" && (
            <>
              <Tab on={view === "list"} onClick={() => setView("list")}>Lista</Tab>
              <Tab on={view === "graph"} onClick={() => setView("graph")}>Grafo</Tab>
            </>
          )}
          <button onClick={onClose} aria-label="Cerrar notas" className="min-h-11 px-2 text-2xl leading-none text-text-faint transition hover:text-text">×</button>
        </div>
      </header>

      <main className="scroll-touch mx-auto w-full max-w-md flex-1 overflow-y-auto px-4 pt-3">
        {view === "editor" && selected ? (
          <NoteWysiwyg note={selected} cells={cells} onNavigate={navigate} onBack={() => { setView("list"); setSelectedId(null); }} />
        ) : view === "graph" ? (
          // React Flow needs an explicit height — a flex-1/overflow-auto parent would collapse it to 0
          <div style={{ height: "72vh" }}>
            <NotesGraph notes={notes} cells={cells} onOpen={(id) => { setSelectedId(id); setView("editor"); }} />
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <button onClick={() => void newNote()} disabled={busy} className="min-h-11 flex-1 rounded-[var(--r-sm)] border border-rank bg-rank-soft text-sm text-rank transition hover:brightness-125 disabled:opacity-40">Nueva nota</button>
              <button onClick={() => fileRef.current?.click()} disabled={ocr.status === "processing"} className="min-h-11 rounded-[var(--r-sm)] border border-line px-3 text-sm text-text-muted transition hover:border-topic hover:text-topic disabled:opacity-40">
                {ocr.status === "processing" ? "Leyendo…" : "OCR foto"}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void handleFile(f); }} />
            {ocr.status === "error" && <p className="mt-2 text-sm text-amber" role="status">{ocr.message}</p>}
            <p className="mb-3 mt-2 text-[12px] text-text-muted">
              {scoped.length} nota{scoped.length === 1 ? "" : "s"}{moduleId || goalId ? " en esta celda" : ""} · editor WYSIWYG, [[wikilinks]], dibujo y grafo.
            </p>
            <div className="space-y-2">
              {scoped.length === 0 && (
                <p className="text-sm text-text-faint">Aún no hay notas aquí. La primera nace con un toque.</p>
              )}
              {scoped.map((n) => {
                const { prose, inks } = splitInk(n.markdown);
                return (
                  <button
                    key={n.id}
                    onClick={() => { setSelectedId(n.id); setView("editor"); }}
                    className="block w-full rounded-[var(--r-md)] border border-line bg-surface p-3 text-left transition hover:border-rank"
                  >
                    <div className="font-serif text-text">{n.title || "(sin título)"}</div>
                    <div className="mt-0.5 truncate text-xs text-text-faint">
                      {prose.replace(/[#*[\]>`-]/g, "").trim().slice(0, 80) || (inks.length ? "dibujo" : "vacía")}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-[10px] uppercase tracking-wider text-topic">
                      {n.links.length > 0 && <span>{n.links.length} enlaces</span>}
                      {n.backlinks.length > 0 && <span>{n.backlinks.length} backlinks</span>}
                      {inks.length > 0 && <span className="text-rank">{inks.length} dibujo{inks.length === 1 ? "" : "s"}</span>}
                      {n.moduleId && <span className="text-text-faint">anclada</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Tab({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className="min-h-11 rounded-[var(--r-sm)] px-3 text-[11px] uppercase tracking-[0.18em] transition"
      style={{ color: on ? "var(--rank)" : "var(--text-faint)", background: on ? "var(--rank-soft)" : "transparent" }}
    >
      {children}
    </button>
  );
}
