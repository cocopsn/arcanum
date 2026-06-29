"use client";

import { useEffect, useRef, useState } from "react";
import type { NoteRM } from "@/core/read-model";
import { useActions } from "@/ui/use-actions";
import { NotePreview } from "@/ui/NotePreview";

type SaveState = "saved" | "saving";

export function NoteEditor({
  note,
  allNotes,
  onNavigate,
  onBack,
}: {
  note: NoteRM;
  allNotes: NoteRM[];
  onNavigate: (title: string) => void;
  onBack: () => void;
}) {
  const { updateNote } = useActions();
  const [title, setTitle] = useState(note.title);
  const [markdown, setMarkdown] = useState(note.markdown);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const timer = useRef<number | undefined>(undefined);

  // re-sync editor when a different note is opened (e.g. via wikilink)
  useEffect(() => {
    setTitle(note.title);
    setMarkdown(note.markdown);
    setSaveState("saved");
  }, [note.id, note.title, note.markdown]);

  function scheduleSave(nextTitle: string, nextMarkdown: string) {
    setSaveState("saving");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void updateNote(note.id, nextTitle, nextMarkdown).then(() => setSaveState("saved"));
    }, 700);
  }

  const backlinkNotes = note.backlinks
    .map((id) => allNotes.find((n) => n.id === id))
    .filter((n): n is NoteRM => Boolean(n));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="min-h-11 text-xs uppercase tracking-wider text-text-faint transition hover:text-text">
          ← Notas
        </button>
        <span className="text-[11px] text-text-faint" aria-live="polite">
          {saveState === "saving" ? "guardando…" : "guardado"}
        </span>
      </div>

      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          scheduleSave(e.target.value, markdown);
        }}
        placeholder="Título"
        className="bg-transparent font-display text-lg tracking-wide text-text outline-none placeholder:text-text-faint"
      />

      <div className="flex gap-3 text-xs uppercase tracking-wider">
        <button onClick={() => setTab("edit")} className={tab === "edit" ? "text-rank" : "text-text-faint"}>
          Editar
        </button>
        <button onClick={() => setTab("preview")} className={tab === "preview" ? "text-rank" : "text-text-faint"}>
          Vista
        </button>
      </div>

      {tab === "edit" ? (
        <textarea
          value={markdown}
          onChange={(e) => {
            setMarkdown(e.target.value);
            scheduleSave(title, e.target.value);
          }}
          placeholder="# Markdown crudo… enlaza con [[Otra nota]]"
          rows={12}
          className="scroll-touch w-full resize-none rounded-[var(--r-sm)] border border-line bg-ink p-3 font-mono text-sm text-text outline-none focus:border-rank"
        />
      ) : (
        <div className="min-h-[220px] rounded-[var(--r-sm)] border border-line bg-ink p-3">
          <NotePreview markdown={markdown} onNavigate={onNavigate} />
        </div>
      )}

      {backlinkNotes.length > 0 && (
        <div className="border-t border-line pt-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-faint">
            Backlinks · {backlinkNotes.length}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {backlinkNotes.map((n) => (
              <button
                key={n.id}
                onClick={() => onNavigate(n.title)}
                className="rounded-[var(--r-sm)] border border-line px-2.5 py-1 text-xs text-topic transition hover:border-topic"
              >
                {n.title || "(sin título)"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
