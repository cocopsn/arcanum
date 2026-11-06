"use client";

import { useState } from "react";
import { useArcanum } from "@/app/providers";
import type { RunnerProps } from "./registry";
import type { ForgeItemOf } from "@/forge/bank/registry";
import { gradePrediction, validConfidence } from "@/forge/eval/prediction";
import { calibration, firstEvidence } from "@/forge/model/calibration";
import { useOntologyEvidence } from "@/forge/ui/OntologyEditor";

// PRACTICE runner of `prediccion` (design §9.3 a). The learner picks an option and a confidence from the item's scale,
// with no default value, and the answer is written to the log (awaited; if the write fails nothing changes). The marked
// option and the justification are painted ONLY when firstEvidence(rm, cellId, itemId, "respuesta") exists; everything
// shown afterwards derives from that FIRST record, so a later answer never changes it nor the calibration.
type PrediccionItem = ForgeItemOf<"prediccion">;

const meta = { fontFamily: "ui-monospace, monospace", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#b9b9b9" };
const pct = (x: number | null) => (x === null ? "—" : x.toFixed(2));

export default function PrediccionRunner({ item, cellId, onClose }: RunnerProps) {
  const it = item as PrediccionItem;
  const { opciones, escala, correcta, justificacion } = it.data;
  const [elegida, setElegida] = useState<number | null>(null);
  const [confianza, setConfianza] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const record = useOntologyEvidence(cellId);
  const first = useArcanum((s) => firstEvidence(s.readModel, cellId, it.itemId, "respuesta"));
  const cal = useArcanum((s) => calibration(s.readModel, cellId));
  const reg = first?.data as { elegida?: number; confianza?: number } | undefined;
  const can = elegida !== null && confianza !== null && validConfidence(it.data, confianza) && !busy;

  async function predecir() {
    if (elegida === null || confianza === null) return;
    setBusy(true);
    try {
      const g = gradePrediction(it.data, { elegida, confianza });
      await record({ itemId: it.itemId, type: "prediccion", phase: "respuesta", outcome: g.correcto ? "correcto" : "incorrecto", data: { elegida, confianza }, source: "local" });
    } catch (e) {
      setStatus(`No se pudo registrar tu predicción: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-forge-runner="prediccion" data-item={it.itemId} aria-label={`Predicción · ${it.title}`}>
      <p style={meta}>↳ Comprobado en tu dispositivo · predice antes de ver</p>
      <h3>{it.title}</h3>
      <p style={{ whiteSpace: "pre-wrap" }}>{it.statement}</p>
      <fieldset>
        <legend>Tu predicción</legend>
        {opciones.map((o, i) => (
          <label key={i} style={{ display: "block" }}>
            <input type="radio" name={`pred-${it.itemId}`} disabled={!!first} checked={first ? reg?.elegida === i : elegida === i} onChange={() => setElegida(i)} /> {o}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>¿Qué tan seguro estás?</legend>
        {escala.map((c) => (
          <label key={c} style={{ marginRight: 12 }}>
            <input type="radio" name={`conf-${it.itemId}`} disabled={!!first} checked={first ? reg?.confianza === c : confianza === c} onChange={() => setConfianza(c)} /> {c} %
          </label>
        ))}
      </fieldset>
      {!first && (
        <button type="button" onClick={predecir} disabled={!can} aria-disabled={!can}>
          Registrar predicción
        </button>
      )}
      {status && <p role="status">{status}</p>}
      {first && (
        <div data-forge-prediccion="revelado" style={{ border: first.outcome === "correcto" ? "1px solid #9b9b9b" : "1px dashed #9b9b9b", padding: "0.5rem" }}>
          <p>
            {first.outcome === "correcto" ? "✓ Acertaste" : "✕ No acertaste"} · la respuesta es «{opciones[correcta]}»
          </p>
          <p>{justificacion}</p>
          <p style={meta}>
            Calibración de la celda · n = {cal.n} · aciertos {cal.aciertos} · Brier {pct(cal.brier)} · sesgo {pct(cal.sesgo)}
          </p>
        </div>
      )}
      <button type="button" onClick={onClose}>
        Cerrar
      </button>
    </section>
  );
}
