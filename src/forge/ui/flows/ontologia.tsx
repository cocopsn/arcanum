"use client";

import { useEffect, useState } from "react";
import { loadForgeBankItems } from "@/forge/loaders";
import { closingMount, PENDING_TEXT, type FlowProps } from "@/forge/ui/flow-contract";
import { OntologyEditor, useDeliveredModelId, type OntologyItem } from "@/forge/ui/OntologyEditor";
import { FLOWS } from "./registry";

// ONTOLOGY FORGE, the `ontologia` flow of P2-01, P2-02, P2-03, P2-05 and P2-08 (design §9.3 l, §9.5). The learner models
// the brief; with ZERO structural findings «Entregar el modelo» writes the evidence phase "modelo" and, once it is in the
// log, the flow ends by mounting the `mision` flow of the registry in ARTIFACT mode with kind = cell.compuerta and
// attachments.eventIds = [that evidence] (closing rule, flow-contract.ts). This flow NEVER asks for a verdict: only
// ForgeMission does, after the delivery with apoyo and the giro.

type Load = { estado: "cargando" } | { estado: "sin-banco" } | { estado: "pendiente" } | { estado: "sin-item" } | { estado: "listo"; item: OntologyItem };

export default function OntologyForge(props: FlowProps) {
  const { cellCode, cellId, route, onClose } = props;
  const cell = route.cells.find((c) => c.code === cellCode) ?? null;
  const [load, setLoad] = useState<Load>({ estado: "cargando" });
  const [mission, setMission] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadForgeBankItems(cellCode)
      .then((r) => {
        if (!alive) return;
        if (!r) return setLoad({ estado: "sin-banco" });
        const item = r.items.find((i): i is OntologyItem => i.type === "ontologia");
        if (item) return setLoad({ estado: "listo", item });
        setLoad(r.pendientes.length ? { estado: "pendiente" } : { estado: "sin-item" });
      })
      .catch(() => alive && setLoad({ estado: "sin-banco" }));
    return () => {
      alive = false;
    };
  }, [cellCode]);

  const itemId = load.estado === "listo" ? load.item.itemId : "";
  const delivered = useDeliveredModelId(cellId, itemId);

  if (mission && cell) {
    const m = closingMount(cell.compuerta, [mission]);
    if (m) {
      const Mission = FLOWS.mision;
      return <Mission {...props} kind={m.kind} attachments={m.attachments} />;
    }
  }

  return (
    <section data-forge-flow="ontologia" data-cell={cellCode} aria-label={`Ontology Forge · ${cellCode}`}>
      <p style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#b9b9b9" }}>
        Ontology Forge · {cellCode}
      </p>
      {load.estado === "cargando" && <p role="status">Cargando el banco de la celda…</p>}
      {load.estado === "sin-banco" && <p role="status">Falta el banco de la ruta en este dispositivo: descárgalo para modelar.</p>}
      {(load.estado === "pendiente" || load.estado === "sin-item") && <p role="status">{PENDING_TEXT}</p>}
      {load.estado === "listo" && (
        <>
          <p style={{ whiteSpace: "pre-wrap" }}>{load.item.statement}</p>
          <OntologyEditor item={load.item} cellId={cellId} onDelivered={(id) => setMission(id)} deliverLabel="Entregar el modelo" />
          {delivered && !mission && (
            <button type="button" onClick={() => setMission(delivered)} style={{ background: "#2f3234", color: "#ffffff", border: "1px solid #9b9b9b", padding: "0.35rem 0.7rem", minHeight: 44 }}>
              Continuar a la entrega de la misión con el modelo entregado
            </button>
          )}
        </>
      )}
      <button type="button" onClick={onClose}>
        Cerrar
      </button>
    </section>
  );
}
