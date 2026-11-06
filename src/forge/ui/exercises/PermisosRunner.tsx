"use client";

import type { RunnerProps } from "./registry";
import { PermissionMatrix, type PermisosItem } from "@/forge/ui/PermissionMatrix";

// PRACTICE runner of `permisos` (design §9.5): mounts PermissionMatrix. The grade is local, from the propagation
// evaluator; it records evidence and never opens a gate.
export default function PermisosRunner({ item, cellId, onClose }: RunnerProps) {
  const it = item as PermisosItem;
  return (
    <section data-forge-runner="permisos" data-item={it.itemId} aria-label={`Permisos · ${it.title}`}>
      <h3>{it.title}</h3>
      <p style={{ whiteSpace: "pre-wrap" }}>{it.statement}</p>
      <PermissionMatrix item={it} cellId={cellId} />
      <button type="button" onClick={onClose}>
        Cerrar
      </button>
    </section>
  );
}
