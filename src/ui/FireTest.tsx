"use client";

import { useRef, useState } from "react";
import { useActions } from "@/ui/use-actions";

function RangeRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-xs text-text-muted">
        <span>{label}</span>
        <span className="tnum font-sans text-topic">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--topic)]"
      />
    </label>
  );
}

/** Blank challenge for calibration. Level is inferred from execution (spec §10.3). */
export function FireTest({
  goalId,
  moduleId,
  title,
}: {
  goalId: string;
  moduleId: string;
  title: string;
}) {
  const { submitFiretest } = useActions();
  const [ceiling, setCeiling] = useState(5);
  const [reached, setReached] = useState(2);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const r = Math.min(reached, ceiling);

  if (done) {
    return (
      <p className="text-sm text-text-muted">
        Prueba de fuego registrada. El nivel se infiere de tu ejecución, no de lo
        que digas saber.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="font-serif text-[15px] leading-snug text-text">
        Reto en blanco. Sin abrir un solo recurso, intenta{" "}
        <span className="text-topic">{title}</span> y llega tan lejos como puedas.
        Luego reporta honesto.
      </p>
      <RangeRow label="Hasta dónde llegué" value={r} min={0} max={ceiling} onChange={setReached} />
      <RangeRow
        label="Techo del reto"
        value={ceiling}
        min={1}
        max={10}
        onChange={(v) => {
          setCeiling(v);
          if (reached > v) setReached(v);
        }}
      />
      <button
        disabled={busy}
        onClick={async () => {
          // synchronous latch: `busy` (useState) lags a frame, so two fast taps could BOTH pass it and
          // fire two firetest.attempted events (double XP). Same guard the repo standardized in
          // Quiz/ExitGate/MissionPanel/LessonMode — audit finding F2.
          if (submitting.current) return;
          submitting.current = true;
          setBusy(true);
          await submitFiretest({ goalId, moduleId }, r, ceiling);
          setDone(true);
        }}
        className="min-h-11 w-full rounded-[var(--r-sm)] border border-topic bg-[var(--topic-deep)] px-4 py-2 text-sm tracking-wide text-topic transition hover:brightness-125 disabled:opacity-40"
      >
        Registrar prueba de fuego
      </button>
    </div>
  );
}
