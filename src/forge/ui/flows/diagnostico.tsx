"use client";

import { PENDING_TEXT, type FlowProps } from "@/forge/ui/flow-contract";

// STUB (Phase 0) of the `diagnostico` flow (DiagnosticFlow). Owner: forge/e2-datos, which replaces this file (design §9.5, §22.4).
// It never offers «Pedir veredicto» and never simulates an evaluation (§22.5).
export default function DiagnosticFlow({ cellCode, onClose }: FlowProps) {
  return (
    <section data-forge-stub="flow-diagnostico" data-cell={cellCode}>
      <p role="status">{PENDING_TEXT}</p>
      <button type="button" onClick={onClose}>
        Cerrar
      </button>
    </section>
  );
}
