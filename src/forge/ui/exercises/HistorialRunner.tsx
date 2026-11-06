"use client";

import { useMemo, useState } from "react";
import type { RunnerProps } from "./registry";
import type { ForgeItemOf } from "@/forge/bank/registry";
import { PENDING_TEXT } from "@/forge/ui/flow-contract";
import { gradeTraza, stepId, type TrazaData, type TrazaGrade } from "@/forge/eval/history-sim";
import { useActions } from "@/ui/use-actions";

// c · historial runner (design §9.3 c, §9.5). Modo traza: with `violar` the learner builds a history by tapping the
// actors' steps in order and the simulator runs it; with `proteger` the learner picks a protocol and the app shows the
// exhaustive enumeration («seguro» or the history that breaks it). The grade comes ONLY from the simulator (no claim
// of the learner reaches it), is local («Comprobado en tu dispositivo») and is recorded as evidence.recorded with
// source "local"; passLesson(1) when correct. Modo fallas is not gradable in this version: honest pending text.

const box: React.CSSProperties = { border: "1px solid var(--forge-line)", background: "var(--forge-surface)", padding: "0.75rem", borderRadius: 2 };
const mono: React.CSSProperties = { fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: "0.8rem", whiteSpace: "pre-wrap", margin: 0 };
const meta: React.CSSProperties = { fontVariant: "small-caps", letterSpacing: "0.12em", color: "var(--forge-text-muted)", fontSize: "0.75rem" };
const btn: React.CSSProperties = { ...box, padding: "0.35rem 0.6rem", color: "var(--forge-text)", cursor: "pointer" };

const fmtState = (s: Record<string, number>) => Object.entries(s).map(([k, v]) => `${k}=${v}`).join(" · ");

function TrazaBody({ item, cellId, readModel, d }: Omit<RunnerProps, "item"> & { item: ForgeItemOf<"historial">; d: TrazaData }) {
  const { fire, passLesson } = useActions();
  const goalId = readModel.modules.find((m) => m.id === cellId)?.goalId ?? null;
  const [hist, setHist] = useState<string[]>([]);
  const [proto, setProto] = useState<string>("");
  const [grade, setGrade] = useState<TrazaGrade | null>(null);
  const [recorded, setRecorded] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const actors = Object.keys(d.actores);
  const total = actors.reduce((n, a) => n + d.actores[a]!.length, 0);
  const nextOf = (a: string) => hist.filter((h) => h.startsWith(a) && /^\d+$/.test(h.slice(a.length))).length;
  const others = useMemo(
    () => (recorded && d.objetivo === "proteger" && d.protocolos ? Object.keys(d.protocolos).map((p) => [p, gradeTraza(d, { protocolo: p })] as const) : []),
    [recorded, d],
  );

  async function submit() {
    setLogError(null);
    const g = d.objetivo === "violar" ? gradeTraza(d, { historia: hist }) : gradeTraza(d, { protocolo: proto });
    setGrade(g);
    if (g.estado === "invalida") return;
    try {
      await fire(
        "evidence.recorded",
        {
          itemId: item.itemId,
          type: "historial",
          phase: "respuesta",
          outcome: g.correcto ? "correcto" : "incorrecto",
          data: d.objetivo === "violar" ? { modo: "traza", objetivo: "violar", historia: hist } : { modo: "traza", objetivo: "proteger", protocolo: proto },
          source: "local",
        },
        { goalId, moduleId: cellId },
      );
    } catch {
      setLogError("No se pudo registrar el intento en tu dispositivo; vuelve a intentarlo.");
      return;
    }
    setRecorded(true);
    if (g.correcto) void passLesson({ goalId, moduleId: cellId }, 1);
  }

  return (
    <section aria-label={item.title} data-forge-runner="historial" style={{ display: "grid", gap: "0.75rem" }}>
      <header>
        <p style={meta}>historial · {d.objetivo} · comprobado en tu dispositivo</p>
        <h3 style={{ margin: "0.25rem 0" }}>{item.title}</h3>
        <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{item.statement}</p>
      </header>
      <div style={box}>
        <p style={meta}>estado inicial</p>
        <p style={mono}>{fmtState(d.estado)}</p>
        <p style={{ ...meta, marginTop: "0.5rem" }}>invariante ({d.chequeo === "final" ? "se revisa al final" : "se revisa tras cada paso"})</p>
        <p style={mono}>{d.invariante}</p>
      </div>
      {d.objetivo === "violar" ? (
        <>
          <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: `repeat(${actors.length}, minmax(0, 1fr))` }}>
            {actors.map((a) => {
              const n = nextOf(a);
              return (
                <div key={a} style={box}>
                  <p style={meta}>actor {a}</p>
                  <ol style={{ ...mono, paddingLeft: "1.2rem" }}>
                    {d.actores[a]!.map((s, i) => (
                      <li key={i} style={{ opacity: i < n ? 0.5 : 1 }}>
                        {stepId(a, i)} · {s}
                      </li>
                    ))}
                  </ol>
                  {n < d.actores[a]!.length ? (
                    <button type="button" style={{ ...btn, marginTop: "0.5rem" }} onClick={() => setHist([...hist, stepId(a, n)])} disabled={recorded}>
                      → {stepId(a, n)}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
          <p style={mono} aria-label="Historia">
            {hist.length ? hist.join(" → ") : "Toca los pasos en el orden en que ocurren."}
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button type="button" style={btn} onClick={() => setHist(hist.slice(0, -1))} disabled={!hist.length || recorded}>
              Deshacer
            </button>
            <button type="button" style={btn} onClick={() => (setHist([]), setGrade(null), setRecorded(false))}>
              Reiniciar
            </button>
            <button type="button" style={btn} onClick={() => void submit()} disabled={hist.length !== total || recorded}>
              Ejecutar historia ↗
            </button>
          </div>
        </>
      ) : (
        <>
          <fieldset style={{ ...box, display: "grid", gap: "0.5rem" }}>
            <legend style={meta}>protocolos</legend>
            {Object.entries(d.protocolos ?? {}).map(([p, acts]) => (
              <label key={p} style={{ display: "grid", gap: "0.25rem" }}>
                <span>
                  <input type="radio" name={`proto-${item.itemId}`} value={p} checked={proto === p} onChange={() => setProto(p)} disabled={recorded} /> {p}
                </span>
                <span style={mono}>
                  {Object.entries(acts)
                    .map(([a, steps]) => `${a}: ${steps.join(" · ")}`)
                    .join("\n")}
                </span>
              </label>
            ))}
          </fieldset>
          <div>
            <button type="button" style={btn} onClick={() => void submit()} disabled={!proto || recorded}>
              Elegir y comprobar ↗
            </button>
          </div>
        </>
      )}
      {grade?.estado === "invalida" ? <p role="alert">✕ {grade.motivo}</p> : null}
      {grade?.estado === "violar" ? (
        <div role="status" style={{ ...box, borderStyle: grade.correcto ? "solid" : "dashed" }}>
          <p style={{ margin: 0 }}>{grade.correcto ? "✓ Esta historia viola el invariante." : "✕ Esta historia no viola el invariante."}</p>
          <table style={{ ...mono, borderCollapse: "collapse", marginTop: "0.5rem" }}>
            <tbody>
              {grade.sim.traza.map((t) => (
                <tr key={t.paso}>
                  <td style={{ padding: "0.1rem 0.5rem" }}>{t.paso}</td>
                  <td style={{ padding: "0.1rem 0.5rem" }}>{t.texto}</td>
                  <td style={{ padding: "0.1rem 0.5rem" }}>{fmtState(t.estado)}</td>
                  <td style={{ padding: "0.1rem 0.5rem" }}>{t.nota ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {grade?.estado === "proteger" ? (
        <div role="status" style={{ ...box, borderStyle: grade.correcto ? "solid" : "dashed" }}>
          <p style={{ margin: 0 }}>
            {grade.correcto
              ? `✓ «${grade.protocolo}» no viola el invariante en ninguna intercalación posible.`
              : `✕ «${grade.protocolo}» se rompe${"historia" in grade.resultado ? ` con ${grade.resultado.historia.join(" → ")}` : ""}.`}
          </p>
          {others.length ? (
            <ul style={{ ...mono, marginTop: "0.5rem", paddingLeft: "1.1rem" }}>
              {others.map(([p, g]) => (
                <li key={p}>
                  {p}: {g.estado === "proteger" ? (g.correcto ? `seguro (${"intercalaciones" in g.resultado ? g.resultado.intercalaciones : 0} intercalaciones)` : `se rompe con ${"historia" in g.resultado ? g.resultado.historia.join(" → ") : "?"}`) : g.estado === "invalida" ? g.motivo : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {logError ? <p role="alert">✕ {logError}</p> : null}
    </section>
  );
}

export default function HistorialRunner(props: RunnerProps) {
  const item = props.item;
  if (item.type !== "historial") return <p role="status">Este ítem no es de tipo historial.</p>;
  const d = item.data;
  if (d.modo !== "traza") {
    return (
      <p role="status" data-forge-pending="historial-fallas" data-item={item.itemId}>
        {PENDING_TEXT}
      </p>
    );
  }
  return <TrazaBody {...props} item={item} d={d} />;
}
