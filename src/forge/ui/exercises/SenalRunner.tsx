"use client";

import { useMemo, useState } from "react";
import type { Json } from "@/core/event";
import { FORGE_GOAL_ID } from "@/core/forge-verdict";
import type { ForgeItemOf } from "@/forge/bank/registry";
import { gradeSenal, senalOrder, senalWords } from "@/forge/eval/signal";
import { useActions } from "@/ui/use-actions";
import type { RunnerProps } from "./registry";

// f · senal runner (§9.3 f). Neutral title «Set mixto»: it paints no code, title, route or labels that would give the
// pattern away. Per item: pick a pattern, tap the words of the signal, check. Each answer is local evidence
// (`evidence.recorded`, source "local"); it never opens anything.

export default function SenalRunner({ item, cellId, onClose }: RunnerProps) {
  const { fire } = useActions();
  const data = (item as ForgeItemOf<"senal">).data;
  const order = useMemo(() => senalOrder(data.items, data.semilla), [data]);
  const [i, setI] = useState(0);
  const [patron, setPatron] = useState<string | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const [aciertos, setAciertos] = useState(0);
  const cur = order[i];
  const words = useMemo(() => (cur ? senalWords(cur.enunciado) : []), [cur]);

  if (!cur) {
    return (
      <section data-forge-runner="senal" aria-label="Set mixto">
        <h2>Set mixto</h2>
        <p role="status">
          {aciertos} de {order.length} correctos.
        </p>
        <button type="button" onClick={onClose}>Cerrar</button>
      </section>
    );
  }

  const range = picked.length ? { start: Math.min(...picked.map((k) => words[k]!.start)), end: Math.max(...picked.map((k) => words[k]!.end)) } : null;

  async function comprobar() {
    if (!cur || !patron || !range) return;
    const ok = gradeSenal(cur, { patron, start: range.start, end: range.end });
    setVerdict(ok);
    if (ok) setAciertos((n) => n + 1);
    await fire(
      "evidence.recorded",
      { itemId: item.itemId, type: "senal", phase: `item-${i + 1}`, outcome: ok ? "correcto" : "incorrecto", source: "local", data: { patron, rango: [range.start, range.end] } } as unknown as Json,
      { goalId: FORGE_GOAL_ID, moduleId: cellId },
    );
  }

  function siguiente() {
    setI((n) => n + 1);
    setPatron(null);
    setPicked([]);
    setVerdict(null);
  }

  return (
    <section data-forge-runner="senal" aria-label="Set mixto">
      <h2>Set mixto</h2>
      <p className="font-mono text-xs uppercase tracking-[0.2em]">
        ↳ {i + 1} / {order.length}
      </p>
      <p data-senal-enunciado="">
        {words.map((w, k) => (
          <button
            key={k}
            type="button"
            aria-pressed={picked.includes(k)}
            disabled={verdict !== null}
            onClick={() => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))}
            style={{ textDecoration: picked.includes(k) ? "underline" : "none", background: "none", border: "none", color: "inherit", padding: "0 0.15em" }}
          >
            {w.word}
          </button>
        ))}
      </p>
      <fieldset disabled={verdict !== null}>
        <legend>Patrón</legend>
        {data.patrones.map((p) => (
          <label key={p} style={{ display: "block" }}>
            <input type="radio" name={`senal-${i}`} checked={patron === p} onChange={() => setPatron(p)} /> {p}
          </label>
        ))}
      </fieldset>
      {verdict === null ? (
        <button type="button" disabled={!patron || !range} onClick={() => void comprobar()}>
          Comprobar
        </button>
      ) : (
        <>
          <p role="status">{verdict ? "→ Correcto" : `✕ Incorrecto. Patrón: ${cur.patron}. Señal: «${cur.senal}».`}</p>
          <button type="button" onClick={siguiente}>Siguiente</button>
        </>
      )}
    </section>
  );
}
