"use client";

import { useArcanum } from "@/app/providers";

/** Honest backup indicator — reflects the true sync state, never faked. */
export function SyncStatus({ onOpen }: { onOpen: () => void }) {
  const syncState = useArcanum((s) => s.syncState);
  const pending = useArcanum((s) => s.pendingCount);

  const { dot, label, pulse } = describe(syncState, pending);

  return (
    <button
      onClick={onOpen}
      className="group flex items-center gap-1.5 text-[11px] tracking-wide text-text-faint transition hover:text-text-muted"
    >
      <span
        aria-hidden
        className={`inline-block h-1.5 w-1.5 rounded-full ${pulse ? "animate-pulse" : ""}`}
        style={{ background: dot }}
      />
      {label}
    </button>
  );
}

function describe(state: string, pending: number): { dot: string; label: string; pulse: boolean } {
  switch (state) {
    case "syncing":
      return { dot: "var(--rank)", label: "sincronizando…", pulse: true };
    case "error":
      return { dot: "var(--amber)", label: "error de sync", pulse: false };
    case "synced":
      return pending > 0
        ? { dot: "var(--amber)", label: `${pending} por subir`, pulse: false }
        : { dot: "var(--topic)", label: "respaldado", pulse: false };
    default: // local
      return { dot: "var(--text-faint)", label: "respaldo local", pulse: false };
  }
}
