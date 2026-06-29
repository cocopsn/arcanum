"use client";

import { useState } from "react";
import { useArcanum } from "@/app/providers";
import { useActions } from "@/ui/use-actions";

export function EvaluationPanel({ moduleId, accent }: { moduleId: string; accent: string }) {
  const evalRM = useArcanum((s) => s.readModel.evaluations.find((e) => e.moduleId === moduleId) ?? null);
  const { evaluateModule } = useActions();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await evaluateModule(moduleId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xs uppercase tracking-[0.22em] text-text-faint">Evaluación adversarial</h3>
        <button
          onClick={() => void run()}
          disabled={busy}
          className="min-h-11 rounded-[var(--r-sm)] border px-3 text-[11px] uppercase tracking-[0.16em] transition hover:brightness-125 disabled:opacity-40"
          style={{ borderColor: accent, color: accent }}
        >
          {busy ? "Evaluando…" : evalRM ? "Re-evaluar" : "Evaluar dominio"}
        </button>
      </div>

      {evalRM ? (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-2">
            {evalRM.score !== null && (
              <span className="tnum font-display text-2xl" style={{ color: accent }}>
                {Math.round(evalRM.score * 100)}%
              </span>
            )}
            <p className="font-serif text-[14px] leading-snug text-text">{evalRM.summary}</p>
          </div>

          {evalRM.strengths.length > 0 && (
            <div>
              <h4 className="text-[10px] uppercase tracking-[0.2em] text-text-faint">Dominas</h4>
              <ul className="mt-1 space-y-1">
                {evalRM.strengths.map((s, i) => (
                  <li key={i} className="text-[13px] text-text-muted">
                    <span style={{ color: accent }}>✓</span> {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {evalRM.gaps.length > 0 && (
            <div>
              <h4 className="text-[10px] uppercase tracking-[0.2em] text-text-faint">No dominas</h4>
              <ul className="mt-1 space-y-1">
                {evalRM.gaps.map((g, i) => (
                  <li key={i} className="text-[13px] text-text-muted">
                    <span className="text-amber">✕</span> {g}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-[var(--r-md)] border border-dashed border-line bg-surface p-3">
            <h4 className="text-[10px] uppercase tracking-[0.2em] text-text-faint">El reto</h4>
            <p className="mt-1 font-serif text-[14px] leading-snug text-text">{evalRM.challenge}</p>
          </div>

          <div className="text-[10px] uppercase tracking-wider text-text-faint">
            {evalRM.source === "ai" ? `vía IA · ${evalRM.provider ?? ""}` : "heurística local (sin IA)"}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-[13px] text-text-muted">
          Aún sin evaluar. Es dura y específica: te dice qué dominas, qué no, y te reta en lo débil.
        </p>
      )}
    </div>
  );
}
