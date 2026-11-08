"use client";

import { useEffect, useMemo, useState } from "react";
import { useArcanum } from "@/app/providers";
import { formatValue, type Lang } from "@/lib/exercise";
import type { Json } from "@/core/event";
import { runJs } from "@/lib/js-runner";
import { pyodideStatus, runPy } from "@/lib/py-runner";
import { PY_UNAVAILABLE } from "./kit";
import type { RunnerProps } from "./registry";
import type { ForgeItemOf } from "@/forge/bank/registry";
import type { EvidenceRM } from "@/core/read-model";
import type { ForgeApoyo } from "@/forge/ai-port";
import { submitForgeVerdict } from "@/forge/ai-port";
import { FORGE_QUEUE_MOTIVOS } from "@/forge/ai";
import { RETENTION_INTERVAL_LABEL } from "@/forge/model/retention";
import {
  gradeRetentionCode,
  retentionStatus,
  RETENCION_CODIGO_MAX,
  RETENCION_RESPUESTA_MAX,
  type CodeGrade,
} from "@/forge/eval/retention-grade";
import { useActions } from "@/ui/use-actions";
import { area, box, btn, choice, isRecord, meta, mono, RunnerFrame, useEvidenceWriter, useItemEvidence } from "./kit";

// i · retencion runner (design §5.5). Two forms. Code: local verdict, runs the learner's function against the item's
// cases. Defensa: the AI judges it through the existing submitForgeVerdict path (honest queue without network). The
// item is graded only once the presenter says it is due (retentionStatus over the log; the clock is read once at
// mount, no timer). The solution (code) and the painted verdict (defensa) never appear before the log releases them.

const pyRun = (c: string, f: string, k: Parameters<typeof runPy>[2]) => runPy(c, f, k);

function CodigoBody({ item, cellId, readModel }: Omit<RunnerProps, "item"> & { item: ForgeItemOf<"retencion"> }) {
  const itemId = item.itemId;
  const d = item.data;
  if (d.forma !== "codigo") throw new Error("CodigoBody: no es forma codigo");
  const { record, guarded, logError } = useEvidenceWriter(cellId, readModel);
  const { passLesson: passLessonRaw } = useActions();
  const goalId = readModel.modules.find((m) => m.id === cellId)?.goalId ?? null;
  const passLesson = (score: number) => passLessonRaw({ goalId, moduleId: cellId }, score);
  const langs = Object.keys(d.firma) as Lang[];
  const [lang, setLang] = useState<Lang>(langs[0] ?? "js");
  const [code, setCode] = useState(d.firma[langs[0] ?? "js"] ?? "");
  const [busy, setBusy] = useState(false);
  const [grade, setGrade] = useState<CodeGrade | null>(null);
  const [needsDownload, setNeedsDownload] = useState(false);
  const resuelta = !!useItemEvidence(cellId, itemId, "retencion", "respuesta", "correcto");

  useEffect(() => {
    let alive = true;
    if (lang === "python" && typeof navigator !== "undefined" && navigator.onLine === false)
      void pyodideStatus().then((s) => alive && setNeedsDownload(s !== null && s.listos < s.total));
    else setNeedsDownload(false);
    return () => {
      alive = false;
    };
  }, [lang]);

  const ejecutar = guarded(async () => {
    setBusy(true);
    try {
      const g = await gradeRetentionCode(d, lang, code, lang === "python" ? pyRun : runJs);
      if (g.estado === "calificada") {
        await record({
          itemId,
          type: "retencion",
          phase: "respuesta",
          outcome: g.correcto ? "correcto" : "incorrecto",
          data: { forma: "codigo", lang, pasan: g.pasan, total: g.total } as unknown as Json,
          source: "local",
        });
        if (g.correcto) void passLesson(1);
      }
      setGrade(g);
    } finally {
      setBusy(false);
    }
  });

  return (
    <>
      {langs.length > 1 ? (
        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend style={meta}>lenguaje</legend>
          {langs.map((l) => (
            <label key={l} style={{ ...choice, marginRight: "0.75rem" }}>
              <input type="radio" name={`ret-lang-${itemId}`} checked={lang === l} onChange={() => (setLang(l), setCode(d.firma[l] ?? ""))} /> {l}
            </label>
          ))}
        </fieldset>
      ) : null}
      {needsDownload ? <p role="status">{PY_UNAVAILABLE}</p> : null}
      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span style={meta}>tu función · {code.length.toLocaleString("en-US")} / {RETENCION_CODIGO_MAX.toLocaleString("en-US")}</span>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value.slice(0, RETENCION_CODIGO_MAX))}
          rows={8}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          maxLength={RETENCION_CODIGO_MAX}
          aria-label="Tu función"
          style={area}
        />
      </label>
      <div>
        <button type="button" style={btn} onClick={() => void ejecutar()} disabled={busy || !code.trim()}>
          {busy ? "Ejecutando…" : "Ejecutar y calificar ↗"}
        </button>
      </div>
      {grade?.estado === "sin-python" ? <p role="alert">✕ {PY_UNAVAILABLE}</p> : null}
      {grade?.estado === "tiempo" ? <p role="alert">✕ Tu código tardó demasiado y se detuvo.</p> : null}
      {grade?.estado === "sintaxis" ? <p role="alert">✕ {grade.motivo}</p> : null}
      {grade?.estado === "calificada" ? (
        <div role="status" style={{ ...box, borderStyle: grade.correcto ? "solid" : "dashed" }}>
          <p style={{ margin: 0 }}>
            {grade.correcto
              ? `✓ Pasan ${grade.total} de ${grade.total} casos.`
              : `✕ Pasan ${grade.pasan} de ${grade.total} casos (falla: ${grade.primerFallo ? formatValue(grade.primerFallo.input) : "—"}).`}
          </p>
        </div>
      ) : null}
      {logError ? <p role="alert">✕ {logError}</p> : null}
      {resuelta ? (
        <div style={box}>
          <p style={meta}>solución</p>
          <pre style={mono}>{d.solucion[lang]}</pre>
        </div>
      ) : null}
    </>
  );
}

function DefensaBody({ item, cellCode, cellId, readModel }: Omit<RunnerProps, "item"> & { item: ForgeItemOf<"retencion"> }) {
  const itemId = item.itemId;
  const d = item.data;
  if (d.forma !== "defensa") throw new Error("DefensaBody: no es forma defensa");
  const [respuesta, setRespuesta] = useState("");
  const [apoyo, setApoyo] = useState<ForgeApoyo | null>(null);
  const [acunadoId, setAcunadoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const enCola = useArcanum((s) => s.readModel.pendingAi.some((p) => p.kind === "forge" && p.moduleId === cellId && isRecord(p.input) && (p.input as Record<string, unknown>).retencionItemId === itemId));
  const puedePedir = apoyo !== null && respuesta.trim().length > 0 && !enCola;

  const porId = useArcanum((s) => (acunadoId ? s.readModel.evidence.find((e) => e.id === acunadoId) ?? null : null));
  const ultimo = useItemEvidence(cellId, itemId, "retencion", "veredicto", undefined, "last");
  const v = acunadoId ? porId : ultimo;

  async function pedir() {
    if (apoyo === null) return;
    setError(null);
    setBusy(true);
    try {
      const r = await submitForgeVerdict({ cellCode, kind: "retencion", scope: "local", apoyo, retencionItemId: itemId, respuesta });
      if (r.estado === "acunado") setAcunadoId(r.eventId);
      else if (r.estado === "en-cola") setError(`en-cola:${r.motivo}`);
      else setError(`rechazado:${r.detalle ?? r.error}`);
    } finally {
      setBusy(false);
    }
  }

  const motivoEnCola = FORGE_QUEUE_MOTIVOS.offline;

  return (
    <>
      <div style={box}>
        <p style={meta}>rúbrica</p>
        <ul style={{ paddingLeft: "1.1rem", margin: 0 }}>
          {d.rubrica.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>
      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span style={meta}>tu respuesta · {respuesta.length.toLocaleString("en-US")} / {RETENCION_RESPUESTA_MAX.toLocaleString("en-US")}</span>
        <textarea
          value={respuesta}
          onChange={(e) => setRespuesta(e.target.value.slice(0, RETENCION_RESPUESTA_MAX))}
          rows={6}
          maxLength={RETENCION_RESPUESTA_MAX}
          aria-label="Tu respuesta"
          style={area}
        />
      </label>
      <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
        <legend style={meta}>apoyo</legend>
        <label style={{ ...choice, marginRight: "0.75rem" }}>
          <input type="radio" name={`ret-apoyo-${itemId}`} checked={apoyo === "independiente"} onChange={() => setApoyo("independiente")} /> Sin ayuda
        </label>
        <label style={choice}>
          <input type="radio" name={`ret-apoyo-${itemId}`} checked={apoyo === "con_apoyo"} onChange={() => setApoyo("con_apoyo")} /> Con apoyo
        </label>
      </fieldset>
      {enCola ? (
        <p role="status">En cola: {motivoEnCola}</p>
      ) : (
        <div>
          <button type="button" style={btn} onClick={() => void pedir()} disabled={!puedePedir || busy}>
            {busy ? "Enviando…" : "Pedir veredicto ↗"}
          </button>
        </div>
      )}
      {acunadoId && !porId ? <p role="status">Registrando el veredicto…</p> : null}
      {error?.startsWith("en-cola:") ? <p role="status">Tu respuesta quedó en cola: {error.slice("en-cola:".length)}. Se evalúa sola cuando haya conexión.</p> : null}
      {error?.startsWith("rechazado:") ? <p role="alert">No se pudo pedir el veredicto ({error.slice("rechazado:".length)}).</p> : null}
      {v ? <Veredicto v={v} /> : null}
    </>
  );
}

function Veredicto({ v }: { v: EvidenceRM }) {
  const truncado = isRecord(v.data) && v.data.truncated === true;
  const data = isRecord(v.data) ? v.data : {};
  return (
    <div role="status" style={{ ...box, borderStyle: v.outcome === "aprobado" ? "solid" : "dashed" }}>
      <p style={{ margin: 0 }}>{v.outcome === "aprobado" ? "✓ Retención aprobada." : "✕ No aprobada."}</p>
      {truncado ? (
        <p style={{ margin: "0.4rem 0 0" }}>El detalle es demasiado largo para mostrarlo aquí; quedó en el registro.</p>
      ) : (
        <>
          <p style={{ whiteSpace: "pre-wrap", margin: "0.4rem 0 0" }}>{String(data.summary ?? "")}</p>
          <p style={{ whiteSpace: "pre-wrap", margin: "0.4rem 0 0" }}>{String(data.feedback ?? "")}</p>
        </>
      )}
    </div>
  );
}

function RetencionBody(props: Omit<RunnerProps, "item"> & { item: ForgeItemOf<"retencion"> }) {
  const { item, cellId, onClose } = props;
  const it = item;
  const d = it.data;
  const rm = useArcanum((s) => s.readModel);
  const estado = useMemo(() => retentionStatus(rm, cellId, it, Date.now()), [rm, cellId, it]);
  const abierta = estado.estado === "vencida";
  const juez = d.forma === "codigo" ? "local" : "ia";

  const fecha = (ms: number) => new Date(ms).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

  return (
    <RunnerFrame tipo="retencion" itemId={it.itemId} title={item.title} statement={item.statement} juez={juez} extra={`${d.dias} días · ${RETENTION_INTERVAL_LABEL}`} onClose={onClose}>
      {estado.estado === "sin-agenda" ? <p role="status">Se agenda cuando esta celda tenga un veredicto aprobado e independiente.</p> : null}
      {estado.estado === "programada" ? (
        <p role="status">Disponible el {fecha(estado.dueMs)} ({d.dias} días después de tu primer veredicto independiente).</p>
      ) : null}
      {abierta && d.forma === "codigo" ? <CodigoBody {...props} item={it} /> : null}
      {abierta && d.forma === "defensa" ? <DefensaBody {...props} item={it} /> : null}
    </RunnerFrame>
  );
}

export default function RetencionRunner(props: RunnerProps) {
  if (props.item.type !== "retencion") return <p role="status">Este ítem no es de tipo retencion.</p>;
  return <RetencionBody {...props} item={props.item} />;
}
