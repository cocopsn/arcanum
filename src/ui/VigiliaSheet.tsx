"use client";

import { useState } from "react";
import { useArcanum, useArcanumStore } from "@/app/providers";
import { useActions } from "@/ui/use-actions";
import { foldLast24h, type DayDigest } from "@/core/sleep-cycle";
import { enrichSleepCycle } from "@/sync/ai";
import { civilDay } from "@/core/time";
import { ARCANUM_CONFIG } from "@/core/config";
import type { Json } from "@/core/event";

export function VigiliaSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sleepCycles = useArcanum((s) => s.readModel.sleepCycles);
  const reviewQueue = useArcanum((s) => s.viewModel.reviewQueue);
  const modules = useArcanum((s) => s.readModel.modules);
  const store = useArcanumStore();
  const { fire } = useActions();
  const [running, setRunning] = useState(false);

  if (!open) return null;

  const latest = sleepCycles[sleepCycles.length - 1] ?? null;
  const digest = (latest?.digest as DayDigest | undefined) ?? undefined;
  const moduleTitle = (id: string) => modules.find((m) => m.id === id)?.title ?? "(módulo)";

  async function runRite() {
    setRunning(true);
    const now = Date.now();
    const events = await store.getState().getEvents();
    const d = foldLast24h(events, now);
    const ai = await enrichSleepCycle(d);
    await fire("sleepcycle.generated", {
      day: civilDay(now, ARCANUM_CONFIG.tz),
      digest: d as unknown as Json,
      ai: ai ? { provider: ai.provider, patterns: ai.patterns, axioms: ai.axioms } : null,
    } as unknown as Json);
    setRunning(false);
  }

  const stat = (label: string, value: number) => (
    <div className="rounded-[var(--r-sm)] border border-line bg-surface px-3 py-2 text-center">
      <div className="tnum font-display text-lg text-gold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-text-faint">{label}</div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "var(--overlay-scrim)" }}
      onClick={onClose}
    >
      <div
        className="scroll-touch flex max-h-[88vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-[var(--r-lg)] border border-line bg-surface-raised p-6 sm:rounded-[var(--r-lg)]"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="font-display text-lg tracking-[0.14em] text-rank">VIGILIA · RITO NOCTURNO</h2>
          <p className="mt-1 font-serif text-sm leading-relaxed text-text-muted">
            Recorre las últimas 24h: lo que forjaste, lo que el olvido reclama, y los patrones que el rito propone.
          </p>
        </div>

        <button
          onClick={() => void runRite()}
          disabled={running}
          className="min-h-11 rounded-[var(--r-sm)] border border-rank bg-rank-soft px-4 text-sm tracking-wide text-rank transition hover:brightness-125 disabled:opacity-40"
        >
          {running ? "Velando…" : "Ejecutar rito nocturno"}
        </button>

        <section>
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-text-faint">El olvido reclama</h3>
          {reviewQueue.length === 0 ? (
            <p className="mt-1 text-sm text-text-muted">Nada vencido. La retención aguanta.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {reviewQueue.map((r) => (
                <span key={r.moduleId} className="rounded-[var(--r-sm)] border border-topic px-2.5 py-1 text-xs text-topic">
                  {moduleTitle(r.moduleId)}
                </span>
              ))}
            </div>
          )}
        </section>

        {digest && (
          <section className="border-t border-line pt-4">
            <h3 className="text-[11px] uppercase tracking-[0.18em] text-text-faint">Resumen del día</h3>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {stat("muros", digest.errorsResolved)}
              {stat("checkpoints", digest.checkpointsPassed)}
              {stat("cerrados", digest.modulesCompleted)}
              {stat("min", digest.sessionMinutes)}
              {stat("notas", digest.notesCreated)}
            </div>
            {latest?.ai ? (
              <div className="mt-3 space-y-2">
                <p className="font-serif text-[15px] leading-relaxed text-text">{latest.ai.patterns}</p>
                {latest.ai.axioms && (
                  <p className="font-serif text-[15px] italic leading-relaxed text-rank">{latest.ai.axioms}</p>
                )}
                <div className="text-[10px] uppercase tracking-wider text-text-faint">vía {latest.ai.provider}</div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-text-faint">
                Resumen local listo. Los patrones y axiomas (IA) requieren sesión iniciada + keys en la Edge Function.
              </p>
            )}
          </section>
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
