"use client";

import { useEffect, useState } from "react";
import type { Json } from "@/core/event";
import { pyodideStatus, PY_NEEDS_DOWNLOAD, PY_SQL_UNAVAILABLE, runPy } from "@/lib/py-runner";
import type { RunnerProps } from "./registry";
import type { ForgeItemOf } from "@/forge/bank/registry";
import type { SqlCell } from "@/forge/eval/sql";
import {
  gradeForense,
  probarControl,
  runForensePasos,
  type ForenseGrade,
  type ForensePaso,
} from "@/forge/eval/forensics";
import { useActions } from "@/ui/use-actions";
import { area, box, btn, meta, mono, selectStyle, summaryStyle, RunnerFrame, useEvidenceWriter, useItemEvidence } from "./kit";

// m · forense runner (design §5.4, D3, D6). The learner marks, per lie, the step where it is born and writes one SQL
// control; the control runs ONLY on the lying pipeline to explore, and the submission grades every lie in one harness
// (Pyodide over SQLite, read-only). The verdict is local; evidence is written BEFORE anything is revealed (kit guard).
// The lies (id, type, step), the correction, the reference controls and the per-lie ✓/✗ of the step appear only once a
// correct submission is in the log. Sin red: pyodideStatus({ sqlite }) tells whether Python must be downloaded once.

const sqlRun = (code: string, fn: string, cases: Parameters<typeof runPy>[2]) => runPy(code, fn, cases, 15000, { packages: ["sqlite3"] });

function ResultTable({ cols, rows }: { cols: string[]; rows: SqlCell[][] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ ...mono, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={i} style={{ borderBottom: "1px solid var(--forge-line)", padding: "0.15rem 0.5rem", textAlign: "left" }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td key={j} style={{ padding: "0.15rem 0.5rem" }}>
                  {v === null ? "NULL" : String(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ProbeState = { cols: string[]; rows: SqlCell[][]; filas: number } | { error: string } | null;

function ForenseBody({ item, cellId, readModel, onClose }: Omit<RunnerProps, "item"> & { item: ForgeItemOf<"forense"> }) {
  const itemId = item.itemId;
  const d = item.data;
  const n = d.mentiras.length;
  const { record, guarded, logError } = useEvidenceWriter(cellId, readModel);
  const { passLesson: passLessonRaw } = useActions();
  const goalId = readModel.modules.find((m) => m.id === cellId)?.goalId ?? null;
  const passLesson = (score: number) => passLessonRaw({ goalId, moduleId: cellId }, score);

  const [pasos, setPasos] = useState<string[]>(() => Array(n).fill(""));
  const [controles, setControles] = useState<string[]>(() => Array(n).fill(""));
  const [conteos, setConteos] = useState<ForensePaso[] | null>(null);
  const [conteosErr, setConteosErr] = useState<string | null>(null);
  const [probe, setProbe] = useState<Record<number, ProbeState>>({});
  const [grade, setGrade] = useState<ForenseGrade | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsDownload, setNeedsDownload] = useState(false);
  const revelado = !!useItemEvidence(cellId, itemId, "forense", "respuesta", "correcto");

  useEffect(() => {
    let alive = true;
    if (typeof navigator !== "undefined" && navigator.onLine === false)
      void pyodideStatus({ sqlite: true }).then((s) => alive && setNeedsDownload(s !== null && s.listos < s.total));
    return () => {
      alive = false;
    };
  }, []);

  const pasoIds = d.pipeline.pasos.map((p) => p.id);
  const puedeEntregar = pasos.every((p) => p) && controles.every((c) => c.trim().length > 0);

  async function verConteos() {
    setConteosErr(null);
    setBusy(true);
    try {
      const r = await runForensePasos(d, sqlRun);
      if (Array.isArray(r)) setConteos(r);
      else setConteosErr(r.estado === "sin-python" ? PY_SQL_UNAVAILABLE : r.estado === "tiempo" ? "El cálculo tardó demasiado y se detuvo." : "motivo" in r ? r.motivo : r.estado);
    } finally {
      setBusy(false);
    }
  }

  async function probar(i: number) {
    setBusy(true);
    try {
      const r = await probarControl(d, controles[i] ?? "", sqlRun);
      if ("cols" in r) setProbe((p) => ({ ...p, [i]: { cols: r.cols, rows: r.rows, filas: r.filas } }));
      else setProbe((p) => ({ ...p, [i]: { error: r.estado === "rechazada" || r.estado === "error-item" ? r.motivo : r.estado === "sin-python" ? PY_SQL_UNAVAILABLE : r.estado === "tiempo" ? "El control tardó demasiado y se detuvo." : r.estado } }));
    } finally {
      setBusy(false);
    }
  }

  const entregar = guarded(async () => {
    setBusy(true);
    try {
      const g = await gradeForense(d, { pasos, controles }, sqlRun);
      if (g.estado === "calificada") {
        await record({
          itemId,
          type: "forense",
          phase: "respuesta",
          outcome: g.correcto ? "correcto" : "incorrecto",
          data: { pasos, controles: g.porMentira.map((m, i) => ({ sql: controles[i] ?? "", correcto: m.controlOk })) } as unknown as Json,
          source: "local",
        });
        if (g.correcto) void passLesson(1);
      }
      setGrade(g);
    } finally {
      setBusy(false);
    }
  });

  function resultLines(g: Extract<ForenseGrade, { estado: "calificada" }>): string[] {
    const out: string[] = [];
    if (g.correcto) out.push(n === 1 ? "✓ La mentira localizada y detectada." : `✓ Las ${n} mentiras localizadas y detectadas.`);
    if (g.porMentira.some((m) => !m.pasoOk)) out.push("✕ Revisa las mentiras: hay al menos un paso mal marcado.");
    const c = g.porMentira.filter((m) => !m.controlOk).length;
    if (c > 0) out.push(`✕ Revisa los controles: ${c} de ${n} no distinguen los dos pipelines.`);
    return out;
  }

  return (
    <RunnerFrame tipo="forense" itemId={itemId} title={item.title} statement={item.statement} juez="local" extra={`corte ${d.corte}`} onClose={onClose}>
      {needsDownload ? <p role="status">{PY_NEEDS_DOWNLOAD}</p> : null}
      <details style={box}>
        <summary style={{ ...meta, ...summaryStyle }}>esquema y datos</summary>
        <pre style={mono}>{d.esquema}</pre>
        <pre style={{ ...mono, marginTop: "0.5rem" }}>{d.datos}</pre>
      </details>
      <div style={box}>
        <p style={meta}>pipeline</p>
        <pre style={mono}>{d.pipeline.sql}</pre>
      </div>
      <div style={box}>
        <p style={meta}>invariantes</p>
        <ul style={{ ...mono, paddingLeft: "1.1rem" }}>
          {d.invariantes.map((inv) => (
            <li key={inv.id}>
              {inv.id} · {inv.tipo} · {inv.sobre}
              {inv.columnas?.length ? ` · ${inv.columnas.join(", ")}` : ""}
              {inv.esperado !== undefined ? ` · esperado ${String(inv.esperado)}` : ""}
              {inv.tolerancia !== undefined ? ` · tolerancia ${inv.tolerancia}` : ""}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <button type="button" style={btn} onClick={() => void verConteos()} disabled={busy}>
          Ver conteos por paso
        </button>
      </div>
      {conteosErr ? <p role="alert">✕ {conteosErr}</p> : null}
      {conteos ? (
        <div style={box}>
          <table style={{ ...mono, borderCollapse: "collapse" }}>
            <tbody>
              {conteos.flatMap((p) =>
                "error" in p
                  ? [
                      <tr key={p.id}>
                        <td style={{ padding: "0.1rem 0.5rem" }}>{p.id}</td>
                        <td style={{ padding: "0.1rem 0.5rem" }} colSpan={2}>
                          {p.error}
                        </td>
                      </tr>,
                    ]
                  : p.objetos.length
                    ? p.objetos.map((o) => (
                        <tr key={`${p.id}-${o.nombre}`}>
                          <td style={{ padding: "0.1rem 0.5rem" }}>{p.id}</td>
                          <td style={{ padding: "0.1rem 0.5rem" }}>{o.nombre}</td>
                          <td style={{ padding: "0.1rem 0.5rem" }}>{o.filas}</td>
                        </tr>
                      ))
                    : [
                        <tr key={p.id}>
                          <td style={{ padding: "0.1rem 0.5rem" }}>{p.id}</td>
                          <td style={{ padding: "0.1rem 0.5rem" }} colSpan={2}>
                            —
                          </td>
                        </tr>,
                      ],
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {d.mentiras.map((m, i) => {
        const pr = probe[i];
        return (
          <div key={m.id} style={box}>
            <p style={{ margin: 0 }}>
              Mentira {i + 1}: rompe «{m.invariante}»
            </p>
            <label style={{ display: "grid", gap: "0.25rem", marginTop: "0.4rem" }}>
              <span style={meta}>paso donde nace</span>
              <select
                value={pasos[i] ?? ""}
                onChange={(e) => setPasos((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                aria-label={`Paso de la mentira ${i + 1}`}
                style={selectStyle}
              >
                <option value="">elige un paso…</option>
                {pasoIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: "0.25rem", marginTop: "0.4rem" }}>
              <span style={meta}>control SQL de una sola lectura</span>
              <textarea
                value={controles[i] ?? ""}
                onChange={(e) => setControles((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                rows={3}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-label={`Control de la mentira ${i + 1}`}
                style={area}
              />
            </label>
            <div style={{ marginTop: "0.4rem" }}>
              <button type="button" style={btn} onClick={() => void probar(i)} disabled={busy || !(controles[i] ?? "").trim()}>
                Probar sobre el pipeline
              </button>
            </div>
            {pr && "error" in pr ? <p role="alert">✕ {pr.error}</p> : null}
            {pr && "cols" in pr ? (
              <div role="status" style={{ marginTop: "0.4rem" }}>
                <p style={meta}>{pr.filas} fila{pr.filas === 1 ? "" : "s"} sobre el pipeline que miente</p>
                <ResultTable cols={pr.cols} rows={pr.rows} />
                {pr.filas > pr.rows.length ? <p style={meta}>… y {pr.filas - pr.rows.length} filas más</p> : null}
              </div>
            ) : null}
          </div>
        );
      })}

      {grade?.estado === "calificada"
        ? grade.porMentira.map((m, i) => (
            <span key={`pm-${i}`}>{revelado && <span data-paso-ok={i}>{m.pasoOk ? "paso ✓" : "paso ✕"}</span>}</span>
          ))
        : null}

      <div>
        <button type="button" style={btn} onClick={() => void entregar()} disabled={busy || !puedeEntregar}>
          {busy ? "Procesando…" : "Entregar ↗"}
        </button>
      </div>

      {grade?.estado === "rechazada" ? <p role="alert">✕ {grade.motivo}</p> : null}
      {grade?.estado === "sin-python" ? <p role="alert">✕ {PY_SQL_UNAVAILABLE}</p> : null}
      {grade?.estado === "tiempo" ? <p role="alert">✕ El cálculo tardó demasiado y se detuvo.</p> : null}
      {grade?.estado === "error-item" ? <p role="alert">✕ Este ítem está mal construido y no se puede calificar: {grade.motivo}</p> : null}
      {grade?.estado === "calificada" ? (
        <div role="status" style={{ ...box, borderStyle: grade.correcto ? "solid" : "dashed" }}>
          {resultLines(grade).map((t, i) => (
            <p key={i} style={{ margin: 0 }}>
              {t}
            </p>
          ))}
        </div>
      ) : null}
      {logError ? <p role="alert">✕ {logError}</p> : null}

      {revelado ? (
        <div style={box}>
          <p style={meta}>mentiras</p>
          <ul style={{ ...mono, paddingLeft: "1.1rem" }}>
            {d.mentiras.map((m) => (
              <li key={m.id}>
                {m.id} · {m.tipo} · nace en {m.paso}
              </li>
            ))}
          </ul>
          <p style={{ ...meta, marginTop: "0.5rem" }}>corrección</p>
          <pre style={mono}>{d.correccion}</pre>
          <p style={{ ...meta, marginTop: "0.5rem" }}>controles de referencia</p>
          {d.controles.map((c, i) => (
            <pre key={i} style={mono}>
              {c}
            </pre>
          ))}
        </div>
      ) : null}
    </RunnerFrame>
  );
}

export default function ForenseRunner(props: RunnerProps) {
  if (props.item.type !== "forense") return <p role="status">Este ítem no es de tipo forense.</p>;
  return <ForenseBody {...props} item={props.item} />;
}
