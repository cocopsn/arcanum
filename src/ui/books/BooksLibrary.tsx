"use client";

import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/ui/use-focus-trap";
import { listBooks, saveBook, deleteBook, totalBookBytes, type BookRow } from "@/lib/book-store";
import { getStorageStatus, type StorageStatus } from "@/lib/storage";
import { BookReader } from "@/ui/books/BookReader";
import { themeForGoal } from "@/lib/subject-themes";
import { readableAccent } from "@/lib/accent";

// The DEEP-READING library — the door for the 100 books. Lists downloaded books by spine (readable
// offline, always), imports a .md the user generated externally (file or paste), and shows honest
// storage use. A .md that doesn't satisfy the contract is rejected honestly (never a faked book).

const MB = (b: number) => (b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

export function BooksLibrary({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [books, setBooks] = useState<BookRow[]>([]);
  const [bytes, setBytes] = useState(0);
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [reading, setReading] = useState<BookRow | null>(null);
  const [importing, setImporting] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useFocusTrap(rootRef);
  async function refresh() {
    setBooks(await listBooks());
    setBytes(await totalBookBytes());
    setStorage(await getStorageStatus());
  }
  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  if (!open) return null;

  async function ingest(md: string) {
    setImporting(true);
    setMsg(null);
    try {
      const saved = await saveBook(md, "import");
      if (!saved) {
        setMsg("Ese .md no cumple el contrato (falta frontmatter o título). No se importó nada — cero contenido inventado.");
        return;
      }
      setMsg(`Importado: «${saved.meta.title}».`);
      setPaste("");
      setPasteOpen(false);
      await refresh();
    } finally {
      setImporting(false);
    }
  }
  async function onFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    await ingest(text);
  }

  const bySpine = new Map<string, BookRow[]>();
  for (const b of books) {
    const key = b.spine || "Sueltos";
    (bySpine.get(key) ?? bySpine.set(key, []).get(key)!).push(b);
  }

  return (
    <div ref={rootRef} role="dialog" aria-modal="true" aria-label="Lecturas" tabIndex={-1} className="fixed inset-0 z-[70] flex flex-col bg-ink outline-none" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-4">
        <span className="font-display text-sm tracking-[0.3em] text-rank">LECTURAS</span>
        <button onClick={onClose} aria-label="Cerrar" className="min-h-11 px-2 text-2xl leading-none text-text-faint transition hover:text-text">×</button>
      </header>

      <main className="scroll-touch mx-auto w-full max-w-md flex-1 overflow-y-auto px-4 pt-3">
        <p className="text-[12px] leading-snug text-text-muted">
          Libros .md generados afuera (en Sonnet 5) e ingeridos aquí. Descargados = se leen sin datos, en el camión. {books.length} libro{books.length === 1 ? "" : "s"} · {MB(bytes)}
          {storage?.usageMB != null && <> · {storage.usageMB} MB usados{storage?.persisted === true ? " (durable ✓)" : storage?.persisted === false ? " (no garantizado)" : ""}</>}
        </p>

        {/* import */}
        <div className="mt-3 flex gap-2">
          <button onClick={() => fileRef.current?.click()} disabled={importing} className="min-h-11 flex-1 rounded-[var(--r-sm)] border border-rank bg-rank-soft text-sm text-rank transition hover:brightness-125 disabled:opacity-40">
            {importing ? "Importando…" : "Importar .md"}
          </button>
          <button onClick={() => setPasteOpen((v) => !v)} className="min-h-11 rounded-[var(--r-sm)] border border-line px-3 text-sm text-text-muted transition hover:text-text">Pegar</button>
        </div>
        <input ref={fileRef} type="file" accept=".md,text/markdown,text/plain" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void onFile(f); }} />
        {pasteOpen && (
          <div className="mt-2">
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={5} placeholder="Pega el .md del libro (con su frontmatter ---)…" className="scroll-touch w-full resize-none rounded-[var(--r-sm)] border border-line bg-surface p-3 font-mono text-[12px] text-text placeholder:text-text-faint focus:outline-none" />
            <button onClick={() => void ingest(paste)} disabled={!paste.trim() || importing} className="mt-1 min-h-11 w-full rounded-[var(--r-sm)] border border-rank px-3 text-sm text-rank transition hover:bg-rank-soft disabled:opacity-40">Ingerir el pegado</button>
          </div>
        )}
        {msg && <p className="mt-2 text-[12px] text-text-muted" role="status" aria-live="polite">{msg}</p>}

        {/* books by spine */}
        {books.length === 0 && <p className="mt-6 text-[13px] text-text-faint">Aún no hay libros. Genera uno en Sonnet 5 (formato de contrato) e impórtalo — es la puerta por donde entran.</p>}
        <div className="mt-4 space-y-5">
          {[...bySpine.entries()].map(([spine, list]) => {
            const theme = themeForGoal(spine);
            return (
              <div key={spine}>
                <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: readableAccent(theme.accent) }}>{spine}</div>
                <div className="mt-1.5 space-y-2">
                  {list.map((b) => (
                    <div key={b.id} className="rounded-[var(--r-md)] border border-line bg-surface p-3">
                      <button onClick={() => setReading(b)} className="block w-full text-left">
                        <div className="font-serif text-[15px] text-text">{b.title}</div>
                        {b.meta.subtitle && <div className="mt-0.5 text-[12px] italic text-text-muted">{b.meta.subtitle}</div>}
                        <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] uppercase tracking-wider text-text-faint">
                          {b.meta.readingMinutes != null && <span style={{ color: readableAccent(theme.accent) }}>{b.meta.readingMinutes} min</span>}
                          <span>{MB(b.bytes)}</span>
                          {b.source === "seed" && <span>ejemplo semilla</span>}
                          {b.moduleId && <span>anclado</span>}
                        </div>
                      </button>
                      <div className="mt-2 flex gap-3">
                        <button onClick={() => setReading(b)} className="min-h-11 text-[12px] uppercase tracking-wider transition hover:underline" style={{ color: readableAccent(theme.accent) }}>Leer</button>
                        <button onClick={async () => { await deleteBook(b.id); await refresh(); }} className="min-h-11 text-[12px] uppercase tracking-wider text-text-faint transition hover:text-amber">Borrar</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {reading && <BookReader book={reading} onClose={() => setReading(null)} />}
    </div>
  );
}
