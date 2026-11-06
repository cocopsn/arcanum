"use client";

import { useState } from "react";
import type { RunnerProps } from "./registry";
import { submitForgeVerdict, type ForgeApoyo, type ForgeSubmitResult } from "@/forge/ai-port";
import { OntologyEditor, useDeliveredModelId, type OntologyItem } from "@/forge/ui/OntologyEditor";

// PRACTICE runner of `ontologia` (design §9.3 l, §9.5): OntologyForge's editor without the mission. The structural
// result is local. Once the model is delivered (phase "modelo" in the log) the learner may ask for the DEFENCE, which is
// consultative evidence (§8.1): apoyo chosen by the learner, no default value, scope "local". Asking is impossible while
// the model has open structural findings, because only a delivered model (zero findings) enables it.
export default function OntologiaRunner({ item, cellCode, cellId, onClose }: RunnerProps) {
  const onto = item as OntologyItem;
  const delivered = useDeliveredModelId(cellId, onto.itemId);
  const [apoyo, setApoyo] = useState<ForgeApoyo | null>(null);
  const [result, setResult] = useState<ForgeSubmitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(1);
  const canAsk = !!delivered && open === 0 && apoyo !== null && !busy;

  async function pedirDefensa() {
    if (!delivered || open !== 0 || apoyo === null) return;
    setBusy(true);
    try {
      setResult(await submitForgeVerdict({ cellCode, kind: "ontologia", scope: "local", apoyo, artefactoEventIds: [delivered] }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-forge-runner="ontologia" data-item={onto.itemId} aria-label={`Ontology Forge · ${onto.title}`}>
      <h3>{onto.title}</h3>
      <p style={{ whiteSpace: "pre-wrap" }}>{onto.statement}</p>
      <OntologyEditor item={onto} cellId={cellId} deliverLabel="Entregar el modelo" onFindingsChange={setOpen} />
      <section aria-label="Defensa del modelo" style={{ border: "1px solid #494a4b", padding: "0.75rem", marginTop: "0.75rem" }}>
        <p style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#b9b9b9" }}>
          Defensa · lo juzga el evaluador (IA) · evidencia consultiva
        </p>
        {!delivered ? (
          <p>La defensa se pide con el modelo entregado, sin hallazgos estructurales.</p>
        ) : (
          <>
            <ul>
              {onto.data.rubrica.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
            <fieldset>
              <legend>¿Cómo hiciste el modelo?</legend>
              <label style={{ marginRight: 12 }}>
                <input type="radio" name={`apoyo-${onto.itemId}`} checked={apoyo === "independiente"} onChange={() => setApoyo("independiente")} /> Sin ayuda
              </label>
              <label>
                <input type="radio" name={`apoyo-${onto.itemId}`} checked={apoyo === "con_apoyo"} onChange={() => setApoyo("con_apoyo")} /> Con apoyo
              </label>
            </fieldset>
          </>
        )}
        <button type="button" onClick={pedirDefensa} disabled={!canAsk} aria-disabled={!canAsk}>
          Pedir defensa
        </button>
        {result?.estado === "en-cola" && <p role="status">Defensa en cola: {result.motivo}.</p>}
        {result?.estado === "acunado" && <p role="status">Defensa registrada.</p>}
        {result?.estado === "rechazado" && <p role="status">No se pudo pedir la defensa ({result.error}).</p>}
      </section>
      <button type="button" onClick={onClose}>
        Cerrar
      </button>
    </section>
  );
}
