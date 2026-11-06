"use client";

// The cell's expediente (design §14.5), painted inside TopicDetailSheet for a Forge cell. It is assembled ONLY from
// the route fiche (routes/*.json): it never reads pilots.json, so the reserved content of a pilot (hidden facts of
// an interview, a reserved variation) is never painted before its event (D12, CA-40). Every state is text + glyph.
import { useCallback, useEffect, useState } from "react";
import { useArcanum } from "@/app/providers";
import { FORGE_SPINE } from "@/lib/spines-forge";
import { forgeCodeForCellId } from "@/forge/ids";
import { ensureForgeBank, ensureForgeBook, loadForgeBankItems, loadForgeRoute, type EnsureResult } from "@/forge/loaders";
import { isSelectable, RUNNERS, type RunnerType } from "@/forge/ui/exercises/registry";
import type { ForgeBankItem } from "@/forge/bank/registry";
import { forgeCellState } from "@/forge/model/console-stats";
import { FLOWS } from "@/forge/ui/flows/registry";
import { closingMount, type FlowProps } from "@/forge/ui/flow-contract";
import type { ForgeFlujo } from "@/forge/route-data";
import type { ForgeCellData, ForgeRouteData } from "@/forge/route-data";
import labels from "@/forge/data/labels.json";
import { getBookForModule, type BookRow } from "@/lib/book-store";
import { BookReader } from "@/ui/books/BookReader";
import { Glyph } from "@/forge/ui/glyphs";

const NATURALEZA: Record<string, string> = { a_mano: "a mano", delegable: "delegable", mixto: "mixto" };
const ACCESO: Record<string, string> = {
  publico: "",
  cuenta: labels.cuenta,
  instancia: "Requiere una instancia de Foundry",
  pago: "De pago",
};

type BookState = { kind: "cargando" } | EnsureResult;

export function ForgeCellPanel({ moduleId }: { moduleId: string }) {
  const readModel = useArcanum((s) => s.readModel);
  const code = forgeCodeForCellId(moduleId);
  const spineCell = FORGE_SPINE.cells.find((c) => c.id === moduleId);
  const slug = spineCell?.pathSlug ?? FORGE_SPINE.paths[0]!.slug;
  const [route, setRoute] = useState<ForgeRouteData | null | "cargando">("cargando");
  const [book, setBook] = useState<BookState>({ kind: "cargando" });
  const [row, setRow] = useState<BookRow | null>(null);
  const [reading, setReading] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);
  const [bankNote, setBankNote] = useState<string | null>(null);
  const byId = new Map(readModel.modules.map((m) => [m.id, m]));
  const sealed = forgeCellState(byId.get(moduleId), readModel, byId) === "sellado";

  useEffect(() => {
    let cancel = false;
    void loadForgeRoute(slug).then((r) => {
      if (!cancel) setRoute(r);
    });
    return () => {
      cancel = true;
    };
  }, [slug]);

  const prepareBook = useCallback(() => {
    if (!code) return () => {};
    let cancel = false;
    setBook({ kind: "cargando" });
    // every opening calls ensureForgeBook (a deploy that changes the book reaches the device, §6.2)
    void ensureForgeBook(code, readModel).then(async (r) => {
      if (cancel) return;
      setBook(r);
      if (r.ok) {
        const b = await getBookForModule(moduleId);
        if (!cancel) setRow(b);
      }
    });
    return () => {
      cancel = true;
    };
    // readModel only matters for the diagnostic guard; re-running on every fold would refetch needlessly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, moduleId]);
  useEffect(() => prepareBook(), [prepareBook]);

  if (!code) return null;
  const cell: ForgeCellData | undefined = route && route !== "cargando" ? route.cells.find((c) => c.code === code) : undefined;

  return (
    <section className="mt-3 space-y-3" aria-label={`Expediente ${code}`} data-forge-cell-panel={code}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="forge-label border border-[var(--forge-text)] px-1.5 py-0.5 text-[11px] text-text">{code}</span>
        {route && route !== "cargando" && <span className="forge-label text-[11px] text-text-muted">{route.name}</span>}
      </div>

      {route === "cargando" && <p className="text-[12px] text-text-muted">Cargando la ficha…</p>}
      {route === null && (
        <p className="border border-dashed border-[var(--forge-control)] p-2 text-[12px] text-text-muted">
          <Glyph name="cross" size={10} className="mr-1 inline-block" />
          La ficha de esta ruta no se pudo cargar en este dispositivo · requiere conexión una vez.
        </p>
      )}

      {cell && (
        <>
          <div className="flex flex-wrap gap-1.5">
            <Chip>naturaleza · {NATURALEZA[cell.naturaleza.valor] ?? cell.naturaleza.valor}</Chip>
            <Chip>{cell.alcance === "local+nativa" ? labels.alcance.localNativa : labels.alcance.local}</Chip>
            {cell.requireEnglish && <Chip>en inglés</Chip>}
          </div>
          {route && route !== "cargando" && route.header.entradaRecomendada.length > 0 && (
            <p className="text-[12px] text-text-muted">
              <span className="forge-label mr-1 text-[10px]">Entrada recomendada</span>
              {route.header.entradaRecomendada.join(" · ")}
            </p>
          )}
          <Field label="Foco" text={cell.ficha.foco} />
          <Field label="Resultado" text={cell.ficha.resultado} />
          <Field label="Misión" text={cell.ficha.mision} />
          <Field label="Defensa" text={cell.ficha.defensa} />
          <Field label="Transferencia" text={cell.ficha.transferencia} />
          {cell.capacidades.length > 0 && (
            <div>
              <div className="forge-label text-[10px] text-text-muted">Capacidades esenciales</div>
              <p className="mt-0.5 text-[12px] text-text">{cell.capacidades.join(" · ")}</p>
            </div>
          )}
          {cell.criticas.length > 0 && (
            <div>
              <div className="forge-label text-[10px] text-text-muted">Condiciones críticas</div>
              <ul className="mt-0.5 space-y-0.5">
                {cell.criticas.map((c) => (
                  <li key={c.id} className="text-[12px] leading-snug text-text">
                    <Glyph name="right" size={9} className="mr-1 inline-block" />
                    {c.texto}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {cell.ficha.fuentes.length > 0 && (
            <div>
              <div className="forge-label text-[10px] text-text-muted">Fuentes</div>
              <ul className="mt-0.5 space-y-1">
                {cell.ficha.fuentes.map((f, i) => (
                  <li key={`${f.url}-${i}`} className="text-[12px] leading-snug">
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="break-words text-text underline underline-offset-2">
                      {f.etiqueta || f.url}
                    </a>
                    {ACCESO[f.acceso] && <span className="ml-1 text-[11px] text-text-muted">· {ACCESO[f.acceso]}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {cell.usadoEn && cell.usadoEn.length > 0 && (
            <p className="text-[12px] text-text-muted">
              <span className="forge-label mr-1 text-[10px]">Usado en</span>
              {cell.usadoEn.join(" · ")}
            </p>
          )}
        </>
      )}

      {/* the book of the cell (§6.2): lazy per route, every state named */}
      <div className="border border-[rgba(255,255,255,0.12)] p-3" data-forge-book-state={"kind" in book ? book.kind : book.ok ? "ok" : book.reason}>
        <div className="forge-label text-[10px] text-text-muted">Libro</div>
        {"kind" in book ? (
          <p className="mt-1 text-[12px] text-text-muted">Buscando el libro…</p>
        ) : book.ok ? (
          <button
            type="button"
            disabled={!row}
            onClick={() => setReading(true)}
            className="mt-1 min-h-11 w-full border border-[var(--forge-text)] px-3 text-[13px] text-text disabled:opacity-60"
          >
            <Glyph name="enter" size={11} className="mr-1.5 inline-block" />
            Leer el libro{row ? ` · ${row.title}` : ""}
          </button>
        ) : book.reason === "desconocido" ? (
          <p className="mt-1 text-[12px] text-text-muted">Libro pendiente</p>
        ) : book.reason === "no-descargado" ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-[12px] text-text-muted">Libro no descargado · requiere conexión una vez</p>
            <button type="button" onClick={() => prepareBook()} className="min-h-11 border border-[var(--forge-control)] px-3 text-[12px] text-text">
              Reintentar
            </button>
          </div>
        ) : book.reason === "formato" ? (
          <p className="mt-1 text-[12px] text-text-muted">
            <Glyph name="cross" size={10} className="mr-1 inline-block" />
            Libro dañado en esta versión
          </p>
        ) : (
          <p className="mt-1 text-[12px] text-text-muted">La lectura se abre después de tu primer intento</p>
        )}
      </div>

      {/* the cell's flow (§5.2, §9.5): never offered on a sealed cell (fail-closed fog-of-war) */}
      {cell && route && route !== "cargando" && !sealed && (
        <div className="border border-[rgba(255,255,255,0.12)] p-3">
          <div className="forge-label text-[10px] text-text-muted">Misión de la celda</div>
          <button
            type="button"
            onClick={() => {
              // the bank goes to the device before any flow reads its items (§6.3); a failure keeps its reason visible
              void ensureForgeBank(code).then((r) => setBankNote(r.ok || r.reason === "desconocido" ? null : r.reason === "invalido" ? "Banco inválido en esta versión" : "Banco no descargado · requiere conexión una vez"));
              setFlowOpen(true);
            }}
            className="mt-1 min-h-11 w-full border border-[var(--forge-text)] px-3 text-[13px] text-text"
          >
            <Glyph name="right" size={11} className="mr-1.5 inline-block" />
            Abrir la misión
          </button>
          {bankNote && <p className="mt-1 text-[12px] text-text-muted">{bankNote}</p>}
        </div>
      )}
      {flowOpen && cell && route && route !== "cargando" && !sealed && (
        <FlowHost
          flujo={cell.flujo}
          // the `mision` flow opened straight from the cell closes the cell's own gate (§9.5 closing rule)
          props={{ cellCode: code, cellId: moduleId, route, readModel, kind: cell.flujo === "mision" ? closingMount(cell.compuerta)?.kind : undefined, onClose: () => setFlowOpen(false) }}
        />
      )}

      {cell && !sealed && (
        <div className="border border-[rgba(255,255,255,0.12)] p-3" data-forge-evaluations={code}>
          <div className="forge-label text-[10px] text-text-muted">Evaluaciones</div>
          <ForgeEvaluations code={code} cellId={moduleId} readModel={readModel} />
        </div>
      )}

      {reading && row && <BookReader book={row} onClose={() => setReading(false)} />}
    </section>
  );
}

// N2: the bank's practice items (§9.5 «Evaluaciones»), each mounted with its lazy runner. Practice records evidence and
// never opens a gate; items whose bank check is still a stub carry «sin verificar».
function ForgeEvaluations({ code, cellId, readModel }: { code: string; cellId: string; readModel: FlowProps["readModel"] }) {
  const [bank, setBank] = useState<{ items: ForgeBankItem[]; pendientes: string[] } | null | "cargando">("cargando");
  const [open, setOpen] = useState<ForgeBankItem | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      let b = await loadForgeBankItems(code);
      if (!b) {
        const r = await ensureForgeBank(code);
        if (r.ok) b = await loadForgeBankItems(code);
      }
      if (alive) setBank(b);
    })();
    return () => {
      alive = false;
    };
  }, [code]);
  if (bank === "cargando") return <p className="text-[12px] text-text-muted">Cargando el banco…</p>;
  if (!bank) return <p className="text-[12px] text-text-muted">Banco no descargado · requiere conexión una vez</p>;
  const items = bank.items.filter(isSelectable);
  if (open && isSelectable(open)) {
    const Runner = RUNNERS[open.type as RunnerType];
    return <Runner item={open} cellCode={code} cellId={cellId} readModel={readModel} onClose={() => setOpen(null)} />;
  }
  if (!items.length) return <p className="text-[12px] text-text-muted">Sin evaluaciones de práctica en este banco</p>;
  return (
    <ul className="mt-1 space-y-1">
      {items.map((it) => (
        <li key={it.itemId}>
          <button type="button" onClick={() => setOpen(it)} className="min-h-11 w-full border border-[var(--forge-control)] px-3 text-left text-[12px] text-text" data-forge-eval={it.type}>
            <span className="forge-label mr-1.5 text-[10px] text-text-muted">{it.type}</span>
            {it.title}
            {bank.pendientes.includes(it.itemId) && <span className="ml-1 text-[11px] text-text-muted">· sin verificar</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

function FlowHost({ flujo, props }: { flujo: ForgeFlujo; props: FlowProps }) {
  const Flow = FLOWS[flujo];
  return (
    <div className="border border-[var(--forge-control)] p-3" data-forge-flow={flujo}>
      <Flow {...props} />
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="forge-label border border-[var(--forge-control)] px-1.5 py-0.5 text-[10px] text-text-muted">{children}</span>;
}

function Field({ label, text }: { label: string; text?: string }) {
  if (!text) return null;
  return (
    <div>
      <div className="forge-label text-[10px] text-text-muted">{label}</div>
      <p className="mt-0.5 whitespace-pre-line text-[13px] leading-snug text-text">{text}</p>
    </div>
  );
}
