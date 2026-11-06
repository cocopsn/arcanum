"use client";

import { useState } from "react";
import { useArcanum } from "@/app/providers";
import type { ForgeItemOf } from "@/forge/bank/registry";
import { gradePermisos, PERMISOS_LABEL } from "@/forge/eval/permissions";
import { useOntologyEvidence } from "@/forge/ui/OntologyEditor";

// PERMISSION MATRIX of `permisos` (design §9.3 n). The learner reads the simplified model (users, groups, roles,
// markings, resources with parent and derivations) and marks «permitido» or «denegado» on every question, with no default
// value; all answers go together. The grade comes from the PROPAGATION EVALUATOR (eval/permissions.ts), never from the
// bank's ### Solución. The expected answers and the reasons are painted only when the answer is IN THE LOG (the FIRST
// evidence phase "respuesta" of this item, derived from the read model).

export type PermisosItem = ForgeItemOf<"permisos">;

const S = {
  panel: { border: "1px solid #494a4b", background: "#1e2124", color: "#ffffff", padding: "0.75rem", marginBottom: "0.75rem" },
  meta: { fontFamily: "ui-monospace, monospace", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#b9b9b9" },
  cell: { borderBottom: "1px solid #494a4b", padding: "0.25rem 0.5rem", textAlign: "left" as const, verticalAlign: "top" as const },
};

function useFirstAnswer(cellId: string, itemId: string): Record<string, boolean> | null {
  return useArcanum((s) => {
    const e = s.readModel.evidence.find((x) => x.moduleId === cellId && x.itemId === itemId && x.type === "permisos" && x.phase === "respuesta");
    const d = e?.data as { respuestas?: Record<string, boolean> } | undefined;
    return d && d.respuestas && typeof d.respuestas === "object" ? d.respuestas : null;
  });
}

export function PermissionMatrix({ item, cellId, onGraded }: { item: PermisosItem; cellId: string; onGraded?: (correcto: boolean) => void }) {
  const { modelo, preguntas } = item.data;
  const [resp, setResp] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const record = useOntologyEvidence(cellId);
  const first = useFirstAnswer(cellId, item.itemId);
  const all = preguntas.every((q) => typeof resp[q.id] === "boolean");
  const graded = first ? gradePermisos(item.data, first) : null;

  async function entregar() {
    if (!all || first) return;
    setBusy(true);
    try {
      const g = gradePermisos(item.data, resp);
      await record({ itemId: item.itemId, type: "permisos", phase: "respuesta", outcome: g.correcto ? "correcto" : "incorrecto", data: { respuestas: resp, aciertos: g.aciertos, total: g.total }, source: "local" });
      onGraded?.(g.correcto);
    } catch (e) {
      setStatus(`No se pudo registrar tu respuesta: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const name = (id: string) => modelo.markings.find((m) => m.id === id)?.nombre ?? id;
  return (
    <div data-forge-permisos="matriz">
      <p style={S.meta}>↳ Comprobado en tu dispositivo · {PERMISOS_LABEL}</p>
      <section style={S.panel} aria-label="Modelo de permisos">
        <p style={S.meta}>Usuarios y grupos</p>
        <ul>
          {modelo.usuarios.map((u) => (
            <li key={u.id}>
              {u.id}: {u.grupos.join(", ") || "sin grupos"}
            </li>
          ))}
        </ul>
        <p style={S.meta}>Roles</p>
        <ul>
          {modelo.roles.map((r) => (
            <li key={r.id}>
              {r.id}: {r.permisos.join(", ")}
            </li>
          ))}
        </ul>
        <p style={S.meta}>Markings</p>
        <ul>
          {modelo.markings.map((m) => (
            <li key={m.id}>
              ▣ {m.nombre} ({m.id}): {m.miembros.join(", ")}
            </li>
          ))}
        </ul>
        <p style={S.meta}>Recursos</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                {["Recurso", "Tipo", "Padre", "Deriva de", "Acceso", "Markings propios"].map((h) => (
                  <th key={h} style={S.cell} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modelo.recursos.map((r) => (
                <tr key={r.id}>
                  <th style={S.cell} scope="row">
                    {r.id}
                  </th>
                  <td style={S.cell}>{r.tipo}</td>
                  <td style={S.cell}>{r.de ?? "—"}</td>
                  <td style={S.cell}>{(r.deriva_de ?? []).join(", ") || "—"}</td>
                  <td style={S.cell}>{r.acceso.map((a) => `${a.principal} → ${a.rol}`).join("; ") || "—"}</td>
                  <td style={S.cell}>{r.markings.map(name).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section style={S.panel} aria-label="Preguntas">
        <p style={S.meta}>▼ ¿Puede hacerlo? · {preguntas.length} preguntas</p>
        <ol>
          {preguntas.map((q) => {
            const r = graded?.porPregunta.find((p) => p.id === q.id);
            return (
              <li key={q.id} style={{ marginBottom: "0.5rem" }}>
                <span>
                  ¿{q.usuario} puede <strong>{q.operacion}</strong> «{q.recurso}»?
                </span>{" "}
                {!first ? (
                  <span role="radiogroup" aria-label={`Respuesta a ${q.id}`}>
                    <label style={{ marginRight: 8 }}>
                      <input type="radio" name={`perm-${item.itemId}-${q.id}`} checked={resp[q.id] === true} onChange={() => setResp((x) => ({ ...x, [q.id]: true }))} /> Permitido
                    </label>
                    <label>
                      <input type="radio" name={`perm-${item.itemId}-${q.id}`} checked={resp[q.id] === false} onChange={() => setResp((x) => ({ ...x, [q.id]: false }))} /> Denegado
                    </label>
                  </span>
                ) : (
                  r && (
                    <span data-forge-permisos="razon" style={{ display: "block", border: r.ok ? "1px solid #9b9b9b" : "1px dashed #9b9b9b", padding: "0.25rem 0.5rem" }}>
                      {r.ok ? "✓" : "✕"} Respondiste {r.respuesta === null ? "nada" : r.respuesta ? "permitido" : "denegado"} · {r.razon}
                    </span>
                  )
                )}
              </li>
            );
          })}
        </ol>
        {!first && (
          <button type="button" onClick={entregar} disabled={!all || busy} aria-disabled={!all || busy}>
            Entregar respuestas
          </button>
        )}
        {graded && (
          <p role="status">
            {graded.correcto ? "✓ Todas correctas" : `✕ ${graded.aciertos} de ${graded.total} correctas`}: la calificación sale del evaluador de propagación.
          </p>
        )}
        {status && <p role="status">{status}</p>}
      </section>
    </div>
  );
}
