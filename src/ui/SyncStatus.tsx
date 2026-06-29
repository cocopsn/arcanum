"use client";

/** Honest backup indicator. Cloud mirror activates on sign-in (spec §1.2/§7.2). */
export function SyncStatus() {
  return (
    <div
      className="flex items-center gap-1.5 text-[11px] tracking-wide text-text-faint"
      title="Tu bitácora vive en este dispositivo. El respaldo en la nube se activa al iniciar sesión."
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: "var(--topic)" }}
      />
      respaldo local
    </div>
  );
}
