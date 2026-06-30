"use client";

import type { ModeAvailability } from "@/lib/learning-modes";

// Nature-by-duration header: declares the THREE entry modes the learner can pick by the time
// they have — heavy (the directed mission), light (a 10-25 min lesson, Capa B), review (the
// decay queue, Capa C). Informational (the real affordances are the panels below + the map);
// it exists so there is ALWAYS something to do — never an empty screen. Existing tokens only.

export function LearningModes({ modes, accent }: { modes: ModeAvailability; accent: string }) {
  const items: { key: string; label: string; sub: string; on: boolean }[] = [
    { key: "heavy", label: "Misión grande", sub: "la tarde", on: modes.heavy },
    { key: "light", label: "Lección corta", sub: "el café", on: modes.light },
    {
      key: "review",
      label: "Repaso",
      sub: modes.review > 0 ? `${modes.review} vencido${modes.review === 1 ? "" : "s"}` : "al día",
      on: modes.review > 0,
    },
  ];
  return (
    <div className="rounded-[var(--r-sm)] border border-line bg-surface p-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-text-faint">¿Cuánto tiempo tienes?</div>
      <ul className="mt-2 grid grid-cols-3 gap-2">
        {items.map((it) => (
          <li
            key={it.key}
            className="rounded-[var(--r-sm)] border p-2 text-center"
            style={{ borderColor: it.on ? "color-mix(in srgb, " + accent + " 45%, var(--line))" : "var(--line)" }}
          >
            <div
              className="text-[11px] font-medium"
              style={{ color: it.on ? "var(--text)" : "var(--text-faint)" }}
            >
              {it.label}
              {/* non-color cue so the on/off state is announced, not only shown (WCAG 1.4.1) */}
              <span className="sr-only">{it.on ? " — disponible" : " — no disponible"}</span>
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-text-faint">{it.sub}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
