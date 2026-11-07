"use client";

import { useEffect, useMemo, useState } from "react";
import { useArcanum, useArcanumStore, useArcanumSync } from "@/app/providers";
import { makeEvent, type Json } from "@/core/event";
import { evidencePayloadError, type EvidenceRecordedPayload } from "@/core/evidence";
import { getDeviceId } from "@/lib/device";
import type { ForgeItemOf } from "@/forge/bank/registry";
import { CARDINALIDADES, ONTOLOGY_LIMITS, PROPIEDAD_TIPOS, parseOntologyModel, type OntologyModel } from "@/forge/bank/types/ontologia";
import { verifyOntology, type OntologyFinding } from "@/forge/eval/ontology";

// ONTOLOGY FORGE editor (design §9.3 l, §9.5). The learner models objects, links, actions and interfaces of the brief in
// a STRUCTURED LIST (keyboard accessible, the main editor) next to a read-only CANVAS of the same OntologyModel. The
// structural verifier (eval/ontology.ts) runs live over the model; «Entregar el modelo» stays disabled while there are
// findings. Each «Verificar» writes only { modeloSha10, hallazgos }; the full model enters the log ONCE, at delivery
// (phase "modelo"). The draft lives on the device (localStorage, ≤ 30 KB, never in the log nor synced). The author's
// reference is painted only when the delivery is IN THE LOG (derived from the read model, never from local state).

export type OntologyItem = ForgeItemOf<"ontologia">;

export const draftKey = (cellId: string, itemId: string) => `arcanum_forge_ontologia:${cellId}:${itemId}`;

const EMPTY: OntologyModel = { objetos: [], links: [], acciones: [], interfaces: [] };

function loadDraft(key: string): OntologyModel {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw || raw.length > ONTOLOGY_LIMITS.bytes) return EMPTY;
    const m = parseOntologyModel(JSON.parse(raw));
    return typeof m === "string" ? EMPTY : m;
  } catch {
    return EMPTY;
  }
}

function saveDraft(key: string, m: OntologyModel) {
  try {
    const raw = JSON.stringify(m);
    if (raw.length <= ONTOLOGY_LIMITS.bytes) window.localStorage.setItem(key, raw);
  } catch {
    // a full or blocked storage only loses the draft; nothing registered changes
  }
}

async function sha10(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 10);
}

function nextId(prefix: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  let n = 1;
  while (set.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

/** Write one evidence.recorded of this item; resolves with the event id, or throws when the write fails. */
export function useOntologyEvidence(cellId: string) {
  const store = useArcanumStore();
  const { syncNow } = useArcanumSync();
  return async (payload: EvidenceRecordedPayload): Promise<string> => {
    const err = evidencePayloadError(payload);
    if (err) throw new Error(err);
    const now = Date.now();
    const ev = makeEvent("evidence.recorded", payload as unknown as Json, { ts: now, deviceId: getDeviceId(), goalId: null, moduleId: cellId });
    await store.getState().dispatch(ev, now);
    syncNow();
    return ev.id;
  };
}

/** Id of the last delivered model of this item in the log (phase "modelo"), or null. */
export function useDeliveredModelId(cellId: string, itemId: string): string | null {
  return useArcanum((s) => {
    const list = s.readModel.evidence;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i]!;
      if (e.moduleId === cellId && e.itemId === itemId && e.type === "ontologia" && e.phase === "modelo") return e.id;
    }
    return null;
  });
}

const S = {
  panel: { border: "1px solid #494a4b", background: "#1e2124", color: "#ffffff", padding: "0.75rem", marginBottom: "0.75rem" },
  meta: { fontFamily: "ui-monospace, monospace", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#b9b9b9" },
  input: { background: "#0a0a0b", color: "#ffffff", border: "1px solid #494a4b", padding: "0.25rem 0.4rem", minHeight: 44, fontSize: 16 },
  btn: { background: "#2f3234", color: "#ffffff", border: "1px solid #9b9b9b", padding: "0.35rem 0.7rem", minHeight: 44, minWidth: 44, cursor: "pointer" },
  btnOff: { background: "#1e2124", color: "#767676", border: "1px dashed #636363", padding: "0.35rem 0.7rem", minHeight: 44, minWidth: 44, cursor: "not-allowed" },
};

interface EditorProps {
  item: OntologyItem;
  cellId: string;
  /** called with the id of the delivered evidence (phase "modelo") once it is in the log */
  onDelivered?: (eventId: string) => void;
  /** label of the delivery button (mission vs practice) */
  deliverLabel?: string;
  /** live count of open structural findings of the model being edited */
  onFindingsChange?: (n: number) => void;
}

export function OntologyEditor({ item, cellId, onDelivered, deliverLabel = "Entregar el modelo", onFindingsChange }: EditorProps) {
  const key = draftKey(cellId, item.itemId);
  const [model, setModel] = useState<OntologyModel>(() => loadDraft(key));
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const record = useOntologyEvidence(cellId);
  const deliveredId = useDeliveredModelId(cellId, item.itemId);
  const { decisiones, fuentes, exigencias } = item.data;
  const brief = useMemo(() => ({ decisiones, fuentes, exigencias }), [decisiones, fuentes, exigencias]);
  const findings = useMemo(() => verifyOntology(model, brief), [model, brief]);
  const tooBig = JSON.stringify(model).length > ONTOLOGY_LIMITS.bytes;

  useEffect(() => saveDraft(key, model), [key, model]);
  useEffect(() => onFindingsChange?.(findings.length + (model.objetos.length === 0 ? 1 : 0)), [findings.length, model.objetos.length, onFindingsChange]);

  const set = (f: (m: OntologyModel) => OntologyModel) => setModel((m) => f(structuredClone(m)));

  async function verificar() {
    setBusy(true);
    try {
      const hallazgos = verifyOntology(model, brief);
      await record({
        itemId: item.itemId,
        type: "ontologia",
        phase: "verificacion",
        outcome: hallazgos.length === 0 ? "correcto" : "incorrecto",
        data: { modeloSha10: await sha10(JSON.stringify(model)), hallazgos: hallazgos as unknown as Json },
        source: "local",
      });
      setStatus(hallazgos.length === 0 ? "Sin hallazgos estructurales. Puedes entregar el modelo." : `${hallazgos.length} hallazgo(s) estructural(es) registrados.`);
    } catch (e) {
      setStatus(`No se pudo registrar la verificación: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function entregar() {
    if (findings.length > 0 || tooBig) return;
    setBusy(true);
    try {
      const id = await record({
        itemId: item.itemId,
        type: "ontologia",
        phase: "modelo",
        outcome: "correcto",
        data: { modelo: model as unknown as Json, hallazgos: [] },
        source: "local",
      });
      setStatus("Modelo entregado y registrado en tu dispositivo.");
      onDelivered?.(id);
    } catch (e) {
      setStatus(`No se pudo registrar la entrega: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const focus = (id: string) => {
    const el = document.getElementById(`onto-${id}`);
    if (el) el.focus();
  };

  const canDeliver = findings.length === 0 && !tooBig && !busy && model.objetos.length > 0;

  return (
    <div data-forge-ontology="editor">
      <p style={S.meta}>↳ Comprobado en tu dispositivo · verificador estructural</p>
      <section style={S.panel} aria-label="Decisiones del brief">
        <p style={S.meta}>Decisiones del brief</p>
        <ul>
          {decisiones.map((d) => (
            <li key={d.id}>
              <code>{d.id}</code> · {d.texto}
            </li>
          ))}
        </ul>
        {fuentes && fuentes.length > 0 && (
          <>
            <p style={S.meta}>Fuentes sintéticas</p>
            <ul>
              {fuentes.map((f) => (
                <li key={f.id}>
                  <code>{f.id}</code> · {f.nombre}: {f.columnas.join(", ")}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <OntologyCanvas model={model} findings={findings} onPick={focus} />

      <ObjectsEditor model={model} set={set} decisiones={decisiones} fuentes={fuentes ?? []} />
      <LinksEditor model={model} set={set} />
      <ActionsEditor model={model} set={set} decisiones={decisiones} />
      <InterfacesEditor model={model} set={set} />

      <section style={S.panel} aria-label="Hallazgos estructurales" aria-live="polite">
        <p style={S.meta}>▼ Hallazgos estructurales · {findings.length}</p>
        {findings.length === 0 ? (
          <p>{model.objetos.length === 0 ? "Agrega al menos un objeto." : "Sin hallazgos estructurales."}</p>
        ) : (
          <ul>
            {findings.map((h, i) => (
              <li key={`${h.codigo}-${h.elemento}-${i}`}>
                <button type="button" onClick={() => focus(h.elemento)} style={{ ...S.btn, border: "1px dashed #9b9b9b", textAlign: "left" }}>
                  ✕ <code>{h.codigo}</code> · {h.mensaje}
                </button>
              </li>
            ))}
          </ul>
        )}
        {tooBig && <p>✕ El modelo pasa de 30 KB.</p>}
      </section>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" onClick={verificar} disabled={busy} style={busy ? S.btnOff : S.btn}>
          Verificar
        </button>
        <button type="button" onClick={entregar} disabled={!canDeliver} aria-disabled={!canDeliver} style={canDeliver ? S.btn : S.btnOff}>
          {deliverLabel}
        </button>
      </div>
      {status && <p role="status">{status}</p>}
      {deliveredId && <ReferenceView model={item.data.referencia} />}
    </div>
  );
}

function ReferenceView({ model }: { model: OntologyModel }) {
  return (
    <section style={S.panel} aria-label="Modelo de referencia del autor" data-forge-ontology="referencia">
      <p style={S.meta}>↗ Modelo de referencia del autor · una forma posible, no la única</p>
      <ul>
        {model.objetos.map((o) => (
          <li key={o.id}>
            ▣ {o.nombre} (llave {o.llave}): {o.propiedades.map((p) => p.nombre).join(", ")}
          </li>
        ))}
        {model.links.map((l) => (
          <li key={l.id}>
            → {l.nombre}: {l.de} {l.cardinalidad} {l.a}
          </li>
        ))}
        {model.acciones.map((a) => (
          <li key={a.id}>
            ↘ {a.nombre} sobre {a.objeto}; precondiciones: {a.precondiciones.join("; ")}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Read-only canvas of the model: objects as wireframe cubes, links as lines (dashed when N:N), actions as prisms. */
export function OntologyCanvas({ model, findings, onPick }: { model: OntologyModel; findings: OntologyFinding[]; onPick: (id: string) => void }) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(model.objetos.length)));
  const pos = new Map(model.objetos.map((o, i) => [o.id, { x: 90 + (i % cols) * 170, y: 70 + Math.floor(i / cols) * 130 }]));
  const w = Math.max(360, cols * 170 + 40);
  const h = Math.max(180, Math.ceil(model.objetos.length / cols) * 130 + 60);
  const flagged = new Set(findings.map((f) => f.elemento));
  return (
    <figure style={{ ...S.panel, overflowX: "auto" }} aria-label="Lienzo del modelo (sólo lectura)">
      <p style={S.meta}>Lienzo · sólo lectura · toca un elemento para editarlo</p>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={`${model.objetos.length} objetos, ${model.links.length} links, ${model.acciones.length} acciones`} style={{ maxHeight: 420, background: "#0a0a0b" }}>
        {model.links.map((l) => {
          const a = pos.get(l.de);
          const b = pos.get(l.a);
          if (!a || !b) return null;
          return (
            <g key={l.id} onClick={() => onPick(l.id)} style={{ cursor: "pointer" }}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={flagged.has(l.id) ? "#9b9b9b" : "#ffffff"} strokeWidth={1.2} strokeDasharray={l.cardinalidad === "N:N" ? "6 4" : l.cardinalidad === "1:1" ? undefined : "2 3"} />
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 6} fill="#b9b9b9" fontSize={10} textAnchor="middle" fontFamily="ui-monospace, monospace">
                {l.nombre} · {l.cardinalidad}
              </text>
            </g>
          );
        })}
        {model.objetos.map((o) => {
          const p = pos.get(o.id)!;
          const bad = flagged.has(o.id);
          const acts = model.acciones.filter((a) => a.objeto === o.id);
          return (
            <g key={o.id} onClick={() => onPick(o.id)} style={{ cursor: "pointer" }}>
              <polygon points={`${p.x},${p.y - 22} ${p.x + 20},${p.y - 11} ${p.x},${p.y} ${p.x - 20},${p.y - 11}`} fill="none" stroke="#ffffff" strokeWidth={1.2} strokeDasharray={bad ? "3 3" : undefined} />
              <polyline points={`${p.x - 20},${p.y - 11} ${p.x - 20},${p.y + 11} ${p.x},${p.y + 22} ${p.x + 20},${p.y + 11} ${p.x + 20},${p.y - 11}`} fill="none" stroke="#ffffff" strokeWidth={1.2} strokeDasharray={bad ? "3 3" : undefined} />
              <line x1={p.x} y1={p.y} x2={p.x} y2={p.y + 22} stroke="#ffffff" strokeWidth={1.2} />
              <text x={p.x} y={p.y + 40} fill="#ffffff" fontSize={12} textAnchor="middle">
                {bad ? "✕ " : ""}
                {o.nombre || o.id}
              </text>
              {acts.map((a, j) => (
                <text key={a.id} x={p.x} y={p.y + 54 + j * 12} fill="#9b9b9b" fontSize={10} textAnchor="middle" fontFamily="ui-monospace, monospace">
                  ↘ {a.nombre}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

type SetModel = (f: (m: OntologyModel) => OntologyModel) => void;

function JustificaPicker({ id, value, options, onChange }: { id: string; value: string[]; options: { id: string; texto: string }[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset>
      <legend style={S.meta}>Justifica (decisión o acción)</legend>
      {options.map((o) => (
        <label key={o.id} style={{ display: "inline-flex", gap: 4, marginRight: 12 }}>
          <input
            type="checkbox"
            name={`${id}-justifica`}
            checked={value.includes(o.id)}
            onChange={(e) => onChange(e.target.checked ? [...value, o.id] : value.filter((x) => x !== o.id))}
          />
          {o.texto}
        </label>
      ))}
    </fieldset>
  );
}

function ObjectsEditor({ model, set, decisiones, fuentes }: { model: OntologyModel; set: SetModel; decisiones: { id: string; texto: string }[]; fuentes: { id: string; nombre: string; columnas: string[] }[] }) {
  const justOptions = [...decisiones.map((d) => ({ id: d.id, texto: `${d.id} · ${d.texto}` })), ...model.acciones.map((a) => ({ id: a.id, texto: `acción ${a.nombre || a.id}` }))];
  return (
    <section style={S.panel} aria-label="Objetos">
      <p style={S.meta}>▣ Objetos · {model.objetos.length}</p>
      {model.objetos.map((o, oi) => (
        <fieldset key={o.id} style={{ borderTop: "1px solid #494a4b", padding: "0.5rem 0" }}>
          <legend style={S.meta}>Objeto {o.id}</legend>
          <label>
            Nombre{" "}
            <input id={`onto-${o.id}`} style={S.input} value={o.nombre} onChange={(e) => set((m) => ((m.objetos[oi]!.nombre = e.target.value), m))} />
          </label>{" "}
          <label>
            Llave{" "}
            <select style={S.input} value={o.llave} onChange={(e) => set((m) => ((m.objetos[oi]!.llave = e.target.value), m))}>
              <option value="">(sin llave)</option>
              {o.propiedades.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre || p.id}
                </option>
              ))}
            </select>
          </label>{" "}
          {fuentes.length > 0 && (
            <label>
              Fuente{" "}
              <select style={S.input} value={o.fuente ?? ""} onChange={(e) => set((m) => ((m.objetos[oi]!.fuente = e.target.value || undefined), m))}>
                <option value="">(ninguna)</option>
                {fuentes.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
          <JustificaPicker id={o.id} value={o.justifica} options={justOptions} onChange={(v) => set((m) => ((m.objetos[oi]!.justifica = v), m))} />
          {(model.interfaces ?? []).length > 0 && (
            <fieldset>
              <legend style={S.meta}>Implementa</legend>
              {(model.interfaces ?? []).map((itf) => (
                <label key={itf.id} style={{ marginRight: 12 }}>
                  <input
                    type="checkbox"
                    checked={(o.implementa ?? []).includes(itf.id)}
                    onChange={(e) =>
                      set((m) => {
                        const cur = m.objetos[oi]!.implementa ?? [];
                        m.objetos[oi]!.implementa = e.target.checked ? [...cur, itf.id] : cur.filter((x) => x !== itf.id);
                        return m;
                      })
                    }
                  />{" "}
                  {itf.nombre || itf.id}
                </label>
              ))}
            </fieldset>
          )}
          <p style={S.meta}>Propiedades</p>
          {o.propiedades.map((p, pi) => (
            <div key={p.id} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
              <input aria-label={`Nombre de la propiedad ${p.id}`} style={S.input} value={p.nombre} onChange={(e) => set((m) => ((m.objetos[oi]!.propiedades[pi]!.nombre = e.target.value), m))} />
              <select aria-label={`Tipo de la propiedad ${p.id}`} style={S.input} value={p.tipo} onChange={(e) => set((m) => ((m.objetos[oi]!.propiedades[pi]!.tipo = e.target.value as (typeof PROPIEDAD_TIPOS)[number]), m))}>
                {PROPIEDAD_TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <label>
                <input type="checkbox" checked={p.requerido} onChange={(e) => set((m) => ((m.objetos[oi]!.propiedades[pi]!.requerido = e.target.checked), m))} /> requerida
              </label>
              <button type="button" style={S.btn} onClick={() => set((m) => (m.objetos[oi]!.propiedades.splice(pi, 1), m))}>
                Quitar propiedad
              </button>
            </div>
          ))}
          <button
            type="button"
            style={S.btn}
            disabled={o.propiedades.length >= ONTOLOGY_LIMITS.propiedades}
            onClick={() => set((m) => (m.objetos[oi]!.propiedades.push({ id: nextId(`${o.id}-p`, o.propiedades.map((x) => x.id)), nombre: "", tipo: "texto", requerido: false }), m))}
          >
            Agregar propiedad
          </button>{" "}
          <button
            type="button"
            style={S.btn}
            onClick={() =>
              set((m) => {
                m.objetos.splice(oi, 1);
                return m;
              })
            }
          >
            Quitar objeto
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        style={S.btn}
        disabled={model.objetos.length >= ONTOLOGY_LIMITS.objetos}
        onClick={() => set((m) => (m.objetos.push({ id: nextId("o", m.objetos.map((x) => x.id)), nombre: "", llave: "", justifica: [], propiedades: [] }), m))}
      >
        Agregar objeto
      </button>
    </section>
  );
}

function ObjectSelect({ label, value, model, onChange }: { label: string; value: string; model: OntologyModel; onChange: (v: string) => void }) {
  return (
    <label>
      {label}{" "}
      <select style={S.input} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">(elige)</option>
        {model.objetos.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nombre || o.id}
          </option>
        ))}
      </select>
    </label>
  );
}

function LinksEditor({ model, set }: { model: OntologyModel; set: SetModel }) {
  return (
    <section style={S.panel} aria-label="Links">
      <p style={S.meta}>→ Links · {model.links.length}</p>
      {model.links.map((l, li) => (
        <div key={l.id} style={{ display: "flex", gap: 6, flexWrap: "wrap", borderTop: "1px solid #494a4b", padding: "0.4rem 0" }}>
          <label>
            Nombre <input id={`onto-${l.id}`} style={S.input} value={l.nombre} onChange={(e) => set((m) => ((m.links[li]!.nombre = e.target.value), m))} />
          </label>
          <ObjectSelect label="De" value={l.de} model={model} onChange={(v) => set((m) => ((m.links[li]!.de = v), m))} />
          <ObjectSelect label="A" value={l.a} model={model} onChange={(v) => set((m) => ((m.links[li]!.a = v), m))} />
          <label>
            Cardinalidad{" "}
            <select style={S.input} value={l.cardinalidad} onChange={(e) => set((m) => ((m.links[li]!.cardinalidad = e.target.value as (typeof CARDINALIDADES)[number]), m))}>
              {CARDINALIDADES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <button type="button" style={S.btn} onClick={() => set((m) => (m.links.splice(li, 1), m))}>
            Quitar link
          </button>
        </div>
      ))}
      <button
        type="button"
        style={S.btn}
        disabled={model.links.length >= ONTOLOGY_LIMITS.links}
        onClick={() => set((m) => (m.links.push({ id: nextId("l", m.links.map((x) => x.id)), nombre: "", de: "", a: "", cardinalidad: "N:1" }), m))}
      >
        Agregar link
      </button>
    </section>
  );
}

function ActionsEditor({ model, set, decisiones }: { model: OntologyModel; set: SetModel; decisiones: { id: string; texto: string }[] }) {
  const options = decisiones.map((d) => ({ id: d.id, texto: `${d.id} · ${d.texto}` }));
  return (
    <section style={S.panel} aria-label="Acciones">
      <p style={S.meta}>↘ Acciones · {model.acciones.length}</p>
      {model.acciones.map((a, ai) => (
        <fieldset key={a.id} style={{ borderTop: "1px solid #494a4b", padding: "0.5rem 0" }}>
          <legend style={S.meta}>Acción {a.id}</legend>
          <label>
            Nombre <input id={`onto-${a.id}`} style={S.input} value={a.nombre} onChange={(e) => set((m) => ((m.acciones[ai]!.nombre = e.target.value), m))} />
          </label>{" "}
          <ObjectSelect label="Objeto" value={a.objeto} model={model} onChange={(v) => set((m) => ((m.acciones[ai]!.objeto = v), m))} />
          <label style={{ display: "block" }}>
            Precondiciones (una por línea)
            <textarea style={{ ...S.input, width: "100%" }} rows={2} value={a.precondiciones.join("\n")} onChange={(e) => set((m) => ((m.acciones[ai]!.precondiciones = lines(e.target.value)), m))} />
          </label>
          <label style={{ display: "block" }}>
            Efectos (uno por línea)
            <textarea style={{ ...S.input, width: "100%" }} rows={2} value={a.efectos.join("\n")} onChange={(e) => set((m) => ((m.acciones[ai]!.efectos = lines(e.target.value)), m))} />
          </label>
          <JustificaPicker id={a.id} value={a.justifica} options={options} onChange={(v) => set((m) => ((m.acciones[ai]!.justifica = v), m))} />
          <p style={S.meta}>Parámetros</p>
          {a.parametros.map((p, pi) => (
            <div key={p.id} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
              <input aria-label={`Nombre del parámetro ${p.id}`} style={S.input} value={p.nombre} onChange={(e) => set((m) => ((m.acciones[ai]!.parametros[pi]!.nombre = e.target.value), m))} />
              <input aria-label={`Tipo del parámetro ${p.id}`} style={S.input} value={p.tipo} onChange={(e) => set((m) => ((m.acciones[ai]!.parametros[pi]!.tipo = e.target.value), m))} />
              <label>
                <input type="checkbox" checked={p.requerido} onChange={(e) => set((m) => ((m.acciones[ai]!.parametros[pi]!.requerido = e.target.checked), m))} /> requerido
              </label>
              <button type="button" style={S.btn} onClick={() => set((m) => (m.acciones[ai]!.parametros.splice(pi, 1), m))}>
                Quitar parámetro
              </button>
            </div>
          ))}
          <button type="button" style={S.btn} onClick={() => set((m) => (m.acciones[ai]!.parametros.push({ id: nextId(`${a.id}-p`, a.parametros.map((x) => x.id)), nombre: "", tipo: "texto", requerido: true }), m))}>
            Agregar parámetro
          </button>{" "}
          <button type="button" style={S.btn} onClick={() => set((m) => (m.acciones.splice(ai, 1), m))}>
            Quitar acción
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        style={S.btn}
        disabled={model.acciones.length >= ONTOLOGY_LIMITS.acciones}
        onClick={() => set((m) => (m.acciones.push({ id: nextId("a", m.acciones.map((x) => x.id)), nombre: "", objeto: "", precondiciones: [], efectos: [], justifica: [], parametros: [] }), m))}
      >
        Agregar acción
      </button>
    </section>
  );
}

function InterfacesEditor({ model, set }: { model: OntologyModel; set: SetModel }) {
  const itfs = model.interfaces ?? [];
  return (
    <section style={S.panel} aria-label="Interfaces">
      <p style={S.meta}>◇ Interfaces · {itfs.length}</p>
      {itfs.map((itf, ii) => (
        <fieldset key={itf.id} style={{ borderTop: "1px solid #494a4b", padding: "0.5rem 0" }}>
          <legend style={S.meta}>Interfaz {itf.id}</legend>
          <label>
            Nombre <input id={`onto-${itf.id}`} style={S.input} value={itf.nombre} onChange={(e) => set((m) => ((m.interfaces![ii]!.nombre = e.target.value), m))} />
          </label>
          {itf.propiedades.map((p, pi) => (
            <div key={pi} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              <input aria-label={`Propiedad ${pi + 1} de ${itf.id}`} style={S.input} value={p.nombre} onChange={(e) => set((m) => ((m.interfaces![ii]!.propiedades[pi]!.nombre = e.target.value), m))} />
              <select aria-label={`Tipo ${pi + 1} de ${itf.id}`} style={S.input} value={p.tipo} onChange={(e) => set((m) => ((m.interfaces![ii]!.propiedades[pi]!.tipo = e.target.value), m))}>
                {PROPIEDAD_TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button type="button" style={S.btn} onClick={() => set((m) => (m.interfaces![ii]!.propiedades.splice(pi, 1), m))}>
                Quitar
              </button>
            </div>
          ))}
          <button type="button" style={S.btn} onClick={() => set((m) => (m.interfaces![ii]!.propiedades.push({ nombre: "", tipo: "texto" }), m))}>
            Agregar propiedad
          </button>{" "}
          <button
            type="button"
            style={S.btn}
            onClick={() =>
              set((m) => {
                const id = m.interfaces![ii]!.id;
                m.interfaces!.splice(ii, 1);
                for (const o of m.objetos) if (o.implementa) o.implementa = o.implementa.filter((x) => x !== id);
                return m;
              })
            }
          >
            Quitar interfaz
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        style={S.btn}
        onClick={() =>
          set((m) => {
            m.interfaces = [...(m.interfaces ?? []), { id: nextId("i", (m.interfaces ?? []).map((x) => x.id)), nombre: "", propiedades: [] }];
            return m;
          })
        }
      >
        Agregar interfaz
      </button>
    </section>
  );
}
