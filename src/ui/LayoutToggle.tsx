"use client";

import { useLayoutMode } from "@/ui/layout-mode";
import { audio } from "@/lib/audio";

// The PWA/mobile ↔ Desktop switch. Sits in the top bar next to the sync/offline pills. Icon reflects the
// ACTIVE mode; clicking sets a persisted override.
export function LayoutToggle() {
  const { mode, setMode } = useLayoutMode();
  const desktop = mode === "desktop";
  return (
    <button
      onClick={() => {
        audio.cue("toggle"); // a switch, not a button — the tick says so
        setMode(desktop ? "pwa" : "desktop");
      }}
      aria-label={desktop ? "Cambiar a modo móvil" : "Cambiar a modo escritorio"}
      aria-pressed={desktop}
      title={desktop ? "Modo escritorio" : "Modo móvil / PWA"}
      className="grid min-h-9 min-w-9 place-items-center rounded-[var(--r-pill)] border border-line text-text-faint transition hover:text-text-muted"
    >
      {desktop ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="2.5" y="4" width="19" height="12.5" rx="1.5" />
          <path d="M8.5 20.5h7M12 16.5v4" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="6.5" y="2.5" width="11" height="19" rx="2.2" />
          <path d="M10.5 18.5h3" />
        </svg>
      )}
    </button>
  );
}
