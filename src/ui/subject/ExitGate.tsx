"use client";

import { useEffect, useRef, useState } from "react";
import { useArcanum } from "@/app/providers";
import { useActions } from "@/ui/use-actions";
import { useReward } from "@/ui/reward/RewardProvider";
import { readableAccent } from "@/lib/accent";
import { audio } from "@/lib/audio";
import type { TopicGate } from "@/lib/subject-content";

export function ExitGate({ moduleId, gate, accent }: { moduleId: string; gate: TopicGate; accent: string }) {
  const verdict = useArcanum((s) => s.readModel.gates.find((g) => g.moduleId === moduleId) ?? null);
  const gatePassed = useArcanum((s) => s.readModel.modules.find((m) => m.id === moduleId)?.gatePassed ?? false);
  const pending = useArcanum((s) => s.readModel.pendingAi.some((p) => p.moduleId === moduleId && p.kind === "gate"));
  const { evaluateGate } = useActions();
  const reward = useReward();
  const [justification, setJustification] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  const lastTs = useRef<number | null>(null);
  useEffect(() => {
    if (!verdict) return;
    // opening a cell's gate is the LARGEST in-flow moment (mastery demonstrated → the next cell unseals):
    // a big, ceremonious flourish. A fail stays a plain tension tone (not punitive, just honest).
    if (lastTs.current !== null && verdict.ts !== lastTs.current) {
      if (verdict.passed) reward("large", { accent, sfx: "gate" });
      else audio.sfx("error");
    }
    lastTs.current = verdict.ts;
  }, [verdict?.ts, verdict?.passed, verdict]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    // synchronous guard against a rapid double-tap firing two gate.evaluated events
    if (!justification.trim() || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      await evaluateGate(moduleId, justification);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[var(--r-md)] border p-4" style={{ borderColor: gatePassed ? accent : "var(--line)" }}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xs uppercase tracking-[0.22em] text-text-faint">Compuerta de salida · adversarial</h3>
        {gatePassed && (
          <span className="text-[11px] uppercase tracking-wider" style={{ color: readableAccent(accent) }}>
            ✓ abierta
          </span>
        )}
      </div>
      <p className="mt-2 font-serif text-[15px] leading-snug text-text">{gate.question}</p>

      <details className="mt-2">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-[11px] uppercase tracking-[0.16em] text-text-faint transition hover:text-text-muted">
          ⌄ Rúbrica · lo que el evaluador exige
        </summary>
        <ul className="mt-2 space-y-1.5">
          {gate.rubric.map((r, i) => (
            <li key={i} className="text-[12px] leading-snug text-text-muted">
              · {r}
            </li>
          ))}
        </ul>
      </details>

      <textarea
        value={justification}
        onChange={(e) => setJustification(e.target.value)}
        aria-label="Tu justificación de primer principio"
        rows={6}
        placeholder="Justifica desde el primer principio — el porqué, no el qué. Argumenta la invariante/recurrencia."
        className="scroll-touch mt-3 w-full resize-none rounded-[var(--r-sm)] border border-line bg-ink p-3 font-mono text-[13px] text-text placeholder:text-text-faint focus:outline-none"
        style={{ borderColor: "color-mix(in srgb, " + accent + " 30%, var(--line))" }}
      />
      <button
        onClick={() => void submit()}
        disabled={!justification.trim() || busy}
        aria-busy={busy}
        className="mt-2 min-h-11 w-full rounded-[var(--r-sm)] border px-4 text-sm transition hover:brightness-125 disabled:opacity-40"
        style={{ borderColor: accent, color: readableAccent(accent) }}
      >
        {busy ? "Evaluando…" : gatePassed ? "Re-someter" : "Someter al evaluador"}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {busy ? "Evaluando tu justificación…" : ""}
      </span>

      {/* OFFLINE: the submission was ENQUEUED — honest, and the gate does NOT open by queuing */}
      {pending && (
        <div role="status" aria-live="polite" className="mt-3 rounded-[var(--r-md)] border p-3" style={{ borderColor: "var(--amber)" }}>
          <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--amber)" }}>En cola · sin evaluar</div>
          <p className="mt-1.5 text-[13px] leading-snug text-text-muted">
            Guardado sin conexión — tu justificación está a salvo. El evaluador adversarial la juzgará al reconectar; la compuerta NO se abre por estar en la cola.
          </p>
        </div>
      )}

      {/* live region is mounted UNCONDITIONALLY so the verdict is announced when it lands */}
      <div role="status" aria-live="polite" aria-atomic="true">
        {verdict && (
          <div
            className="mt-3 rounded-[var(--r-md)] border p-3"
            style={{ borderColor: verdict.passed ? accent : "var(--amber)" }}
          >
            <div className="flex items-center gap-2">
            <span
              className="text-[11px] uppercase tracking-[0.16em]"
              style={{ color: verdict.passed ? readableAccent(accent) : "var(--amber)" }}
            >
              {verdict.passed ? "Compuerta abierta" : "No abre"}
            </span>
            {verdict.score !== null && <span className="tnum text-[11px] text-text-faint">{Math.round(verdict.score * 100)}%</span>}
          </div>
            <p className="mt-1.5 text-[13px] leading-snug text-text-muted">{verdict.feedback}</p>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-text-faint">
              {verdict.source === "ai" ? `vía IA · ${verdict.provider ?? ""}` : "heurística local — la compuerta requiere el evaluador (IA)"}
            </div>
          </div>
        )}
      </div>
      {verdict?.passed && (
        <p className="mt-2 text-[12px]" style={{ color: readableAccent(accent) }}>
          La siguiente celda se desbloqueó.
        </p>
      )}
    </div>
  );
}
