"use client";

import { useRef, useState } from "react";
import { useArcanum } from "@/app/providers";
import { formatValue, type Lang } from "@/lib/exercise";
import { runJs } from "@/lib/js-runner";
import { runPy } from "@/lib/py-runner";
import type { RunnerProps } from "./registry";
import type { ForgeItemOf } from "@/forge/bank/registry";
import type { EvidenceRM } from "@/core/read-model";
import {
  autoOkFor,
  currentLevel,
  gradeFadedCode,
  HUECO_MAX,
  HUECO_PROSA_MAX,
  huecoCabe,
  levelHoles,
  templateSegments,
} from "@/forge/eval/faded";
import { useActions } from "@/ui/use-actions";
import { area, box, btn, meta, mono, RunnerFrame, useEvidenceWriter } from "./kit";

// b · desvanecido runner (design §5.3). Levels of CODE are judged locally; a level with PROSE is self-verified
// (source "self"), gives no XP and does not satisfy remediation. The current level comes ONLY from the log
// (currentLevel): never from time or attempts. A hidden region's reference code is painted only inside a «fijo»
// segment of templateSegments over the CURRENT level's holes (CA-E7). Nothing of this type imports the AI path.

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

function DesvanecidoBody({ item, cellId, readModel, onClose }: Omit<RunnerProps, "item"> & { item: ForgeItemOf<"desvanecido"> }) {
  const itemId = item.itemId;
  const d = item.data;
  const lang: Lang = d.lang ?? "js";
  const pyRun = (c: string, f: string, k: Parameters<typeof runPy>[2]) => runPy(c, f, k);
  const { record, guarded, logError } = useEvidenceWriter(cellId, readModel);

  const nivel = useArcanum((s) => currentLevel(s.readModel.evidence, cellId, itemId));
  const evidence = useArcanum((s) => s.readModel.evidence);
  const hidden = new Set(levelHoles(d, nivel).codigo);
  const holes = levelHoles(d, nivel);
  const hayProsa = holes.prosa.length > 0;
  const hayCodigo = holes.codigo.length > 0;

  const [fills, setFills] = useState<Record<number, string>>({});
  const [prosa, setProsa] = useState<Record<number, string>>({});
  const [marcados, setMarcados] = useState<number[]>([]);
  // codeOk lives in a ref (lost on reload/level change, as the design requires) so a later
  // «Confirmar autoverificación» reads the last graded code of this level without a stale closure.
  const codeOkRef = useRef<{ nivel: number; ok: boolean } | null>(null);
  const setCodeOk = (v: { nivel: number; ok: boolean } | null) => {
    codeOkRef.current = v;
  };
  const [resultado, setResultado] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { passLesson: passLessonRaw } = useActions();
  const goalId = readModel.modules.find((m) => m.id === cellId)?.goalId ?? null;
  const passLesson = (score: number) => passLessonRaw({ goalId, moduleId: cellId }, score);

  const completado = nivel > d.niveles.length;
  const segments = d.plantilla ? templateSegments(d.plantilla.code, lang, hidden) : [];

  /** There is a live `hueco` evidence of this item and cell with data.nivel === nivel and data.paso === n. */
  const huecoHecho = (n: number): boolean =>
    evidence.some((e: EvidenceRM) => e.moduleId === cellId && e.itemId === itemId && e.type === "desvanecido" && e.phase === "hueco" && isRecord(e.data) && e.data.nivel === nivel && e.data.paso === n);
  const respuestaDe = (n: number): string => {
    const e = evidence.find((x: EvidenceRM) => x.moduleId === cellId && x.itemId === itemId && x.type === "desvanecido" && x.phase === "hueco" && isRecord(x.data) && x.data.nivel === nivel && x.data.paso === n);
    if (e && isRecord(e.data) && typeof e.data.respuesta === "string") return e.data.respuesta;
    return "Tu respuesta quedó en el registro.";
  };

  const prosaPendiente = holes.prosa.filter((n) => !huecoHecho(n));
  const puedeComprobar = holes.codigo.every((n) => (fills[n] ?? "").trim().length > 0)
    && prosaPendiente.every((n) => (prosa[n] ?? "").trim().length > 0 && huecoCabe({ nivel, paso: n, respuesta: prosa[n]! }));
  const puedeAutoverificar = hayProsa && prosaPendiente.length === 0;

  async function tryPassLevel(codeNow: boolean, autoNow: boolean) {
    if (!((!hayCodigo || codeNow) && (!hayProsa || autoNow))) return;
    await record({ itemId, type: "desvanecido", phase: "nivel", outcome: "correcto", data: { nivel }, source: hayProsa ? "self" : "local" });
    if (!hayProsa) void passLesson(1);
    setResultado(`✓ Nivel ${nivel} superado.`);
  }

  const comprobar = guarded(async () => {
    setResultado(null);
    // (1) register every pending prose hole (source "self"), which releases its model text and rubric
    for (const n of holes.prosa) {
      if (huecoHecho(n)) continue;
      await record({ itemId, type: "desvanecido", phase: "hueco", outcome: "registrado", data: { nivel, paso: n, respuesta: prosa[n] ?? "" }, source: "self" });
    }
    // (2) grade the code holes, if any
    if (hayCodigo) {
      setBusy(true);
      try {
        const g = await gradeFadedCode(d, fills, lang === "python" ? pyRun : runJs);
        if (g.estado === "sin-python") {
          setResultado("✕ No se pudo cargar Python: conéctate una vez para descargarlo.");
          return;
        }
        if (g.estado === "tiempo") {
          setResultado("✕ Tu código tardó demasiado y se detuvo.");
          return;
        }
        if (g.estado === "sintaxis") {
          setResultado(`✕ ${g.motivo}`);
          return;
        }
        const correcto = g.correcto;
        await record({ itemId, type: "desvanecido", phase: "codigo", outcome: hayProsa ? "registrado" : correcto ? "correcto" : "incorrecto", data: { nivel, pasos: holes.codigo, pasan: g.pasan, total: g.total, correcto }, source: "local" });
        setCodeOk({ nivel, ok: correcto });
        if (!correcto) {
          setResultado(`✕ Pasan ${g.pasan} de ${g.total} casos (falla: ${g.primerFallo ? formatValue(g.primerFallo.input) : "—"}).`);
        } else if (hayProsa) {
          setResultado("Código correcto: confirma tu autoverificación.");
        }
        await tryPassLevel(correcto, autoOkFor(evidence, cellId, itemId, nivel));
      } finally {
        setBusy(false);
      }
    } else {
      await tryPassLevel(true, autoOkFor(evidence, cellId, itemId, nivel));
    }
  });

  const confirmarAuto = guarded(async () => {
    setResultado(null);
    const todas = marcados.length === d.rubrica.length && d.rubrica.length > 0;
    await record({ itemId, type: "desvanecido", phase: "autoverificacion", outcome: todas ? "correcto" : "incorrecto", data: { nivel, marcados }, source: "self" });
    const live = codeOkRef.current;
    const codeNow = live !== null && live.nivel === nivel && live.ok;
    await tryPassLevel(codeNow, todas);
    if (!resultado?.startsWith("✓")) {
      if (!todas) setResultado(`✕ Nivel ${nivel} sin superar: te faltan criterios por cumplir.`);
      else if (!codeNow) setResultado(`✕ Nivel ${nivel} sin superar: vuelve a comprobar el código de este nivel.`);
    }
  });

  const toggleMarca = (i: number) => setMarcados((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));

  return (
    <RunnerFrame tipo="desvanecido" itemId={itemId} title={item.title} statement={item.statement} juez={hayProsa ? "self" : "local"} onClose={onClose}>
      <p style={meta}>{completado ? `Completado: los ${d.niveles.length} niveles.` : `Nivel ${nivel} de ${d.niveles.length}`}</p>

      <ol style={{ ...mono, paddingLeft: "1.2rem" }}>
        {d.pasos.map((texto, i) => {
          const n = i + 1;
          const ocultoCod = holes.codigo.includes(n);
          const ocultoProsa = holes.prosa.includes(n);
          if (ocultoCod || ocultoProsa) return <li key={n}>Paso {n} · oculto</li>;
          return <li key={n}>{texto}</li>;
        })}
      </ol>

      {d.plantilla ? (
        <div style={box}>
          <p style={meta}>plantilla</p>
          {segments.map((s, i) =>
            s.kind === "fijo" ? (
              <pre key={`f-${i}`} style={mono}>{s.text}</pre>
            ) : (
              <label key={`h-${s.paso}`} style={{ display: "grid", gap: "0.25rem", margin: "0.4rem 0" }}>
                <span style={meta}>paso {s.paso} (código)</span>
                <textarea
                  value={fills[s.paso] ?? ""}
                  onChange={(e) => setFills((p) => ({ ...p, [s.paso]: e.target.value.slice(0, HUECO_MAX) }))}
                  rows={3}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  maxLength={HUECO_MAX}
                  aria-label={`Paso ${s.paso} (código)`}
                  style={area}
                />
              </label>
            ),
          )}
        </div>
      ) : null}

      {holes.prosa.map((n) => (
        <div key={`prosa-${n}`} style={box}>
          <p style={{ margin: 0 }}>Escribe con tus palabras el paso {n}: qué afirma y por qué vale.</p>
          {huecoHecho(n) ? <p data-respuesta={n} style={mono}>{respuestaDe(n)}</p> : null}
          {!huecoHecho(n) ? (
            <>
              <textarea
                value={prosa[n] ?? ""}
                onChange={(e) => setProsa((p) => ({ ...p, [n]: e.target.value.slice(0, HUECO_PROSA_MAX) }))}
                rows={3}
                spellCheck={false}
                maxLength={HUECO_PROSA_MAX}
                aria-label={`Paso ${n} (en prosa)`}
                style={area}
              />
              {!huecoCabe({ nivel, paso: n, respuesta: prosa[n] ?? "" }) ? (
                <p role="status">Tu respuesta es demasiado larga para guardarla: recórtala o quita saltos de línea.</p>
              ) : null}
            </>
          ) : null}
          {huecoHecho(n) ? <p data-modelo={n} style={mono}>{d.pasos[n - 1]}</p> : null}
          {huecoHecho(n) ? (
            <fieldset style={{ border: "none", padding: 0, margin: "0.4rem 0 0" }}>
              <legend style={meta}>Marca cada criterio que tu respuesta cumple</legend>
              {d.rubrica.map((r, i) => (
                <label key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", minHeight: 44 }}>
                  <input type="checkbox" checked={marcados.includes(i)} onChange={() => toggleMarca(i)} /> {r}
                </label>
              ))}
            </fieldset>
          ) : null}
        </div>
      ))}

      {!completado ? (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" style={btn} onClick={() => void comprobar()} disabled={!puedeComprobar || busy}>
            {busy ? "Comprobando…" : "Comprobar nivel ↗"}
          </button>
          {hayProsa ? (
            <button type="button" style={btn} onClick={() => void confirmarAuto()} disabled={!puedeAutoverificar}>
              Confirmar autoverificación
            </button>
          ) : null}
        </div>
      ) : null}

      {resultado ? <p role="status">{resultado}</p> : null}
      {logError ? <p role="alert">✕ {logError}</p> : null}
    </RunnerFrame>
  );
}

export default function DesvanecidoRunner(props: RunnerProps) {
  if (props.item.type !== "desvanecido") return <p role="status">Este ítem no es de tipo desvanecido.</p>;
  return <DesvanecidoBody {...props} item={props.item} />;
}
