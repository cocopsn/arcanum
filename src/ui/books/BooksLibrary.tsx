"use client";

import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/ui/use-focus-trap";
import { useReward } from "@/ui/reward/RewardProvider";
import { audio } from "@/lib/audio";
import { listBooks, saveBook, deleteBook, totalBookBytes, type BookRow } from "@/lib/book-store";
import { listBanks, saveExerciseBank, deleteBank, totalBankBytes, type ExerciseBankRow } from "@/lib/exercise-store";
import { runJs } from "@/lib/js-runner";
import { runPy } from "@/lib/py-runner";
import { getStorageStatus, type StorageStatus } from "@/lib/storage";
import { saveResume } from "@/lib/resume";
import { BookReader } from "@/ui/books/BookReader";
import { useArcanum } from "@/app/providers";
import type { LibraryRow } from "@/lib/library/types";
import type { ReadModel } from "@/core/read-model";
import { chunkErrorText } from "@/lib/chunk-error";
import { useLazyModule, chunkContext } from "@/ui/books/library/use-lazy-module";

// The DEEP-READING library — the door for the 100 books. Lists downloaded books by spine (readable
// offline, always), imports a .md the user generated externally (file or paste), and shows honest
// storage use. A .md that doesn't satisfy the contract is rejected honestly (never a faked book).

export const INTRO_TEXT = "Libros y bancos de todos los mundos. Cada uno dice quién lo generó.";
export const EMPTY_TEXT = "Importa un .md que cumpla el contrato de libros.";

const MB = (b: number) => (b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

export function BooksLibrary({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reward = useReward();
  const [books, setBooks] = useState<BookRow[]>([]);
  const [banks, setBanks] = useState<ExerciseBankRow[]>([]);
  const [bytes, setBytes] = useState(0);
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [reading, setReading] = useState<BookRow | null>(null);
  const [importing, setImporting] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const readModel = useArcanum((s) => s.readModel);
  const rootRef = useRef<HTMLDivElement>(null);

  // resume: remember the Lecturas overlay across reloads. This component stays MOUNTED with an
  // `open` prop (no mount/cleanup lifecycle), so it mirrors the prop instead; the boot-time
  // `false` write is harmless because HomeView snapshots the stored location before this runs.
  useEffect(() => {
    saveResume({ library: open });
  }, [open]);

  useFocusTrap(rootRef);
  async function refresh() {
    setBooks(await listBooks());
    setBanks(await listBanks());
    setBytes((await totalBookBytes()) + (await totalBankBytes()));
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
      // route by frontmatter kind: an exercise bank re-validates every reference solution before landing;
      // anything else is treated as a book (the existing contract).
      const isExercises = /^﻿?---[\s\S]*?\bkind\s*:\s*exercises\b/i.test(md);
      if (isExercises) {
        const res = await saveExerciseBank(md, { source: "import", jsRun: runJs, pyRun: runPy });
        if (!res.ok) {
          audio.cue("error"); // rejected — you hear it before you read it
          setMsg([res.error, ...(res.details ?? [])].join(" "));
          return;
        }
        setMsg(`Banco de ejercicios importado: «${res.bank.meta.title}» (${res.bank.count} ejercicios, validados).`);
        reward("small", { sfx: "import" }); // the reward's own visual, but the ingest SETTLE as its voice
      } else {
        const saved = await saveBook(md, "import");
        if (!saved) {
          audio.cue("error");
          setMsg("Ese .md no cumple el contrato (falta frontmatter o título). No se importó nada — cero contenido inventado.");
          return;
        }
        setMsg(`Libro importado: «${saved.meta.title}».`);
        reward("small", { sfx: "import" });
      }
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

  async function deleteImport(row: LibraryRow) {
    const [kind, ...rest] = row.key.split(":");
    const id = rest.join(":");
    if (kind === "libro") await deleteBook(id);
    else if (kind === "banco") await deleteBank(id);
    await refresh();
  }

  return (
    <div ref={rootRef} role="dialog" aria-modal="true" aria-label="Lecturas" tabIndex={-1} className="fixed inset-0 z-[70] flex flex-col bg-ink pb-safe pt-safe outline-none" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <header className="mx-auto flex w-full max-w-md shrink-0 items-center justify-between px-safe sm:max-w-2xl">
        <span className="font-display text-sm tracking-[0.3em] text-rank">LECTURAS</span>
        <button onClick={onClose} aria-label="Cerrar" className="tap grid shrink-0 place-items-center text-2xl leading-none text-text-faint transition hover:text-text">×</button>
      </header>

      <div className="mx-auto w-full max-w-md shrink-0 px-safe pt-2 sm:max-w-2xl">
        <p className="text-[12px] leading-snug text-text-muted" data-lecturas-intro="">
          {INTRO_TEXT} {MB(bytes)} en este dispositivo
          {storage?.usageMB != null && <> · {storage.usageMB} MB usados{storage?.persisted === true ? " (durable ✓)" : storage?.persisted === false ? " (no garantizado)" : ""}</>}
        </p>
        <details className="mt-2 rounded-[var(--r-sm)] border border-line" open={importOpen} onToggle={(e) => setImportOpen((e.target as HTMLDetailsElement).open)}>
          <summary className="flex min-h-11 cursor-pointer items-center px-3 text-[12px] uppercase tracking-wider text-text-muted">Importar .md</summary>
          <div className="px-3 pb-3">
            <div className="flex gap-2">
              <button onClick={() => fileRef.current?.click()} disabled={importing} className="min-h-11 flex-1 rounded-[var(--r-sm)] border border-rank bg-rank-soft text-sm text-rank transition hover:brightness-125 disabled:opacity-40">
                {importing ? "Importando…" : "Elegir archivo"}
              </button>
              <button onClick={() => setPasteOpen((v) => !v)} className="min-h-11 rounded-[var(--r-sm)] border border-line px-3 text-sm text-text-muted transition hover:text-text">Pegar</button>
            </div>
            <input ref={fileRef} type="file" accept=".md,text/markdown,text/plain" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void onFile(f); }} />
            {pasteOpen && (
              <div className="mt-2">
                <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={5} placeholder="Pega el .md del libro o del banco (con su frontmatter ---)…" className="scroll-touch w-full resize-none rounded-[var(--r-sm)] border border-line bg-surface p-3 font-mono text-[12px] text-text placeholder:text-text-faint focus:outline-none" />
                <button onClick={() => void ingest(paste)} disabled={!paste.trim() || importing} className="mt-1 min-h-11 w-full rounded-[var(--r-sm)] border border-rank px-3 text-sm text-rank transition hover:bg-rank-soft disabled:opacity-40">Ingerir el pegado</button>
              </div>
            )}
            {books.length === 0 && banks.length === 0 && <p className="mt-2 text-[12px] text-text-faint">{EMPTY_TEXT}</p>}
          </div>
        </details>
        {msg && <p className="mt-2 text-[12px] text-text-muted" role="status" aria-live="polite">{msg}</p>}
      </div>

      <CatalogSlot books={books} banks={banks} readModel={readModel} onDeleteImport={deleteImport} onRead={setReading} />

      {reading && <BookReader book={reading} onClose={() => setReading(null)} />}
    </div>
  );
}

// El catálogo vive en su propio chunk (design poblar §5.7) y sólo se pide con Lecturas abierta. Un chunk que no llega
// deja la lista simple en pie.
function CatalogSlot({ books, banks, readModel, onDeleteImport, onRead }: { books: BookRow[]; banks: ExerciseBankRow[]; readModel: ReadModel; onDeleteImport(row: LibraryRow): Promise<void>; onRead(b: BookRow): void }) {
  const catalog = useLazyModule(() => import("./library/LibraryCatalog"));
  if (catalog.estado === "listo") {
    const Catalog = catalog.mod.default;
    return <Catalog books={books} banks={banks} readModel={readModel} onDeleteImport={onDeleteImport} />;
  }
  if (catalog.estado === "cargando") return <p className="mx-auto w-full max-w-md px-safe pt-3 text-[12px] text-text-muted">Cargando el catálogo…</p>;
  return <SimpleList books={books} onRead={onRead} onRetry={catalog.reintentar} />;
}
/** Lo que queda en pie si el chunk del catálogo no llega (§5.7): la lista de Dexie de este dispositivo, el texto de
 *  chunkErrorText() y «Reintentar» (más «Recargar» si es un desfase de versión). */
function SimpleList({ books, onRead, onRetry }: { books: BookRow[]; onRead(b: BookRow): void; onRetry(): void }) {
  const { tipo, texto } = chunkErrorText(chunkContext());
  return (
    <main className="scroll-touch mx-auto w-full max-w-md flex-1 overflow-y-auto px-safe pt-3" data-lecturas-simple="">
      <div role="alert" className="rounded-[var(--r-sm)] border border-line p-3">
        <p className="text-[12px] text-text-muted">{texto}</p>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={onRetry} className="tap border border-line px-3 text-[12px] text-text">Reintentar</button>
          {tipo === "stale" && <button type="button" onClick={() => window.location.reload()} className="tap border border-line px-3 text-[12px] text-text">Recargar</button>}
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {books.map((b) => (
          <div key={b.id} className="flex items-center justify-between gap-2 rounded-[var(--r-md)] border border-line bg-surface p-3">
            <span className="min-w-0 truncate font-serif text-[15px] text-text" title={b.title}>{b.title}</span>
            <button type="button" onClick={() => onRead(b)} className="tap shrink-0 px-2 text-[12px] uppercase tracking-wider text-text-muted">Leer</button>
          </div>
        ))}
      </div>
    </main>
  );
}
