"use client";

import { useState } from "react";
import { formatValue } from "@/lib/exercise";
import { runJs } from "@/lib/js-runner";
import type { Json } from "@/core/event";
import type { RunnerProps } from "./registry";
import type { ForgeItemOf } from "@/forge/bank/registry";
import { CONTRA_ARGS_MAX, gradeCounterexample, parseContraArgs, type ContraGrade, type Outcome } from "@/forge/eval/counterexample";
import { useActions } from "@/ui/use-actions";
import { area, box, btn, meta, mono, RunnerFrame, useEvidenceWriter, useItemEvidence } from "./kit";

// e · contraejemplo runner (design §5.1). The learner writes ONE JSON list of arguments; the evaluator runs the
// author's precondition, almost-correct version, reference, comparator and invariant and decides in TypeScript
// (nothing here decides). The verdict is local; evidence is written BEFORE anything is revealed (RF-3, kit guard),
// and the reference and another witness appear only once a correct attempt («respuesta»/«correcto») is in the log.

const runner = (code: string, fn: string, cases: Parameters<typeof runJs>[2]) => runJs(code, fn, cases);
const outTxt = (o: Outcome | undefined) => (o ? (o.ok ? formatValue(o.value) : `un error: ${o.error}`) : "—");

function ContraejemploBody({ item, cellId, readModel, onClose }: Omit<RunnerProps, "item"> & { item: ForgeItemOf<"contraejemplo"> }) {
  const itemId = item.itemId;
  const d = item.data;
  const { record, guarded, logError } = useEvidenceWriter(cellId, readModel);
  const { passLesson } = useActions();
  const goalId = readModel.modules.find((m) => m.id === cellId)?.goalId ?? null;
  const [raw, setRaw] = useState("");
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [grade, setGrade] = useState<ContraGrade | null>(null);
  const revelado = !!useItemEvidence(cellId, itemId, "contraejemplo", "respuesta", "correcto");

  const probar = guarded(async () => {
    setParseErr(null);
    const parsed = parseContraArgs(raw);
    if (!parsed.ok) {
      setParseErr(parsed.error);
      return;
    }
    setBusy(true);
    try {
      const g = await gradeCounterexample(d, parsed.args, runner);
      if (g.estado === "calificada") {
        await record({
          itemId,
          type: "contraejemplo",
          phase: "respuesta",
          outcome: g.correcto ? "correcto" : "incorrecto",
          data: { args: parsed.args, motivo: g.motivo } as unknown as Json,
          source: "local",
        });
        if (g.correcto) void passLesson({ goalId, moduleId: cellId }, 1);
      }
      setGrade(g);
    } finally {
      setBusy(false);
    }
  });

  function resultText(g: ContraGrade): string {
    if (g.estado !== "calificada") return "";
    if (g.motivo === "fuera-de-contrato") return "✕ Fuera de contrato: la precondición rechaza esta entrada; no cuenta.";
    if (g.motivo === "coincide") return `✕ No es contraejemplo: las dos devuelven ${outTxt(g.ref !== undefined ? { ok: true, value: g.ref } : undefined)}.`;
    if (g.motivo === "viola-invariante") return "✓ Contraejemplo: la salida de la casi correcta viola la invariante.";
    return `✓ Contraejemplo: la casi correcta devuelve ${outTxt(g.casi)} y la referencia ${outTxt(g.ref !== undefined ? { ok: true, value: g.ref } : undefined)}.`;
  }

  return (
    <RunnerFrame tipo="contraejemplo" itemId={itemId} title={item.title} statement={item.statement} juez="local" onClose={onClose}>
      <div style={box}>
        <p style={meta}>firma</p>
        <pre style={mono}>{d.firma}</pre>
        <p style={{ ...meta, marginTop: "0.5rem" }}>precondición</p>
        <pre style={mono}>{d.pre}</pre>
        <p style={{ ...meta, marginTop: "0.5rem" }}>casi correcta</p>
        <pre style={mono}>{d.casi}</pre>
      </div>
      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span style={meta}>argumentos (lista JSON) · {raw.length.toLocaleString("en-US")} / {CONTRA_ARGS_MAX.toLocaleString("en-US")}</span>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value.slice(0, CONTRA_ARGS_MAX))}
          rows={4}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          maxLength={CONTRA_ARGS_MAX}
          aria-label="Argumentos (lista JSON)"
          style={area}
        />
        <span style={meta}>Escribe la lista de argumentos en JSON; para f(a, x), por ejemplo [[1, 2], 3]</span>
      </label>
      <div>
        <button type="button" style={btn} onClick={() => void probar()} disabled={busy || !raw.trim()}>
          {busy ? "Probando…" : "Probar contraejemplo ↗"}
        </button>
      </div>
      {parseErr ? <p role="alert">✕ {parseErr}</p> : null}
      {grade?.estado === "rechazada" ? <p role="alert">✕ {grade.motivo}</p> : null}
      {grade?.estado === "tiempo" ? <p role="alert">✕ La precondición tardó demasiado con esta entrada; prueba con una más pequeña.</p> : null}
      {grade?.estado === "error-item" ? <p role="alert">✕ Este ítem está mal construido y no se puede calificar: {grade.motivo}</p> : null}
      {grade?.estado === "calificada" ? (
        <div role="status" style={{ ...box, borderStyle: grade.correcto ? "solid" : "dashed" }}>
          <p style={{ margin: 0 }}>{resultText(grade)}</p>
        </div>
      ) : null}
      {logError ? <p role="alert">✕ {logError}</p> : null}
      {revelado ? (
        <div style={box}>
          <p style={meta}>referencia</p>
          <pre style={mono}>{d.referencia}</pre>
          <p style={{ ...meta, marginTop: "0.5rem" }}>Otro contraejemplo: {formatValue(d.testigo)}</p>
        </div>
      ) : null}
    </RunnerFrame>
  );
}

export default function ContraejemploRunner(props: RunnerProps) {
  if (props.item.type !== "contraejemplo") return <p role="status">Este ítem no es de tipo contraejemplo.</p>;
  return <ContraejemploBody {...props} item={props.item} />;
}
