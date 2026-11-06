"use client";

import type { RunnerProps } from "./registry";
import { RetrievalDesk, type RecuperacionItem } from "@/forge/ui/RetrievalDesk";

// PRACTICE runner of `recuperacion` (design §9.5): mounts RetrievalDesk. Local, deterministic grade; it records evidence
// and never opens a gate.
export default function RecuperacionRunner({ item, cellId, onClose }: RunnerProps) {
  const it = item as RecuperacionItem;
  return (
    <section data-forge-runner="recuperacion" data-item={it.itemId} aria-label={`Recuperación · ${it.title}`}>
      <h3>{it.title}</h3>
      <p style={{ whiteSpace: "pre-wrap" }}>{it.statement}</p>
      <RetrievalDesk item={it} cellId={cellId} />
      <button type="button" onClick={onClose}>
        Cerrar
      </button>
    </section>
  );
}
