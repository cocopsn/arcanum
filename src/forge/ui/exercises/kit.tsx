"use client";

import { useCallback, useState, type CSSProperties, type JSX, type ReactNode } from "react";
import { useArcanum, useArcanumStore } from "@/app/providers";
import { useActions } from "@/ui/use-actions";
import { evidencePayloadError, type EvidenceRecordedPayload, type ForgeEvidenceOutcome, type ForgeEvidenceType } from "@/core/evidence";
import type { Json } from "@/core/event";
import type { EvidenceRM, ReadModel } from "@/core/read-model";

// SHARED RUNNER KIT (design §4.1, §15.3, decision D8). The styles that SqlRunner and HistorialRunner already repeat
// (box, mono, meta, btn) plus the pieces the new runners share: RunnerFrame, useEvidenceWriter (the RF-3 guard in a
// SINGLE place) and useItemEvidence. Only var(--forge-*); monochrome D4. Every touch control is ≥ 44 px via `tap`.
// SqlRunner.tsx is NOT edited: this file copies its styles (it is out of scope, PR #11).

export const box: CSSProperties = { border: "1px solid var(--forge-line)", background: "var(--forge-surface)", padding: "0.75rem", borderRadius: 2 };
export const mono: CSSProperties = { fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: "0.8rem", whiteSpace: "pre-wrap", margin: 0 };
export const meta: CSSProperties = { fontVariant: "small-caps", letterSpacing: "0.12em", color: "var(--forge-text-muted)", fontSize: "0.75rem" };
export const tap: CSSProperties = { minHeight: 44, minWidth: 44 };
export const btn: CSSProperties = { ...box, ...tap, padding: "0.35rem 0.6rem", color: "var(--forge-text)", cursor: "pointer" };
export const choice: CSSProperties = { ...tap, display: "inline-flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" };
export const summaryStyle: CSSProperties = { ...tap, display: "flex", alignItems: "center", cursor: "pointer" };
export const selectStyle: CSSProperties = { ...box, ...tap, color: "var(--forge-text)" };
export const area: CSSProperties = { ...mono, ...box, color: "var(--forge-text)", minHeight: "8rem", width: "100%" };

export const LOG_ERROR = "No se pudo registrar el intento en tu dispositivo; vuelve a intentarlo.";
export const PY_UNAVAILABLE = "No se pudo cargar Python: conéctate una vez para descargarlo.";
/** What `record` throws when the write fails; only `guarded` catches it. */
export const RECORD_FAILED: unique symbol = Symbol("record-failed");

export const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

export type Juez = "local" | "ia" | "self";
export const JUEZ_TEXT: Record<Juez, string> = {
  local: "comprobado en tu dispositivo",
  ia: "lo juzga el evaluador (IA)",
  self: "autoverificación: tú comparas con el paso modelo",
};

/** <section data-forge-runner={tipo} data-item={itemId} aria-label={title}>: header «<tipo> · <juez>», title,
 *  statement (plain text, pre-wrap), children and the «Cerrar» button (btn). */
export function RunnerFrame(p: { tipo: string; itemId: string; title: string; statement: string; juez: Juez; extra?: string; onClose: () => void; children: ReactNode }): JSX.Element {
  return (
    <section aria-label={p.title} data-forge-runner={p.tipo} data-item={p.itemId} style={{ display: "grid", gap: "0.75rem" }}>
      <header>
        <p style={meta}>
          {p.tipo} · {JUEZ_TEXT[p.juez]}
          {p.extra ? ` · ${p.extra}` : ""}
        </p>
        <h3 style={{ margin: "0.25rem 0" }}>{p.title}</h3>
        <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{p.statement}</p>
      </header>
      {p.children}
      <div>
        <button type="button" style={btn} onClick={p.onClose}>
          Cerrar
        </button>
      </div>
    </section>
  );
}

/** Evidence writing with the RF-3 guard in a single place. `record(p)`: evidencePayloadError first, then
 *  useActions().fire("evidence.recorded", p, { goalId, moduleId: cellId }). If any of that fails, it sets
 *  logError = LOG_ERROR and throws RECORD_FAILED. `guarded(fn)` runs a click handler: clears logError, catches
 *  RECORD_FAILED (nothing after record in `fn` runs: not the result, not the reveal, not passLesson) and lets any
 *  other error through. Runners call `record` inside `guarded` and never wrap it in their own try/catch. */
export function useEvidenceWriter(
  cellId: string,
  readModel: ReadModel,
): {
  record: (p: EvidenceRecordedPayload) => Promise<void>;
  guarded: (fn: () => Promise<void>) => () => Promise<void>;
  logError: string | null;
} {
  const { fire } = useActions();
  const [logError, setLogError] = useState<string | null>(null);
  const goalId = readModel.modules.find((m) => m.id === cellId)?.goalId ?? null;

  const record = useCallback(
    async (p: EvidenceRecordedPayload) => {
      try {
        const err = evidencePayloadError(p);
        if (err) throw new Error(err);
        await fire("evidence.recorded", p as unknown as Json, { goalId, moduleId: cellId });
      } catch { setLogError(LOG_ERROR); throw RECORD_FAILED; }
    },
    [fire, goalId, cellId],
  );

  const guarded = useCallback(
    (fn: () => Promise<void>) => async () => {
      setLogError(null);
      try {
        await fn();
      } catch (e) {
        if (e === RECORD_FAILED) return;
        throw e;
      }
    },
    [],
  );

  return { record, guarded, logError };
}

const tsOf = (e: EvidenceRM) => e.ts;

/** The item's live evidence that meets the filter: with which = "first" (default) the first in the read model
 *  order; with "last" the one of greatest `ts` (ties: the one later in the array). Returns the STABLE read-model
 *  object or null; never a fresh array, so useArcanum's selector does not re-render in a loop. */
export function useItemEvidence(
  cellId: string,
  itemId: string,
  type: ForgeEvidenceType,
  phase: string,
  outcome?: ForgeEvidenceOutcome,
  which: "first" | "last" = "first",
): EvidenceRM | null {
  return useArcanum((s) => {
    let best: EvidenceRM | null = null;
    for (const e of s.readModel.evidence) {
      if (e.moduleId !== cellId || e.itemId !== itemId || e.type !== type || e.phase !== phase) continue;
      if (outcome !== undefined && e.outcome !== outcome) continue;
      if (best === null) best = e;
      else if (which === "last" && tsOf(e) >= tsOf(best)) best = e;
    }
    return best;
  });
}

// re-export so runners can type the store without importing providers directly in tests
export type { ReadModel };
export { useArcanumStore };
