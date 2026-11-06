"use client";

import { PENDING_TEXT, type FlowProps } from "@/forge/ui/flow-contract";

// STUB (Phase 0) of the `ontologia` flow (OntologyForge). Owner: forge/e1-modelos, which replaces this file (design §9.5, §22.4).
// It never offers «Pedir veredicto» and never simulates an evaluation (§22.5).
export default function OntologyForge({ cellCode, onClose }: FlowProps) {
  return (
    <section data-forge-stub="flow-ontologia" data-cell={cellCode}>
      <p role="status">{PENDING_TEXT}</p>
      <button type="button" onClick={onClose}>
        Cerrar
      </button>
    </section>
  );
}
