"use client";

import { useEffect, useRef, useState } from "react";
import { useArcanum } from "@/app/providers";
import { useActions } from "@/ui/use-actions";
import { useReward } from "@/ui/reward/RewardProvider";
import { readableAccent } from "@/lib/accent";
import { audio } from "@/lib/audio";
import type { TopicMission } from "@/lib/subject-content";

// The DIRECTED MISSION panel (heavy cell). It gives the ORDER (assignment anchored to the
// real source), takes the learner's returned EVIDENCE, and submits it to the adversarial
// interrogator. Passing the interrogation unseals the next cell — real power over
// progression, derived from the log. Visual language reused verbatim from ExitGate.

export function MissionPanel({
  moduleId,
  mission,
  sourceUrls,
  accent,
  mode,
  judge,
}: {
  moduleId: string;
  mission: TopicMission;
  sourceUrls: string[];
  accent: string;
  mode?: "pattern" | "exam" | null;
  /** the cell's REAL judge for the arena HUD; absent on a pattern cell → the Codeforces default */
  judge?: { label: string; sub?: string } | null;
}) {
  const pattern = mode === "pattern";
  const exam = mode === "exam";
  const arena = pattern || exam; // both are clock-natured cells with an arena face
  // the arena HUD names the cell's REAL judge — never a foreign one. A pattern cell without its own
  // judge keeps the Competitiva default; an exam cell declares its own (the OA spine does, per cell).
  const judgeLabel = judge?.label ?? (pattern ? "La arena · el juez real es Codeforces/AtCoder" : null);
  const judgeSub = judge ? (judge.sub ?? null) : pattern ? "resuélvelo allá · trae tu veredicto + tiempo + solución" : null;
  const verdict = useArcanum((s) => s.readModel.gates.find((g) => g.moduleId === moduleId) ?? null);
  const gatePassed = useArcanum((s) => s.readModel.modules.find((m) => m.id === moduleId)?.gatePassed ?? false);
  const goalId = useArcanum((s) => s.readModel.modules.find((m) => m.id === moduleId)?.goalId ?? null);
  const submitted = useArcanum((s) => s.readModel.missions.find((m) => m.moduleId === moduleId) ?? null);
  const pending = useArcanum((s) => s.readModel.pendingAi.some((p) => p.moduleId === moduleId && p.kind === "mission"));
  const { submitMission, interrogateMission } = useActions();
  const reward = useReward();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  // a fresh verdict: passing the interrogation (a heavy cell mastered) is a LARGE ceremonious moment;
  // a fail stays a plain tension tone (honest, not punitive).
  const lastTs = useRef<number | null>(null);
  useEffect(() => {
    if (!verdict) return;
    if (lastTs.current !== null && verdict.ts !== lastTs.current) {
      if (verdict.passed) reward("large", { accent, sfx: "gate" });
      else audio.sfx("error");
    }
    lastTs.current = verdict.ts;
  }, [verdict?.ts, verdict?.passed, verdict]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    // synchronous guard against a rapid double-tap firing duplicate events
    if (!notes.trim() || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      // evidence first (durable proof of work), then the interrogation verdict
      await submitMission({ goalId, moduleId }, notes);
      await interrogateMission(moduleId, notes);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[var(--r-md)] border p-4" style={{ borderColor: gatePassed ? accent : "var(--line)" }}>
      {/* ARENA HUD — timed cells have their own face: the clock, the cell's REAL judge. */}
      {judgeLabel && (
        <div
          className="mb-3 flex items-center gap-2 rounded-[var(--r-sm)] border px-3 py-2"
          style={{ borderColor: "color-mix(in srgb, " + accent + " 40%, var(--line))", background: "color-mix(in srgb, " + accent + " 10%, transparent)" }}
        >
          <span aria-hidden className="font-display text-sm" style={{ color: readableAccent(accent) }}>⏱</span>
          <span className="text-[10px] uppercase leading-tight tracking-[0.16em]" style={{ color: readableAccent(accent) }}>
            {judgeLabel}
            {judgeSub && <span className="block text-text-faint">{judgeSub}</span>}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xs uppercase tracking-[0.22em] text-text-faint">
          {exam ? "Reto de examen · interrogatorio" : pattern ? "Reto de patrón · interrogatorio" : "Misión dirigida · interrogatorio"}
        </h3>
        {gatePassed && (
          <span className="text-[11px] uppercase tracking-wider" style={{ color: readableAccent(accent) }}>
            {arena ? "✓ patrón dominado" : "✓ superada"}
          </span>
        )}
      </div>

      {/* THE ORDER — anchored to the real source. The cell directs; it does not suggest. */}
      <p className="mt-2 font-serif text-[15px] leading-snug text-text">{mission.assignment}</p>
      {sourceUrls.length > 0 && (
        <a
          href={sourceUrls[0]}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 inline-flex min-h-11 items-center text-[13px] transition hover:underline"
          style={{ color: readableAccent(accent) }}
        >
          Ir a la fuente · {sourceUrls[0]!.replace(/^https?:\/\//, "").slice(0, 44)} ↗
        </a>
      )}

      <details className="mt-2">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-[11px] uppercase tracking-[0.16em] text-text-faint transition hover:text-text-muted">
          ⌄ Qué traer de vuelta
        </summary>
        <p className="mt-2 text-[12px] leading-snug text-text-muted">{mission.deliverable}</p>
      </details>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        aria-label="Tu evidencia: notas y reflexiones de la misión"
        rows={8}
        placeholder="Trae TUS notas y reflexiones de la fuente real — no el subtitulado, no un resumen. El interrogatorio asume que la viviste."
        className="scroll-touch mt-3 w-full resize-none rounded-[var(--r-sm)] border border-line bg-ink p-3 font-mono text-[13px] text-text placeholder:text-text-faint focus:outline-none"
        style={{ borderColor: "color-mix(in srgb, " + accent + " 30%, var(--line))" }}
      />
      {submitted && (
        <p className="mt-1 text-[10px] uppercase tracking-wider text-text-faint">
          Evidencia entregada ✓ — vuelve a someter para re-interrogar
        </p>
      )}
      <button
        onClick={() => void submit()}
        disabled={!notes.trim() || busy}
        aria-busy={busy}
        className="mt-2 min-h-11 w-full rounded-[var(--r-sm)] border px-4 text-sm transition hover:brightness-125 disabled:opacity-40"
        style={{ borderColor: accent, color: readableAccent(accent) }}
      >
        {busy ? "Interrogando…" : gatePassed ? "Re-someter evidencia" : "Entregar y someter al interrogatorio"}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {busy ? "Interrogando tu evidencia…" : ""}
      </span>

      {/* OFFLINE: the interrogation was ENQUEUED — evidence saved (mission.submitted + queue); the
          gate does NOT open by queuing; the real interrogator runs on reconnect */}
      {pending && (
        <div role="status" aria-live="polite" className="mt-3 rounded-[var(--r-md)] border p-3" style={{ borderColor: "var(--amber)" }}>
          <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--amber)" }}>En cola · sin interrogar</div>
          <p className="mt-1.5 text-[13px] leading-snug text-text-muted">
            Guardado sin conexión — tu evidencia está a salvo. El interrogador adversarial la juzgará al reconectar; el nodo NO se abre por estar en la cola.
          </p>
        </div>
      )}

      {/* live region mounted UNCONDITIONALLY so the verdict is announced when it lands */}
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
                {verdict.passed ? "Interrogatorio superado" : "No abre"}
              </span>
              {verdict.score !== null && <span className="tnum text-[11px] text-text-faint">{Math.round(verdict.score * 100)}%</span>}
            </div>
            <p className="mt-1.5 text-[13px] leading-snug text-text-muted">{verdict.feedback}</p>
            {verdict.questions.length > 0 && (
              <div className="mt-2">
                <h4 className="text-[10px] uppercase tracking-[0.2em] text-text-faint">El interrogatorio preguntó</h4>
                <ol className="mt-1 list-decimal space-y-1 pl-4">
                  {verdict.questions.map((q, i) => (
                    <li key={i} className="text-[12px] leading-snug text-text-muted">
                      {q}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <div className="mt-1.5 text-[10px] uppercase tracking-wider text-text-faint">
              {verdict.source === "ai" ? `vía IA · ${verdict.provider ?? ""}` : "heurística local — el interrogatorio requiere el evaluador (IA)"}
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
