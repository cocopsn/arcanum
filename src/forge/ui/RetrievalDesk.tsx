"use client";

import { useState } from "react";
import { useArcanum } from "@/app/providers";
import type { Json } from "@/core/event";
import type { ForgeItemOf } from "@/forge/bank/registry";
import { gradeRetrieval, RESPUESTA_MAX, segments, type RetrievalAnswer } from "@/forge/eval/retrieval";
import { useOntologyEvidence } from "@/forge/ui/OntologyEditor";

// RETRIEVAL DESK of `recuperacion` (design §9.3 o). The learner reads a synthetic corpus (some documents contradict each
// other, some are expired at the cut, one carries an injected instruction) and, per question, cites sentence spans or
// abstains, and writes a short answer. All answers go together; the grade is local and deterministic (eval/retrieval.ts).
// The KEY and the reasons are painted only when the answer is IN THE LOG (first evidence phase "respuesta").

export type RecuperacionItem = ForgeItemOf<"recuperacion">;

const S = {
  panel: { border: "1px solid #494a4b", background: "#1e2124", color: "#ffffff", padding: "0.75rem", marginBottom: "0.75rem" },
  meta: { fontFamily: "ui-monospace, monospace", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#b9b9b9" },
};

const empty = (): RetrievalAnswer => ({ abstenerse: false, spans: [], respuesta: "" });

function useFirstAnswers(cellId: string, itemId: string): Record<string, RetrievalAnswer> | null {
  return useArcanum((s) => {
    const e = s.readModel.evidence.find((x) => x.moduleId === cellId && x.itemId === itemId && x.type === "recuperacion" && x.phase === "respuesta");
    const d = e?.data as { respuestas?: Record<string, RetrievalAnswer> } | undefined;
    return d && d.respuestas && typeof d.respuestas === "object" ? d.respuestas : null;
  });
}

export function RetrievalDesk({ item, cellId }: { item: RecuperacionItem; cellId: string }) {
  const { corpus, preguntas, corte, clave } = item.data;
  const [ans, setAns] = useState<Record<string, RetrievalAnswer>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const record = useOntologyEvidence(cellId);
  const first = useFirstAnswers(cellId, item.itemId);
  const graded = first ? gradeRetrieval(item.data, first) : null;
  const get = (q: string) => ans[q] ?? empty();
  const put = (q: string, f: (a: RetrievalAnswer) => RetrievalAnswer) => setAns((x) => ({ ...x, [q]: f(x[q] ?? empty()) }));
  const ready = preguntas.every((q) => get(q.id).abstenerse || get(q.id).spans.length > 0);

  async function entregar() {
    if (!ready || first) return;
    setBusy(true);
    try {
      const respuestas = Object.fromEntries(preguntas.map((q) => [q.id, get(q.id)]));
      const g = gradeRetrieval(item.data, respuestas);
      await record({ itemId: item.itemId, type: "recuperacion", phase: "respuesta", outcome: g.correcto ? "correcto" : "incorrecto", data: { respuestas: respuestas as unknown as Json, aciertos: g.aciertos, total: g.total }, source: "local" });
    } catch (e) {
      setStatus(`No se pudo registrar tu respuesta: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const segs = corpus.map((d) => ({ d, s: segments(d.texto) }));
  return (
    <div data-forge-recuperacion="mesa">
      <p style={S.meta}>↳ Comprobado en tu dispositivo · fecha de corte {corte.slice(0, 10)}</p>
      <section style={S.panel} aria-label="Corpus">
        <p style={S.meta}>Corpus sintético · {corpus.length} documentos</p>
        {corpus.map((d) => (
          <article key={d.id} style={{ borderTop: "1px solid #494a4b", padding: "0.4rem 0" }}>
            <p style={S.meta}>
              {d.id} · {d.titulo} · {d.fecha}
              {d.vigente_hasta ? ` · vigente hasta ${d.vigente_hasta}` : ""}
            </p>
            <p>{d.texto}</p>
          </article>
        ))}
      </section>
      {preguntas.map((q) => {
        const a = first ? first[q.id] ?? empty() : get(q.id);
        const g = graded?.porPregunta.find((p) => p.id === q.id);
        const k = clave[q.id];
        return (
          <section key={q.id} style={S.panel} aria-label={`Pregunta ${q.id}`}>
            <p>
              <strong>{q.pregunta}</strong>
            </p>
            <label>
              <input type="checkbox" disabled={!!first} checked={a.abstenerse} onChange={(e) => put(q.id, (x) => ({ ...x, abstenerse: e.target.checked, spans: e.target.checked ? [] : x.spans }))} /> Me abstengo: el corpus no la responde
            </label>
            {!a.abstenerse && (
              <fieldset>
                <legend style={S.meta}>Cita los tramos que la respaldan</legend>
                {segs.map(({ d, s }) =>
                  s.map((seg, i) => {
                    const on = a.spans.some((x) => x.doc === d.id && x.inicio === seg.inicio && x.fin === seg.fin);
                    return (
                      <label key={`${d.id}-${i}`} style={{ display: "block" }}>
                        <input
                          type="checkbox"
                          disabled={!!first}
                          checked={on}
                          onChange={(e) =>
                            put(q.id, (x) => ({
                              ...x,
                              spans: e.target.checked ? [...x.spans, { doc: d.id, inicio: seg.inicio, fin: seg.fin }] : x.spans.filter((y) => !(y.doc === d.id && y.inicio === seg.inicio && y.fin === seg.fin)),
                            }))
                          }
                        />{" "}
                        {d.id} · {seg.texto}
                      </label>
                    );
                  }),
                )}
              </fieldset>
            )}
            <label style={{ display: "block" }}>
              Respuesta corta
              <textarea
                aria-label={`Respuesta a ${q.id}`}
                disabled={!!first}
                maxLength={RESPUESTA_MAX}
                rows={2}
                style={{ width: "100%", background: "#0a0a0b", color: "#ffffff", border: "1px solid #494a4b" }}
                value={a.respuesta}
                onChange={(e) => put(q.id, (x) => ({ ...x, respuesta: e.target.value.slice(0, RESPUESTA_MAX) }))}
              />
            </label>
            {g && (
              <div data-forge-recuperacion="resultado" style={{ border: g.ok ? "1px solid #9b9b9b" : "1px dashed #9b9b9b", padding: "0.25rem 0.5rem" }}>
                <p>
                  {g.ok ? "✓" : "✕"} {g.motivo}
                </p>
                <p style={S.meta}>
                  Clave:{" "}
                  {!k
                    ? "sin clave"
                    : "abstenerse" in k
                      ? "abstenerse"
                      : k.spans.map((s) => `${s.doc} «${corpus.find((d) => d.id === s.doc)?.texto.slice(s.inicio, s.fin) ?? ""}»`).join(" · ")}
                </p>
              </div>
            )}
          </section>
        );
      })}
      {!first && (
        <button type="button" onClick={entregar} disabled={!ready || busy} aria-disabled={!ready || busy}>
          Entregar respuestas
        </button>
      )}
      {graded && <p role="status">{graded.correcto ? "✓ Todas correctas" : `✕ ${graded.aciertos} de ${graded.total} correctas`}</p>}
      {status && <p role="status">{status}</p>}
    </div>
  );
}
