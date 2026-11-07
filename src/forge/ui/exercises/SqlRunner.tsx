"use client";

import { useEffect, useState } from "react";
import type { RunnerProps } from "./registry";
import type { ForgeItemOf } from "@/forge/bank/registry";
import { gradeSqlQuery, SQL_QUERY_MAX, type SqlGrade, type SqlTable } from "@/forge/eval/sql";
import { pyodideCached, PY_NEEDS_DOWNLOAD, runPy } from "@/lib/py-runner";
import { useActions } from "@/ui/use-actions";

// k · sql runner (design §9.3 k, §9.5, §16). The learner writes ONE read query; it runs in Pyodide's sqlite3 (Worker,
// timeout) against every fixture, with `PRAGMA query_only = ON`, and eval/sql.ts compares the whole set of rows with
// the reference's. The grade is local («Comprobado en tu dispositivo»): an evidence.recorded with source "local" and,
// when correct, passLesson(score 1) like the other banks. Nothing here opens a compuerta (RD-8, CA-33). The reference
// query is never in the DOM until a correct attempt is in the log.

const box: React.CSSProperties = { border: "1px solid var(--forge-line)", background: "var(--forge-surface)", padding: "0.75rem", borderRadius: 2 };
const mono: React.CSSProperties = { fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: "0.8rem", whiteSpace: "pre-wrap", margin: 0 };
const meta: React.CSSProperties = { fontVariant: "small-caps", letterSpacing: "0.12em", color: "var(--forge-text-muted)", fontSize: "0.75rem" };

const sqlRun = (code: string, fn: string, cases: Parameters<typeof runPy>[2]) => runPy(code, fn, cases, 15000, { packages: ["sqlite3"] });

function ResultTable({ t }: { t: SqlTable }) {
  const rows = t.rows.slice(0, 20);
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ ...mono, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {t.cols.map((c, i) => (
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
      {t.rows.length > rows.length ? <p style={meta}>… y {t.rows.length - rows.length} filas más</p> : null}
    </div>
  );
}

function SqlRunnerBody({ item, cellId, readModel }: Omit<RunnerProps, "item"> & { item: ForgeItemOf<"sql"> }) {
  const { fire, passLesson } = useActions();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [grade, setGrade] = useState<SqlGrade | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const [needsDownload, setNeedsDownload] = useState(false);
  const goalId = readModel.modules.find((m) => m.id === cellId)?.goalId ?? null;
  const d = item.data;

  useEffect(() => {
    let alive = true;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      void pyodideCached().then((c) => alive && setNeedsDownload(c === false));
    }
    return () => {
      alive = false;
    };
  }, []);

  async function onRun() {
    setBusy(true);
    setLogError(null);
    try {
      const g = await gradeSqlQuery(d, query, sqlRun);
      setGrade(g);
      if (g.estado !== "calificada") return;
      try {
        await fire(
          "evidence.recorded",
          {
            itemId: item.itemId,
            type: "sql",
            phase: "respuesta",
            outcome: g.correcto ? "correcto" : "incorrecto",
            data: { consulta: query.slice(0, SQL_QUERY_MAX), fixtures: g.fixtures.map((f) => ({ nombre: f.nombre, correcto: f.correcto })) },
            source: "local",
          },
          { goalId, moduleId: cellId },
        );
      } catch {
        setLogError("No se pudo registrar el intento en tu dispositivo; vuelve a intentarlo.");
        return;
      }
      if (g.correcto) {
        setSolved(true);
        void passLesson({ goalId, moduleId: cellId }, 1);
      }
    } finally {
      setBusy(false);
    }
  }

  const failing = grade?.estado === "calificada" ? grade.fixtures.find((f) => !f.correcto && f.alumno) : undefined;

  return (
    <section aria-label={item.title} data-forge-runner="sql" style={{ display: "grid", gap: "0.75rem" }}>
      <header>
        <p style={meta}>sql · comprobado en tu dispositivo</p>
        <h3 style={{ margin: "0.25rem 0" }}>{item.title}</h3>
        <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{item.statement}</p>
      </header>
      <details open style={box}>
        <summary style={{ ...meta, display: "flex", alignItems: "center", minHeight: 44, cursor: "pointer" }}>esquema y datos base</summary>
        <pre style={mono}>{d.esquema}</pre>
        <pre style={{ ...mono, marginTop: "0.5rem" }}>{d.datos}</pre>
      </details>
      <p style={meta}>
        Se califica en {d.fixtures.length} escenario{d.fixtures.length === 1 ? "" : "s"}: {d.fixtures.map((f) => f.nombre).join(" · ")}.{" "}
        {d.orden ? "El orden de las filas cuenta." : "El orden de las filas no cuenta."} Dialecto SQLite; una sola consulta de lectura.
      </p>
      {needsDownload ? <p role="status">{PY_NEEDS_DOWNLOAD}</p> : null}
      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span style={meta}>tu consulta ({query.length.toLocaleString("en-US")} / {SQL_QUERY_MAX.toLocaleString("en-US")})</span>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value.slice(0, SQL_QUERY_MAX))}
          rows={8}
          spellCheck={false}
          aria-label="Consulta SQL"
          style={{ ...mono, ...box, color: "var(--forge-text)", minHeight: "8rem" }}
        />
      </label>
      <div>
        <button type="button" onClick={() => void onRun()} disabled={busy || !query.trim()} style={{ ...box, minHeight: 44, minWidth: 44, cursor: busy ? "wait" : "pointer", color: "var(--forge-text)" }}>
          {busy ? "Ejecutando…" : "Ejecutar y calificar ↗"}
        </button>
      </div>
      {grade?.estado === "rechazada" ? <p role="alert">✕ {grade.motivo}</p> : null}
      {grade?.estado === "sin-python" ? <p role="alert">✕ No se pudo cargar Python con SQLite: conéctate una vez para descargarlo (≈ 10 MB).</p> : null}
      {grade?.estado === "tiempo" ? <p role="alert">✕ La consulta tardó demasiado y se detuvo.</p> : null}
      {grade?.estado === "error-item" ? <p role="alert">✕ Este ítem está mal construido y no se puede calificar: {grade.motivo}</p> : null}
      {grade?.estado === "calificada" ? (
        <div role="status" style={{ ...box, borderStyle: grade.correcto ? "solid" : "dashed" }}>
          <p style={{ margin: 0 }}>{grade.correcto ? "✓ Correcta en todos los escenarios." : "✕ Incorrecta."}</p>
          <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.1rem" }}>
            {grade.fixtures.map((f) => (
              <li key={f.nombre}>
                {f.correcto ? "✓" : "✕"} {f.nombre}
                {f.motivo ? ` — ${f.motivo}` : ""}
              </li>
            ))}
          </ul>
          {failing?.alumno ? (
            <div style={{ marginTop: "0.5rem" }}>
              <p style={meta}>tu resultado en «{failing.nombre}»</p>
              <ResultTable t={failing.alumno} />
            </div>
          ) : null}
        </div>
      ) : null}
      {logError ? <p role="alert">✕ {logError}</p> : null}
      {solved ? (
        <details style={box}>
          <summary style={{ ...meta, display: "flex", alignItems: "center", minHeight: 44, cursor: "pointer" }}>consulta de referencia</summary>
          <pre style={mono}>{d.solucion}</pre>
        </details>
      ) : null}
    </section>
  );
}

export default function SqlRunner(props: RunnerProps) {
  if (props.item.type !== "sql") return <p role="status">Este ítem no es de tipo sql.</p>;
  return <SqlRunnerBody {...props} item={props.item} />;
}
