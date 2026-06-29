"use client";

import { useEffect, useRef, useState } from "react";
import { useArcanum } from "@/app/providers";
import { useActions } from "@/ui/use-actions";
import { groupObligations, formatAge } from "@/lib/agenda";
import type { ObligationRM } from "@/core/read-model";
import type { Freshness } from "@/core/present";

const STATUS_STYLE: Record<string, string> = {
  pending: "border-line text-text-muted",
  submitted: "border-topic text-topic",
  graded: "border-gold text-gold",
  missing: "border-amber text-amber",
  late: "border-amber text-amber",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  submitted: "Entregada",
  graded: "Calificada",
  missing: "No entregada",
  late: "Tarde",
};

const FRESH_DOT: Record<Freshness, string> = {
  fresh: "var(--topic)",
  recent: "var(--gold)",
  stale: "var(--amber)",
  none: "var(--text-faint)",
};

function dueLabel(dueTs: number | null): string {
  if (dueTs === null) return "Sin fecha";
  return new Date(dueTs).toLocaleString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ObligationCard({
  ob,
  goals,
  onAscend,
}: {
  ob: ObligationRM;
  goals: { id: string; title: string; color: string }[];
  onAscend: (ob: ObligationRM, goalId: string) => Promise<void>;
}) {
  const [picking, setPicking] = useState(false);
  const [goalId, setGoalId] = useState(goals[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const style = STATUS_STYLE[ob.status] ?? STATUS_STYLE.pending;

  return (
    <div className="rounded-[var(--r-md)] border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {ob.course && <div className="truncate text-[10px] uppercase tracking-[0.14em] text-text-faint">{ob.course}</div>}
          <div className="font-serif text-[15px] leading-tight text-text">{ob.title}</div>
          <div className="mt-0.5 text-[11px] text-text-muted">{dueLabel(ob.dueTs)}</div>
        </div>
        <span className={`shrink-0 rounded-[var(--r-pill)] border px-2 py-0.5 text-[10px] uppercase tracking-wider ${style}`}>
          {STATUS_LABEL[ob.status] ?? ob.status}
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        {ob.url ? (
          <a
            href={ob.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.14em] text-text-faint transition hover:text-text-muted"
          >
            Abrir en Canvas ↗
          </a>
        ) : (
          <span />
        )}

        {ob.promotedModuleId ? (
          <span className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.14em] text-rank">✦ módulo</span>
        ) : picking ? (
          <div className="flex items-center gap-1.5">
            <select
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              aria-label="Meta del módulo"
              className="min-h-11 rounded-[var(--r-sm)] border border-line bg-ink px-2 text-xs text-text focus:border-topic focus:outline-none"
            >
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
            <button
              disabled={!goalId || busy}
              onClick={async () => {
                setBusy(true);
                await onAscend(ob, goalId);
                setPicking(false);
                setBusy(false);
              }}
              className="min-h-11 rounded-[var(--r-sm)] border border-topic bg-[var(--topic-deep)] px-2.5 text-xs text-topic transition hover:brightness-125 disabled:opacity-40"
            >
              Crear
            </button>
            <button
              onClick={() => setPicking(false)}
              aria-label="Cancelar"
              className="min-h-11 px-1.5 text-text-faint transition hover:text-text"
            >
              ×
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setGoalId(goals[0]?.id ?? "");
              setPicking(true);
            }}
            disabled={goals.length === 0}
            className="inline-flex min-h-11 items-center rounded-[var(--r-sm)] border border-line px-2.5 text-[11px] uppercase tracking-[0.14em] text-text-muted transition hover:border-rank hover:text-rank disabled:opacity-40"
          >
            Ascender a módulo
          </button>
        )}
      </div>
    </div>
  );
}

export function AgendaSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const obligations = useArcanum((s) => s.readModel.obligations);
  const canvas = useArcanum((s) => s.viewModel.canvas);
  const goals = useArcanum((s) => s.readModel.goals.filter((g) => !g.archived).map((g) => ({ id: g.id, title: g.title, color: g.color })));
  const { ascendObligation } = useActions();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const groups = groupObligations(obligations, Date.now());
  const onAscend = async (ob: ObligationRM, goalId: string) => {
    await ascendObligation(ob.id, ob.title, goalId);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
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
        aria-labelledby="agenda-title"
        tabIndex={-1}
        className="scroll-touch flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-[var(--r-lg)] border border-line bg-surface-raised p-6 outline-none sm:rounded-[var(--r-lg)]"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="agenda-title" className="font-display text-lg tracking-[0.14em] text-topic">
              AGENDA · OBLIGACIONES
            </h2>
            <p className="mt-1 text-[13px] text-text-muted">
              Entregas de Canvas — separadas del grafo de maestría. Asciende a módulo lo que de verdad vas a aprender.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-2 -mt-1 min-h-11 px-2 text-2xl leading-none text-text-faint transition hover:text-text"
          >
            ×
          </button>
        </div>

        {/* Canvas health — failure is a NORMAL state, never a red error. */}
        <div className="rounded-[var(--r-md)] border border-line bg-surface px-3 py-2.5">
          <div className="flex items-center gap-2 text-[12px] text-text-muted">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: FRESH_DOT[canvas.freshness] }} />
            {canvas.freshness === "none" ? (
              <span>Aún no conectas Canvas. Configura el scraper de n8n (ver DEPLOY.md).</span>
            ) : (
              <span>
                Datos de Canvas · <span className="text-text">{formatAge(canvas.ageMs)}</span>
              </span>
            )}
          </div>
          {canvas.cookieStale && canvas.lastOkTs !== null && (
            <div className="mt-1.5 text-[11px] text-amber">
              Sesión de Canvas expirada — mostrando lo último que se pudo leer. Renueva la cookie del scraper.
            </div>
          )}
        </div>

        {groups.length === 0 ? (
          <p className="text-sm text-text-faint">
            {canvas.freshness === "none"
              ? "Sin obligaciones todavía."
              : "Nada pendiente en Canvas. Limpio."}
          </p>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <section key={g.bucket}>
                <h3 className="mb-2 text-[11px] uppercase tracking-[0.18em] text-text-faint">
                  {g.label} · <span className="tnum">{g.items.length}</span>
                </h3>
                <div className="space-y-2">
                  {g.items.map((ob) => (
                    <ObligationCard key={ob.id} ob={ob} goals={goals} onAscend={onAscend} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="min-h-11 w-full text-xs uppercase tracking-[0.2em] text-text-faint transition hover:text-text-muted"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
