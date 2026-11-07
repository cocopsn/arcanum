"use client";
// El catálogo de Lecturas (design poblar §5.4–§5.6). Se carga con useLazyModule desde BooksLibrary, así que nada de aquí
// entra al chunk de página. Lista los libros y bancos de TODOS los mundos: los clásicos de Dexie, las importaciones y las
// 136 celdas de Engineering Forge del índice del build. Se filtra por mundo, ruta y estado, se busca por título, celda o
// código, y cada fila dice quién la generó. Una celda sellada nunca ofrece trabajo (fog-of-war). Las filas sólo pintan
// título, celda, ruta, minutos, ítems, estados y generated_by (D12).
import { useEffect, useMemo, useState } from "react";
import type { BookRow } from "@/lib/book-store";
import { getBookForModule } from "@/lib/book-store";
import type { ExerciseBankRow } from "@/lib/exercise-store";
import type { ReadModel } from "@/core/read-model";
import type { LibraryRow, Autoria } from "@/lib/library/types";
import { classicRows } from "@/lib/library/catalog";
import {
  applyFilter,
  DEFAULT_FILTER,
  estadoOptions,
  groupByWorld,
  loadFilter,
  routeOptions,
  saveFilter,
  totals,
  worldOptions,
  type Estado,
  type LibraryFilter,
} from "@/lib/library/filter";
import { forgeLibraryIndex, forgeRows } from "@/forge/model/library-catalog";
import type { LibraryIndex } from "@/forge/model/library-types";
import { forgeBookCacheFiles } from "@/lib/offline/api";
import { FORGE_FAMILIES, FORGE_SPINE } from "@/lib/spines-forge";
import { FORGE_GOAL_ID } from "@/core/forge-verdict";
import { forgeCellId, isForgeCellId } from "@/forge/ids";
import { BookReader } from "@/ui/books/BookReader";
import { ExerciseMode } from "@/ui/exercises/ExerciseMode";
import { chunkErrorText } from "@/lib/chunk-error";
import { useLazyModule, chunkContext } from "@/ui/books/library/use-lazy-module";
import { themeForGoal } from "@/lib/subject-themes";
import { readableAccent } from "@/lib/accent";

const AUTORIA_LABEL: Record<Autoria, string> = {
  verificado: "Verificado",
  autorado: "Autorado",
  especificado: "Especificado",
  importado: "Importado",
  incompleta: "Ficha incompleta",
};
export const CLASSIC_NOTE = "En los mundos clásicos, Autorado quiere decir publicado y válido; la verificación registrada sólo existe en Engineering Forge.";
export const INTRO = "Libros y bancos de todos los mundos. Cada uno dice quién lo generó.";

async function sha10(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 10);
}

type Sheet =
  | { kind: "leer"; book: BookRow; forge: boolean }
  | { kind: "ejercicios"; row: LibraryRow }
  | { kind: "evaluaciones"; row: LibraryRow }
  | null;
type ForgeState = { estado: "cargando" } | { estado: "listo"; rows: LibraryRow[] } | { estado: "error" };

export default function LibraryCatalog({
  books,
  banks,
  readModel,
  onDeleteImport,
}: {
  books: BookRow[];
  banks: ExerciseBankRow[];
  readModel: ReadModel;
  /** borra una importación (libro o banco) y refresca la lista */
  onDeleteImport(row: LibraryRow): Promise<void>;
}) {
  const [forge, setForge] = useState<ForgeState>({ estado: "cargando" });
  const [attempt, setAttempt] = useState(0);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [rowNote, setRowNote] = useState<{ key: string; text: string; retry?: () => void } | null>(null);

  // ── filas de Forge: índice + instantánea del dispositivo (una vez por apertura, §5.3) ──
  useEffect(() => {
    let alive = true;
    setForge({ estado: "cargando" });
    void (async () => {
      const index: LibraryIndex | null = await forgeLibraryIndex();
      if (!index) {
        if (alive) setForge({ estado: "error" });
        return;
      }
      const forgeBooks = books.filter((b) => isForgeCellId(b.moduleId));
      const forgeBanks = banks.filter((b) => isForgeCellId(b.moduleId));
      const bookSha10 = new Map<string, string>();
      for (const b of forgeBooks) if (b.moduleId) bookSha10.set(b.moduleId, await sha10(b.md));
      const bankSha10 = new Map<string, string>();
      for (const b of forgeBanks) if (b.moduleId && b.source === "seed") bankSha10.set(b.moduleId, await sha10(b.md));
      const cacheFiles = await forgeBookCacheFiles().catch(() => null);
      const rows = forgeRows({
        index,
        readModel,
        books: forgeBooks,
        banks: forgeBanks,
        bookSha10,
        bankSha10,
        cacheFiles,
        precacheListo: typeof navigator !== "undefined" && !!navigator.serviceWorker?.controller,
      });
      if (alive) setForge({ estado: "listo", rows });
    })();
    return () => {
      alive = false;
    };
  }, [books, banks, readModel, attempt]);

  const classic = useMemo(() => classicRows(books, banks, readModel), [books, banks, readModel]);
  const rows = useMemo(() => [...classic, ...(forge.estado === "listo" ? forge.rows : [])], [classic, forge]);

  // ── filtro (preferencia del dispositivo, validada contra lo vivo) ──
  const liveGoals = useMemo(() => readModel.goals.filter((g) => !g.archived), [readModel.goals]);
  const pathsFor = (world: string): { id: string; name: string; group?: string }[] => {
    if (world === FORGE_GOAL_ID) {
      const famOf = new Map<string, string>();
      for (const f of FORGE_FAMILIES) for (const s of f.paths) famOf.set(s, f.family);
      return FORGE_SPINE.paths.map((p) => ({ id: p.id, name: p.name, group: famOf.get(p.slug) }));
    }
    return readModel.paths.filter((p) => p.goalId === world && !p.archived).sort((a, b) => a.order - b.order).map((p) => ({ id: p.id, name: p.name }));
  };
  const [filter, setFilterState] = useState<LibraryFilter>(() =>
    loadFilter({
      worlds: new Set([...readModel.goals.filter((g) => !g.archived).map((g) => g.id), "~"]),
      routes: (w) => new Set([...pathsFor(w).map((p) => p.id), "~"]),
    }),
  );
  const setFilter = (f: LibraryFilter) => {
    setFilterState(f);
    saveFilter(f);
  };
  const filtered = useMemo(() => applyFilter(rows, filter), [rows, filter]);
  const groups = useMemo(() => groupByWorld(filtered, liveGoals.map((g) => g.id)), [filtered, liveGoals]);
  const t = totals(filtered);
  const worldOpts = worldOptions(rows, filter, liveGoals);
  const routeOpts = routeOptions(rows, filter, filter.world === "*" ? [] : pathsFor(filter.world));
  const estadoOpts = estadoOptions(rows, filter);
  const hasClassic = filtered.some((r) => r.source !== "forge" && r.world.goalId !== FORGE_GOAL_ID);

  // ── acciones ──
  async function leer(row: LibraryRow) {
    setRowNote(null);
    if (row.source !== "forge") {
      const b = books.find((x) => `libro:${x.id}` === row.key);
      if (b) setSheet({ kind: "leer", book: b, forge: false });
      return;
    }
    const code = row.cell.code!;
    try {
      const { ensureForgeBook } = await import("@/forge/loaders");
      const r = await ensureForgeBook(code, readModel);
      if (!r.ok) {
        const text =
          r.reason === "no-descargado"
            ? "Libro no descargado · requiere conexión una vez"
            : r.reason === "formato"
              ? "Libro dañado en esta versión"
              : r.reason === "despues-del-intento"
                ? "La lectura se abre después de tu primer intento"
                : "Libro pendiente";
        setRowNote({ key: row.key, text, retry: r.reason === "no-descargado" ? () => void leer(row) : undefined });
        return;
      }
      const b = await getBookForModule(forgeCellId(code));
      if (b) setSheet({ kind: "leer", book: b, forge: true });
    } catch (e) {
      console.warn("[lecturas] el lector de Forge no cargó", e);
      setRowNote({ key: row.key, text: chunkErrorText(chunkContext()).texto, retry: () => void leer(row) });
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto w-full max-w-md shrink-0 px-safe pt-3 sm:max-w-2xl">
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={filter.q}
            onChange={(e) => setFilterState({ ...filter, q: e.target.value.slice(0, 120) })}
            placeholder="Buscar por título, celda o código"
            aria-label="Buscar en Lecturas"
            maxLength={120}
            className="min-h-11 min-w-0 flex-1 rounded-[var(--r-sm)] border border-line bg-surface px-3 text-[16px] text-text placeholder:text-text-faint focus:outline-none"
          />
          {filter.q && (
            <button type="button" onClick={() => setFilterState({ ...filter, q: "" })} aria-label="Borrar la búsqueda" className="tap grid shrink-0 place-items-center text-xl text-text-faint">
              ×
            </button>
          )}
        </div>
        <p className="mt-2 text-[12px] text-text-muted" data-lecturas-totales="">
          {t.libros} libro{t.libros === 1 ? "" : "s"} · {t.especificados} especificado{t.especificados === 1 ? "" : "s"} · {t.bancos} banco{t.bancos === 1 ? "" : "s"}
        </p>
        {forge.estado === "error" && (
          <div className="mt-2 flex flex-wrap items-center gap-2" role="status">
            <p className="text-[12px] text-text-muted">El catálogo de Engineering Forge no se pudo cargar en este dispositivo. {chunkErrorText(chunkContext()).texto}</p>
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="tap border border-line px-3 text-[12px] text-text-muted">
              Reintentar
            </button>
          </div>
        )}
      </div>

      <main className="scroll-touch mx-auto w-full max-w-md flex-1 overflow-y-auto px-safe pb-4 pt-2 sm:max-w-2xl" data-lecturas-lista="">
        {hasClassic && <p className="mb-3 text-[11px] leading-snug text-text-faint">{CLASSIC_NOTE}</p>}
        {forge.estado === "cargando" && <p className="text-[12px] text-text-muted">Cargando el catálogo de Engineering Forge…</p>}
        {filtered.length === 0 && forge.estado !== "cargando" && <p className="mt-4 text-[13px] text-text-faint">Nada con este filtro.</p>}
        <div className="space-y-6">
          {groups.map((g) => {
            const theme = themeForGoal(g.title);
            return (
              <section key={g.key} aria-label={g.title} data-lecturas-grupo={g.title}>
                <h3 className="text-[10px] uppercase tracking-[0.24em]" style={{ color: readableAccent(theme.accent) }}>
                  {g.title}
                  <span className="ml-2 normal-case tracking-normal text-text-faint">
                    {g.totales.libros} libro{g.totales.libros === 1 ? "" : "s"}
                    {g.key === FORGE_GOAL_ID && ` (${g.verificados} verificados, ${g.autorados} autorados)`}
                    {g.totales.especificados > 0 && ` · ${g.totales.especificados} especificados`} · {g.totales.bancos} banco{g.totales.bancos === 1 ? "" : "s"}
                  </span>
                </h3>
                <div className="mt-1.5 space-y-2">
                  {g.rows.map((row) => (
                    <RowCard
                      key={row.key}
                      row={row}
                      note={rowNote?.key === row.key ? rowNote : null}
                      onLeer={() => void leer(row)}
                      onEjercicios={() => setSheet({ kind: "ejercicios", row })}
                      onEvaluaciones={() => setSheet({ kind: "evaluaciones", row })}
                      onBorrar={() => void onDeleteImport(row)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      {/* barra de filtros: hermana de main, sin sticky; reserva la esquina del orbe (§11.4) */}
      <div className="shrink-0 border-t border-line bg-ink" style={{ paddingRight: "var(--companion-reserve-right)" }}>
        <div className="mx-auto grid w-full max-w-md grid-cols-3 gap-2 px-safe pt-2 sm:max-w-2xl" data-lecturas-filtros="">
          <select
            aria-label="Mundo"
            value={filter.world}
            onChange={(e) => setFilter({ ...filter, world: e.target.value, route: "*" })}
            className="min-h-11 min-w-0 rounded-[var(--r-sm)] border border-line bg-surface px-2 text-[16px] text-text"
          >
            {worldOpts.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label} ({o.count})
              </option>
            ))}
          </select>
          <select
            aria-label="Ruta"
            value={filter.route}
            disabled={filter.world === "*"}
            onChange={(e) => setFilter({ ...filter, route: e.target.value })}
            className="min-h-11 min-w-0 rounded-[var(--r-sm)] border border-line bg-surface px-2 text-[16px] text-text disabled:opacity-50"
          >
            <RouteOptions opts={routeOpts} />
          </select>
          <select
            aria-label="Estado"
            value={filter.estado}
            onChange={(e) => setFilter({ ...filter, estado: e.target.value as Estado })}
            className="min-h-11 min-w-0 rounded-[var(--r-sm)] border border-line bg-surface px-2 text-[16px] text-text"
          >
            {estadoOpts.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label} ({o.count})
              </option>
            ))}
          </select>
        </div>
      </div>

      {sheet?.kind === "leer" &&
        (sheet.forge ? (
          <div data-world="forge">
            <BookReader book={sheet.book} onClose={() => setSheet(null)} />
          </div>
        ) : (
          <BookReader book={sheet.book} onClose={() => setSheet(null)} />
        ))}
      {sheet?.kind === "ejercicios" && sheet.row.cell.id && (
        <ExerciseMode
          moduleId={sheet.row.cell.id}
          goalId={sheet.row.world.goalId ?? ""}
          goalTitle={sheet.row.world.title}
          cellTitle={sheet.row.cell.title ?? sheet.row.title}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === "evaluaciones" && sheet.row.cell.code && sheet.row.cell.id && (
        <ForgeBankHost row={sheet.row} readModel={readModel} onClose={() => setSheet(null)} onCodigo={() => setSheet({ kind: "ejercicios", row: sheet.row })} />
      )}
    </div>
  );
}

function RouteOptions({ opts }: { opts: { id: string; label: string; count: number; group?: string }[] }) {
  const head = opts.filter((o) => !o.group);
  const groups = [...new Set(opts.filter((o) => o.group).map((o) => o.group!))];
  return (
    <>
      {head.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
          {o.count ? ` (${o.count})` : ""}
        </option>
      ))}
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {opts
            .filter((o) => o.group === g)
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.label} ({o.count})
              </option>
            ))}
        </optgroup>
      ))}
    </>
  );
}

function ForgeBankHost({ row, readModel, onClose, onCodigo }: { row: LibraryRow; readModel: ReadModel; onClose(): void; onCodigo(): void }) {
  const lazy = useLazyModule(() => import("@/forge/ui/library/ForgeBankSheet"));
  if (lazy.estado === "cargando") return null;
  if (lazy.estado === "error") {
    const { texto } = chunkErrorText(chunkContext());
    return (
      <div role="alert" className="fixed inset-x-0 bottom-0 z-[80] border-t border-line bg-ink px-safe pb-safe pt-3">
        <p className="text-[12px] text-text-muted">{texto}</p>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={lazy.reintentar} className="tap border border-line px-3 text-[12px] text-text">
            Reintentar
          </button>
          <button type="button" onClick={onClose} className="tap border border-line px-3 text-[12px] text-text">
            Cerrar
          </button>
        </div>
      </div>
    );
  }
  const Sheet = lazy.mod.default;
  return <Sheet code={row.cell.code!} cellId={row.cell.id!} title={row.cell.title ?? row.title} readModel={readModel} codigo={!!row.forge?.bankCodigo} onCodigo={onCodigo} onClose={onClose} />;
}

export function RowCard({
  row,
  note,
  onLeer,
  onEjercicios,
  onEvaluaciones,
  onBorrar,
}: {
  row: LibraryRow;
  note: { text: string; retry?: () => void } | null;
  onLeer(): void;
  onEjercicios(): void;
  onEvaluaciones(): void;
  onBorrar(): void;
}) {
  const theme = themeForGoal(row.world.title);
  const ink = readableAccent(theme.accent);
  const meta = [
    row.route.name ? row.route.name.split(" · ")[0] : null,
    row.cell.code ? null : row.cell.title,
    row.minutes != null ? `${row.minutes} min` : null,
    row.items ? `${row.items.disponibles} de ${row.items.total} ítems` : null,
    row.kind === "banco" ? "banco" : null,
    AUTORIA_LABEL[row.autoria],
  ].filter(Boolean);
  const isBook = row.kind === "libro";
  const canLeer = isBook && row.disponible !== "pendiente";
  const canEjercicios = row.kind === "banco" && row.source !== "forge" && !row.sealed && !!row.cell.id;
  const canEvaluaciones = row.kind === "banco" && row.source === "forge" && !row.sealed;
  const canBorrar = row.source === "import";
  // Forge: libro y banco de una celda se nombran por la celda («P2-06 · Edits, …»); el tipo va en la línea de abajo
  const base = row.source === "forge" ? row.cell.title ?? row.title : row.title;
  const title = row.cell.code ? `${row.cell.code} · ${base.replace(new RegExp(`^${row.cell.code}\\s*·\\s*`), "")}` : base;
  return (
    <article className="rounded-[var(--r-md)] border border-line bg-surface p-3" data-lecturas-fila={row.key}>
      <div className="line-clamp-2 font-serif text-[15px] leading-snug text-text" title={title}>
        {title}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] uppercase tracking-wider text-text-faint">
        {meta.map((m, i) => (
          <span key={i} style={i === 0 ? { color: ink } : undefined}>
            {m}
          </span>
        ))}
      </div>
      <p className="mt-1 text-[12px] text-text-muted">{row.disponibleDetalle}</p>
      <p className="mt-0.5 truncate text-[11px] text-text-faint" title={row.generatedBy || "sin dato"}>
        {row.generatedBy || "sin dato"}
      </p>
      {row.sealed && row.kind === "banco" && <p className="mt-1 text-[12px] text-text-muted">Celda sellada · domina lo anterior</p>}
      {row.kind === "banco" && row.source !== "forge" && !row.cell.id && <p className="mt-1 text-[12px] text-text-muted">banco suelto: no tiene celda</p>}
      {note && (
        <div className="mt-1 flex flex-wrap items-center gap-2" role="status">
          <p className="text-[12px] text-text-muted">{note.text}</p>
          {note.retry && (
            <button type="button" onClick={note.retry} className="tap border border-line px-3 text-[12px] text-text-muted">
              Reintentar
            </button>
          )}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {canLeer && (
          <button type="button" onClick={onLeer} className="tap px-2 text-[12px] uppercase tracking-wider transition hover:underline" style={{ color: ink }}>
            Leer
          </button>
        )}
        {canEjercicios && (
          <button type="button" onClick={onEjercicios} className="tap px-2 text-[12px] uppercase tracking-wider transition hover:underline" style={{ color: ink }}>
            Ejercicios
          </button>
        )}
        {canEvaluaciones && (
          <button type="button" onClick={onEvaluaciones} className="tap px-2 text-[12px] uppercase tracking-wider transition hover:underline" style={{ color: ink }}>
            Evaluaciones
          </button>
        )}
        {canBorrar && (
          <button type="button" onClick={onBorrar} className="tap px-2 text-[12px] uppercase tracking-wider text-text-faint transition hover:text-amber">
            Borrar
          </button>
        )}
      </div>
    </article>
  );
}

export { DEFAULT_FILTER };
