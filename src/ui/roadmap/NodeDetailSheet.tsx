"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useArcanum, useArcanumStore } from "@/app/providers";
import { useActions } from "@/ui/use-actions";
import { FireTest } from "@/ui/FireTest";
import { BlankChallenge } from "@/ui/BlankChallenge";
import { NotesSheet } from "@/ui/NotesSheet";
import { nodeStatus, prereqsOf } from "@/core/roadmap";
import type { ArcanumEvent } from "@/core/event";
import type { ModuleRM } from "@/core/read-model";

const STATUS_LABEL = {
  sealed: "Sellado",
  available: "Disponible",
  started: "En curso",
  completed: "Completado",
} as const;

const EVENT_LABEL: Record<string, string> = {
  "module.upserted": "Módulo trazado",
  "module.started": "Módulo iniciado",
  "module.completed": "Módulo cerrado",
  "error.logged": "Muro registrado",
  "error.resolved": "Insight sellado",
  "checkpoint.passed": "Checkpoint",
  "firetest.attempted": "Prueba de fuego",
  "note.created": "Nota creada",
  "roadmap.node.moved": "Reubicado en el mapa",
};

function snippet(e: ArcanumEvent): string {
  const p = e.payload as Record<string, unknown>;
  if (typeof p.insight === "string") return p.insight;
  if (typeof p.description === "string") return p.description;
  if (typeof p.title === "string") return p.title;
  if (e.type === "firetest.attempted") return `${p.reached}/${p.ceiling}`;
  return "";
}

export function NodeDetailSheet({ moduleId, onClose }: { moduleId: string; onClose: () => void }) {
  const readModel = useArcanum((s) => s.readModel);
  const retrievability = useArcanum(
    (s) => s.viewModel.modules.find((m) => m.id === moduleId)?.retrievability ?? 0,
  );
  const { archiveNode } = useActions();
  const store = useArcanumStore();
  const [history, setHistory] = useState<ArcanumEvent[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const cursorId = readModel.cursor?.id ?? null;

  const mod = readModel.modules.find((m) => m.id === moduleId) ?? null;
  const goal = mod?.goalId ? readModel.goals.find((g) => g.id === mod.goalId) ?? null : null;
  const byId = useMemo(() => new Map(readModel.modules.map((m) => [m.id, m])), [readModel.modules]);
  const status = mod ? nodeStatus(mod, readModel.edges, byId) : "sealed";
  const noteCount = readModel.notes.filter((n) => n.moduleId === moduleId).length;

  const prereqTitles = useMemo(() => {
    if (!mod) return [] as string[];
    return prereqsOf(mod.id, readModel.edges)
      .map((pid) => byId.get(pid)?.title ?? "…")
      .filter(Boolean);
  }, [mod, readModel.edges, byId]);

  // Refetch history only when the log actually advances (cursor id), not on every
  // unrelated readModel identity change — and via the stable store, not a fresh
  // closure each render, so the sheet doesn't re-scan the whole log per keystroke.
  useEffect(() => {
    let live = true;
    void store
      .getState()
      .getEvents()
      .then((evs) => {
        if (!live) return;
        setHistory(
          evs
            .filter((e) => e.module_id === moduleId)
            .sort((a, b) => b.ts - a.ts)
            .slice(0, 6),
        );
      });
    return () => {
      live = false;
    };
  }, [store, moduleId, cursorId]);

  // Move focus into the sheet on open (keyboard / AT entry point).
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  // A node archived while its sheet is open (e.g. via cross-device sync) no longer
  // exists on the canvas — don't keep showing live FireTest/Archive UI for it.
  if (!mod || mod.archived) return null;
  const goalColor = goal?.color ?? "var(--topic)";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
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
        aria-labelledby="node-detail-title"
        tabIndex={-1}
        className="scroll-touch flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-t-[var(--r-lg)] border border-line bg-surface-raised p-6 outline-none sm:rounded-[var(--r-lg)]"
        style={
          {
            paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
            ["--topic" as string]: goalColor,
          } as React.CSSProperties
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {goal && (
              <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em]" style={{ color: goalColor }}>
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: goalColor }} />
                {goal.title}
              </div>
            )}
            <h2 id="node-detail-title" className="font-serif text-xl leading-tight text-text">{mod.title}</h2>
            <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-text-muted">
              {STATUS_LABEL[status]} · maestría <span className="tnum text-topic">{Math.round(retrievability * 100)}%</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="-mr-2 -mt-1 min-h-11 px-2 text-2xl leading-none text-text-faint transition hover:text-text"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {status === "sealed" ? (
          /* FAIL-CLOSED, uniform with the world-map: a sealed node shows its locked state but NOT
             its work flow (no FireTest/BlankChallenge) — no shortcut past the fog-of-war. */
          <div className="mt-4 rounded-[var(--r-md)] border border-dashed border-line bg-surface p-3.5">
            <p className="text-[13px] leading-relaxed text-text-muted">
              Nodo sellado por fog-of-war. Se revela al dominar{" "}
              <span className="text-text">{prereqTitles.join(", ") || "su prerrequisito"}</span> — no hay atajo.
            </p>
          </div>
        ) : (
          <div className="mt-5 border-t border-line pt-5">
            {mod.status === "idle" ? (
              <FireTest goalId={mod.goalId ?? ""} moduleId={mod.id} title={mod.title} />
            ) : (
              <div className="space-y-4">
                <BlankChallenge goalId={mod.goalId ?? ""} moduleId={mod.id} title={mod.title} />
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => setNotesOpen(true)}
          className="-mx-2 mt-3 inline-flex min-h-11 items-center px-2 text-[11px] uppercase tracking-[0.16em] text-text-muted transition hover:text-topic"
        >
          Notas · {noteCount}
        </button>

        {history.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            <h3 className="mb-2 font-display text-xs uppercase tracking-[0.22em] text-text-faint">Historia</h3>
            <ul className="space-y-1.5">
              {history.map((e) => (
                <li key={e.id} className="flex items-baseline gap-2 text-[12px]">
                  <span className="text-text-muted">{EVENT_LABEL[e.type] ?? e.type}</span>
                  {snippet(e) && <span className="truncate text-text-faint">— {snippet(e)}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          {confirmArchive ? (
            <div className="flex items-center gap-2 text-[12px] text-text-muted">
              ¿Archivar nodo?
              <button
                onClick={async () => {
                  await archiveNode(mod.id);
                  onClose();
                }}
                className="min-h-11 rounded-[var(--r-sm)] border border-amber px-3 text-amber transition hover:bg-[var(--amber-glow)]"
              >
                Archivar
              </button>
              <button onClick={() => setConfirmArchive(false)} className="min-h-11 px-2 text-text-faint transition hover:text-text">
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmArchive(true)}
              className="-mx-2 inline-flex min-h-11 items-center px-2 text-[11px] uppercase tracking-[0.16em] text-text-faint transition hover:text-amber"
            >
              Archivar nodo
            </button>
          )}
        </div>
      </div>

      <NotesSheet open={notesOpen} moduleId={moduleId} onClose={() => setNotesOpen(false)} />
    </div>
  );
}
