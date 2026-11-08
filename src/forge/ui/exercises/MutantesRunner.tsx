"use client";

import { useState } from "react";
import { formatValue } from "@/lib/exercise";
import { runJs } from "@/lib/js-runner";
import type { RunnerProps } from "./registry";
import type { ForgeItemOf } from "@/forge/bank/registry";
import { gradeMutants, MUT_JSON_MAX, parseMutantCases, type MutantsGrade } from "@/forge/eval/mutants";
import { useActions } from "@/ui/use-actions";
import { area, box, btn, meta, mono, RunnerFrame, useEvidenceWriter, useItemEvidence } from "./kit";

// d · mutantes runner (design §5.2). The learner writes a JSON list of test cases; the evaluator runs the reference
// and every seeded version. Mutants are shown anonymised («versión k · crítica») until a correct attempt is in the
// log, when their ids and code appear. The verdict is local; evidence is written before anything is revealed.

const runner = (code: string, fn: string, cases: Parameters<typeof runJs>[2]) => runJs(code, fn, cases);

function MutantesBody({ item, cellId, readModel, onClose }: Omit<RunnerProps, "item"> & { item: ForgeItemOf<"mutantes"> }) {
  const itemId = item.itemId;
  const d = item.data;
  const { record, guarded, logError } = useEvidenceWriter(cellId, readModel);
  const { passLesson } = useActions();
  const goalId = readModel.modules.find((m) => m.id === cellId)?.goalId ?? null;
  const [raw, setRaw] = useState("");
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [grade, setGrade] = useState<MutantsGrade | null>(null);
  const revelado = !!useItemEvidence(cellId, itemId, "mutantes", "respuesta", "correcto");

  const criticos = d.mutantes.filter((m) => m.critico).length;

  const correr = guarded(async () => {
    setParseErr(null);
    const parsed = parseMutantCases(raw);
    if (!parsed.ok) {
      setParseErr(parsed.error);
      return;
    }
    setBusy(true);
    try {
      const g = await gradeMutants(d, parsed.casos, runner);
      if (g.estado === "calificada") {
        await record({
          itemId,
          type: "mutantes",
          phase: "respuesta",
          outcome: g.correcto ? "correcto" : "incorrecto",
          data: {
            casos: parsed.casos.length,
            validos: g.validos.length,
            muertos: g.mutantes.filter((m) => m.muerto).map((m) => m.id),
            vivos: g.mutantes.filter((m) => !m.muerto).map((m) => m.id),
            criticosVivos: g.criticosVivos,
          },
          source: "local",
        });
        if (g.correcto) void passLesson({ goalId, moduleId: cellId }, 1);
      }
      setGrade(g);
    } finally {
      setBusy(false);
    }
  });

  function lineaGeneral(g: Extract<MutantsGrade, { estado: "calificada" }>): string {
    const m = g.muertos;
    const M = g.mutantes.length;
    if (g.validos.length === 0) return "✕ Ningún caso es válido: la referencia no devuelve lo que esperas en ninguno.";
    if (g.correcto) return `✓ Mataste ${m} de ${M} versiones, todas las críticas.`;
    if (g.criticosVivos > 0) return `✕ Mataste ${m} de ${M}; quedan ${g.criticosVivos} críticas vivas.`;
    return `✕ Mataste ${m} de ${M}; necesitas al menos ${d.minimo}.`;
  }

  return (
    <RunnerFrame tipo="mutantes" itemId={itemId} title={item.title} statement={item.statement} juez="local" onClose={onClose}>
      <div style={box}>
        <p style={meta}>firma</p>
        <pre style={mono}>{d.firma}</pre>
        <p style={{ ...meta, marginTop: "0.5rem" }}>formato de casos</p>
        <pre style={mono}>{d.formato}</pre>
      </div>
      <p style={meta}>
        Hay {d.mutantes.length} versiones sembradas, {criticos} críticas; necesitas matar al menos {d.minimo} y todas las críticas.
      </p>
      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span style={meta}>tus casos (lista JSON) · {raw.length.toLocaleString("en-US")} / {MUT_JSON_MAX.toLocaleString("en-US")}</span>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value.slice(0, MUT_JSON_MAX))}
          rows={6}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          maxLength={MUT_JSON_MAX}
          aria-label="Tus casos (lista JSON)"
          style={area}
        />
      </label>
      <div>
        <button type="button" style={btn} onClick={() => void correr()} disabled={busy || !raw.trim()}>
          {busy ? "Corriendo…" : "Correr mis casos ↗"}
        </button>
      </div>
      {parseErr ? <p role="alert">✕ {parseErr}</p> : null}
      {grade?.estado === "rechazada" ? <p role="alert">✕ {grade.motivo}</p> : null}
      {grade?.estado === "tiempo" ? <p role="alert">✕ Tu código tardó demasiado y se detuvo.</p> : null}
      {grade?.estado === "error-item" ? <p role="alert">✕ Este ítem está mal construido y no se puede calificar: {grade.motivo}</p> : null}
      {grade?.estado === "calificada" ? (
        <div role="status" style={{ ...box, borderStyle: grade.correcto ? "solid" : "dashed" }}>
          <p style={{ margin: 0 }}>{lineaGeneral(grade)}</p>
          <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.1rem" }}>
            {grade.invalidos.map((iv) => (
              <li key={`iv-${iv.i}`}>
                caso {iv.i + 1} · expectativa errónea: la referencia devuelve {iv.referencia.ok ? formatValue(iv.referencia.value) : `un error: ${iv.referencia.error}`}
              </li>
            ))}
            {grade.mutantes.map((mu) => (
              <li key={mu.id}>
                {revelado ? `«${mu.id}»` : `versión ${mu.idx + 1}`}
                {mu.critico ? " · crítica" : ""} · {mu.muerto ? (mu.porTiempo ? "muerta: no terminó" : "muerta") : "viva"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {logError ? <p role="alert">✕ {logError}</p> : null}
      {revelado ? (
        <div style={box}>
          <p style={meta}>versiones sembradas</p>
          {d.mutantes.map((mu) => (
            <div key={mu.id} style={{ marginTop: "0.5rem" }}>
              <p style={meta}>«{mu.id}»{mu.critico ? " · crítico" : ""}</p>
              <pre style={mono}>{mu.code}</pre>
            </div>
          ))}
        </div>
      ) : null}
    </RunnerFrame>
  );
}

export default function MutantesRunner(props: RunnerProps) {
  if (props.item.type !== "mutantes") return <p role="status">Este ítem no es de tipo mutantes.</p>;
  return <MutantesBody {...props} item={props.item} />;
}
