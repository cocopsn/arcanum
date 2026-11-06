"use client";

import { PENDING_TEXT, type FlowProps } from "@/forge/ui/flow-contract";

// STUB (Phase 0) of the `mision` flow (ForgeMission). Owner: forge/e3-ia, which replaces this file (design §9.5, §22.4).
// It never offers «Pedir veredicto» and never simulates an evaluation (§22.5).
export default function ForgeMission({ cellCode, onClose }: FlowProps) {
  return (
    <section data-forge-stub="flow-mision" data-cell={cellCode}>
      <p role="status">{PENDING_TEXT}</p>
      <button type="button" onClick={onClose}>
        Cerrar
      </button>
    </section>
  );
}
