"use client";

import { useState } from "react";
import { useActions } from "@/ui/use-actions";

/** Reto-first: the wall comes before any resource (spec §10.1). */
export function BlankChallenge({
  goalId,
  moduleId,
  title,
}: {
  goalId: string;
  moduleId: string;
  title: string;
}) {
  const { resolveError, logError } = useActions();
  const [insight, setInsight] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-3">
      <p className="font-display text-[15px] leading-snug text-text">
        El reto va primero. Trabaja <span className="text-topic">{title}</span> sin
        recursos. Cuando un muro te detenga, regístralo; cuando lo superes y
        entiendas el porqué, sella el insight.
      </p>
      <textarea
        value={insight}
        onChange={(e) => setInsight(e.target.value)}
        placeholder="El insight que destrabó el muro…"
        rows={2}
        className="w-full resize-none rounded-[var(--r-sm)] border border-line bg-ink px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-rank focus:outline-none"
      />
      <div className="flex flex-wrap gap-2">
        <button
          disabled={!insight.trim() || busy}
          onClick={async () => {
            setBusy(true);
            await resolveError({ goalId, moduleId }, insight.trim());
            setInsight("");
            setBusy(false);
          }}
          className="min-h-11 rounded-[var(--r-sm)] border border-rank bg-[var(--rank-soft)] px-4 py-2 font-display text-sm tracking-wide text-rank transition hover:brightness-125 disabled:opacity-40"
        >
          Muro superado · +25 XP
        </button>
        <button
          onClick={() => logError({ goalId, moduleId }, "muro")}
          className="min-h-11 rounded-[var(--r-sm)] px-4 py-2 text-sm text-text-muted transition hover:text-text"
        >
          Solo registrar muro
        </button>
      </div>
      <details className="group pt-1">
        <summary className="cursor-pointer list-none text-[11px] uppercase tracking-[0.18em] text-text-faint transition hover:text-text-muted">
          ⌄ Recursos (cuando de verdad choques)
        </summary>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          Aquí vivirán videos, lecturas, cursos y certificaciones del módulo —
          secundarios a propósito. El recurso es on-demand, no el punto de partida.
        </p>
      </details>
    </div>
  );
}
