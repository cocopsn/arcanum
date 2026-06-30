"use client";

import type { ModeAvailability, DurationMode } from "@/lib/learning-modes";

// Nature-by-duration SELECTOR: the learner picks how much time they have and the cell switches
// its activity — heavy (the directed mission/gate loop), light (a 10-25 min lesson, Capa B),
// review (a 5-min recall of this cell). Unavailable modes are dimmed + non-interactive. The
// selection drives which flow the cell shows below (real state, not a label).

export function LearningModes({
  modes,
  active,
  onSelect,
  accent,
}: {
  modes: ModeAvailability;
  active: DurationMode;
  onSelect: (m: DurationMode) => void;
  accent: string;
}) {
  const items: { key: DurationMode; label: string; sub: string; on: boolean }[] = [
    { key: "heavy", label: "Misión grande", sub: "la tarde", on: modes.heavy },
    { key: "light", label: "Lección corta", sub: "el café", on: modes.light },
    {
      key: "review",
      label: "Repaso",
      sub: modes.review > 0 ? `${modes.review} vencido${modes.review === 1 ? "" : "s"}` : "5 min",
      on: true, // a quick recall of THIS cell is always available
    },
  ];
  return (
    <div className="rounded-[var(--r-sm)] border border-line bg-surface p-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-text-faint">¿Cuánto tiempo tienes?</div>
      <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="Modo de la celda por duración">
        {items.map((it) => {
          const isActive = active === it.key;
          return (
            <button
              key={it.key}
              type="button"
              disabled={!it.on}
              aria-pressed={isActive}
              onClick={() => it.on && onSelect(it.key)}
              className="min-h-11 rounded-[var(--r-sm)] border p-2 text-center transition disabled:cursor-not-allowed disabled:opacity-45"
              style={{
                borderColor: isActive ? accent : it.on ? "color-mix(in srgb, " + accent + " 30%, var(--line))" : "var(--line)",
                background: isActive ? "color-mix(in srgb, " + accent + " 14%, transparent)" : "transparent",
              }}
            >
              <div className="text-[11px] font-medium" style={{ color: isActive ? "var(--text)" : it.on ? "var(--text-muted)" : "var(--text-faint)" }}>
                {it.label}
                <span className="sr-only">{it.on ? (isActive ? " — seleccionado" : " — disponible") : " — no disponible aquí"}</span>
              </div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wider text-text-faint">{it.sub}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
