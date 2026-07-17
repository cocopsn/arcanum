"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { NoteRM } from "@/core/read-model";
import { useActions } from "@/ui/use-actions";
import { noteExtensions, serializeProse } from "@/lib/note-editor";
import { splitInk, joinInk, type InkDrawing } from "@/lib/note-ink";
import { InkCanvas, InkReplay } from "@/ui/notes/InkCanvas";
import { audio } from "@/lib/audio";

type SaveState = "saved" | "saving";
interface Cell { id: string; title: string }

// The full WYSIWYG note editor. Prose ↔ TipTap; drawings ride alongside in the serialized markdown
// (splitInk/joinInk). Autosave is REAL (debounced → note.updated, true save state). Re-seeds ONLY when
// a DIFFERENT note opens (note.id changes), never under a remote edit mid-typing (the established
// concurrency policy — the log stays truth, last-write-wins on the next save).
export function NoteWysiwyg({
  note,
  cells,
  onNavigate,
  onBack,
}: {
  note: NoteRM;
  cells: Cell[];
  onNavigate: (title: string) => void;
  onBack: () => void;
}) {
  const { updateNote, anchorNote } = useActions();
  const initial = useMemo(() => splitInk(note.markdown), [note.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [title, setTitle] = useState(note.title);
  const [inks, setInks] = useState<InkDrawing[]>(initial.inks);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [drawing, setDrawing] = useState(false);
  const [pickAnchor, setPickAnchor] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const openNoteId = useRef(note.id);
  const inksRef = useRef<InkDrawing[]>(initial.inks);
  const titleRef = useRef(note.title);
  const savingRef = useRef(false); // is a debounced save pending?
  inksRef.current = inks;
  titleRef.current = title;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: noteExtensions(onNavigate),
    content: initial.prose,
    editorProps: { attributes: { class: "note-editor focus:outline-none" } },
    onUpdate: () => scheduleSave(),
  });

  // Persist to a SPECIFIC note id (never "the current note" — a stale timer must land on the note it
  // was scheduled for, never the one now open). Saves the editor's current prose + the given drawings.
  function persist(noteId: string, nextTitle: string, nextInks: InkDrawing[]) {
    if (!editor) return;
    const md = joinInk(serializeProse(editor), nextInks);
    savingRef.current = false;
    void updateNote(noteId, nextTitle, md).then(() => {
      if (openNoteId.current === noteId) {
        setSaveState("saved");
        audio.sfx("saved"); // debounced → fires when typing settles, and is nearly subliminal by design
      }
    });
  }
  const persistRef = useRef(persist);
  persistRef.current = persist;

  function scheduleSave() {
    savingRef.current = true;
    setSaveState("saving");
    window.clearTimeout(timer.current);
    const id = openNoteId.current;
    timer.current = window.setTimeout(() => persist(id, titleRef.current, inksRef.current), 700);
  }
  function saveNow(nextTitle = titleRef.current, nextInks = inksRef.current) {
    window.clearTimeout(timer.current);
    setSaveState("saving");
    persist(openNoteId.current, nextTitle, nextInks);
  }

  // Re-seed when a DIFFERENT note opens — FLUSH the previous note's pending edit first (the editor
  // still holds its content here), so a fast switch never loses an edit nor writes it to the wrong note.
  useEffect(() => {
    if (!editor) return;
    if (openNoteId.current === note.id) return;
    window.clearTimeout(timer.current);
    if (savingRef.current) persist(openNoteId.current, titleRef.current, inksRef.current);
    openNoteId.current = note.id;
    const next = splitInk(note.markdown);
    editor.commands.setContent(next.prose, false); // false = don't emit onUpdate (loading ≠ a user edit → no spurious save-on-open)
    setTitle(note.title);
    setInks(next.inks);
    setSaveState("saved");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, note.id, note.markdown, note.title]);

  // On unmount (e.g. tapping "← Notas" or closing the module while a save is pending) FLUSH it —
  // never lose the last <700ms of edits. Runs before useEditor tears the editor down (reverse order).
  useEffect(() => {
    return () => {
      window.clearTimeout(timer.current);
      if (savingRef.current) persistRef.current(openNoteId.current, titleRef.current, inksRef.current);
    };
  }, []);

  function addDrawing(ink: InkDrawing) {
    const next = [...inksRef.current, ink];
    setInks(next);
    saveNow(titleRef.current, next);
  }
  function deleteDrawing(id: string) {
    const next = inksRef.current.filter((i) => i.id !== id);
    setInks(next);
    saveNow(titleRef.current, next);
  }
  function insertOcr(markdown: string) {
    if (!editor) return;
    const current = serializeProse(editor);
    editor.commands.setContent(current ? `${current}\n\n${markdown}` : markdown, false); // saveNow persists it explicitly
    saveNow();
  }

  const anchorCell = cells.find((c) => c.id === note.moduleId) ?? null;
  const backlinkCount = note.backlinks.length;

  return (
    <div className="flex min-h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="min-h-11 text-xs uppercase tracking-wider text-text-faint transition hover:text-text">← Notas</button>
        <span className="text-[11px] text-text-faint" aria-live="polite">{saveState === "saving" ? "guardando…" : "guardado"}</span>
      </div>

      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          scheduleSave();
        }}
        placeholder="Título"
        className="bg-transparent font-display text-xl tracking-wide text-text outline-none placeholder:text-text-faint"
      />

      {/* anchor to a cell — crosses knowledge (notes) with learning (cells) */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="uppercase tracking-[0.18em] text-text-faint">Celda:</span>
        {anchorCell ? (
          <span className="rounded-[var(--r-sm)] border border-topic px-2 py-0.5 text-topic">{anchorCell.title}</span>
        ) : (
          <span className="text-text-faint">sin anclar</span>
        )}
        <button onClick={() => setPickAnchor((v) => !v)} className="min-h-11 px-1 uppercase tracking-wider text-text-muted transition hover:text-text">
          {anchorCell ? "cambiar" : "anclar"}
        </button>
        {anchorCell && (
          <button onClick={() => void anchorNote(note.id, null)} className="min-h-11 px-1 uppercase tracking-wider text-text-faint transition hover:text-amber">quitar</button>
        )}
      </div>
      {pickAnchor && (
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-[var(--r-sm)] border border-line bg-surface p-2">
          {cells.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                void anchorNote(note.id, c.id);
                setPickAnchor(false);
              }}
              className="block w-full truncate rounded-[var(--r-xs,4px)] px-2 py-1.5 text-left text-[12px] text-text-muted transition hover:bg-surface-raised hover:text-text"
            >
              {c.title}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-[var(--r-sm)] border border-line bg-ink p-3">
        <EditorContent editor={editor} />
      </div>

      {/* drawings (Plumita) — saved strokes live in the note */}
      <div className="space-y-2">
        {inks.map((ink) => (
          <InkReplay key={ink.id} ink={ink} onDelete={() => deleteDrawing(ink.id)} />
        ))}
        <button
          onClick={() => setDrawing(true)}
          className="min-h-11 w-full rounded-[var(--r-sm)] border border-dashed border-line text-[12px] uppercase tracking-[0.16em] text-text-faint transition hover:border-rank hover:text-rank"
        >
          + Dibujar (Plumita)
        </button>
      </div>

      {backlinkCount > 0 && (
        <div className="border-t border-line pt-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-faint">Backlinks · {backlinkCount}</div>
        </div>
      )}

      {drawing && (
        <InkCanvas
          onSave={addDrawing}
          onConvert={insertOcr}
          onClose={() => setDrawing(false)}
        />
      )}
    </div>
  );
}
