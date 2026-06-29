"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Connection,
  type NodeTypes,
} from "@xyflow/react";
import { useArcanum, useArcanumStore } from "@/app/providers";
import { useActions } from "@/ui/use-actions";
import { RoadmapNode } from "@/ui/roadmap/RoadmapNode";
import { LaneHeader } from "@/ui/roadmap/LaneHeader";
import { NodeDetailSheet } from "@/ui/roadmap/NodeDetailSheet";
import { buildRoadmapGraph } from "@/lib/roadmap-graph";
import { wouldCreateCycle } from "@/core/roadmap";
import type { Goal } from "@/core/read-model";

const NODE_TYPES: NodeTypes = { roadmapNode: RoadmapNode, laneHeader: LaneHeader };

function CreateNodeSheet({
  goals,
  onClose,
  onCreate,
}: {
  goals: Goal[];
  onClose: () => void;
  onCreate: (goalId: string, title: string) => Promise<unknown>;
}) {
  const [title, setTitle] = useState("");
  const [goalId, setGoalId] = useState(goals[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      style={{ background: "var(--overlay-scrim)" }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-node-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim() || !goalId || busy) return;
          setBusy(true);
          await onCreate(goalId, title.trim());
          onClose();
        }}
        className="w-full max-w-md rounded-t-[var(--r-lg)] border border-line bg-surface-raised p-6 sm:rounded-[var(--r-lg)]"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <h2 id="create-node-title" className="font-display text-lg tracking-[0.12em] text-text">NUEVO NODO</h2>
        <p className="mb-4 mt-1 text-[13px] text-text-muted">Un módulo nace sin prerrequisitos. Arrastra una conexión para sellarlo tras otro.</p>
        <label className="mb-3 block">
          <span className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-text-faint">Meta</span>
          <select
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
            className="min-h-11 w-full rounded-[var(--r-sm)] border border-line bg-ink px-3 text-sm text-text focus:border-topic focus:outline-none"
          >
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-text-faint">Título</span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="p. ej. Programación dinámica"
            className="min-h-11 w-full rounded-[var(--r-sm)] border border-line bg-ink px-3 text-sm text-text placeholder:text-text-faint focus:border-topic focus:outline-none"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-11 px-3 text-sm text-text-faint transition hover:text-text">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!title.trim() || !goalId || busy}
            className="min-h-11 rounded-[var(--r-sm)] border border-topic bg-[var(--topic-deep)] px-4 text-sm text-topic transition hover:brightness-125 disabled:opacity-40"
          >
            Trazar nodo
          </button>
        </div>
      </form>
    </div>
  );
}

function CanvasInner({ onClose }: { onClose: () => void }) {
  const store = useArcanumStore();
  const readModel = useArcanum((s) => s.readModel);
  const vmModules = useArcanum((s) => s.viewModel.modules);
  const { moveNode, connectPrereq, createModule } = useActions();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const dragging = useRef(false);
  const pendingSync = useRef(false);

  const openDetail = useCallback((id: string) => setDetailId(id), []);
  const rById = useMemo(() => new Map(vmModules.map((m) => [m.id, m.retrievability])), [vmModules]);
  const graph = useMemo(() => buildRoadmapGraph(readModel, rById, openDetail), [readModel, rById, openDetail]);

  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);

  // Always flush the freshest graph from drag-stop, not a stale closure.
  const graphRef = useRef(graph);
  graphRef.current = graph;

  // Re-sync from the log when the model changes — but never mid-drag (it would
  // snap a node being moved back to its pre-move position). A model change that
  // arrives mid-drag (e.g. cross-device sync) is deferred and flushed on drag-stop.
  useEffect(() => {
    if (dragging.current) {
      pendingSync.current = true;
      return;
    }
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [graph, setNodes, setEdges]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3400);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Escape closes the map — but only when no sheet is open (sheets self-handle it).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !detailId && !creating) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailId, creating, onClose]);

  const onConnect = useCallback(
    (c: Connection) => {
      const { source, target } = c;
      if (!source || !target) return;
      // Validate against the LATEST committed log, not the captured closure —
      // rapid A→B then B→A connects must both see each other (the projector also
      // guards this on every fold as defense-in-depth).
      const liveEdges = store.getState().readModel.edges;
      if (source === target || wouldCreateCycle(liveEdges, source, target)) {
        setToast("Esa conexión cerraría un ciclo. El mapa fluye en una sola dirección — rechazada.");
        return;
      }
      void connectPrereq(source, target);
    },
    [store, connectPrereq],
  );

  const onNodeDragStart = useCallback(() => {
    dragging.current = true;
  }, []);
  const onNodeDragStop = useCallback(
    async (_e: MouseEvent | TouchEvent, node: Node) => {
      try {
        // Persist the position FIRST, keeping the re-sync suppressed across the
        // round-trip so the drop doesn't visibly revert before the event lands.
        if (node.type === "roadmapNode") await moveNode(node.id, node.position.x, node.position.y);
      } finally {
        dragging.current = false;
        if (pendingSync.current) {
          pendingSync.current = false;
          setNodes(graphRef.current.nodes);
          setEdges(graphRef.current.edges);
        }
      }
    },
    [moveNode, setNodes, setEdges],
  );

  const goals = readModel.goals.filter((g) => !g.archived);

  return (
    <div className="fixed inset-0 z-50 bg-ink">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={NODE_TYPES}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.28 }}
        minZoom={0.3}
        maxZoom={1.8}
        zoomOnDoubleClick={false}
        panOnScroll
        deleteKeyCode={null}
        proOptions={{ hideAttribution: false }}
        nodeOrigin={[0, 0]}
      >
        <Background variant={BackgroundVariant.Dots} gap={30} size={1} color="var(--line)" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>

      <header
        className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <button
          onClick={onClose}
          className="pointer-events-auto min-h-11 rounded-[var(--r-pill)] border border-line bg-surface/90 px-4 text-[11px] uppercase tracking-[0.2em] text-text-muted backdrop-blur-0 transition hover:text-text"
        >
          ‹ Cerrar
        </button>
        <span className="font-display text-sm tracking-[0.4em] text-text-faint">MAPA</span>
        <button
          onClick={() => setCreating(true)}
          className="pointer-events-auto min-h-11 rounded-[var(--r-pill)] border border-topic bg-[var(--topic-deep)] px-4 text-[11px] uppercase tracking-[0.18em] text-topic transition hover:brightness-125"
        >
          ＋ Nodo
        </button>
      </header>

      {toast && (
        <div
          className="pointer-events-none absolute inset-x-0 z-[55] flex justify-center px-4"
          style={{ top: "max(4.75rem, calc(env(safe-area-inset-top) + 3.75rem))" }}
        >
          <div
            role="alert"
            className="pointer-events-auto flex max-w-sm items-center gap-2 rounded-[var(--r-md)] border border-amber bg-surface-raised py-2 pl-4 pr-2 text-[13px] leading-snug text-text shadow-aura"
          >
            <span>{toast}</span>
            <button
              onClick={() => setToast(null)}
              aria-label="Descartar aviso"
              className="min-h-11 shrink-0 px-2 text-lg leading-none text-text-faint transition hover:text-text"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {creating && (
        <CreateNodeSheet goals={goals} onClose={() => setCreating(false)} onCreate={createModule} />
      )}
      {detailId && <NodeDetailSheet moduleId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

export function RoadmapCanvas({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <ReactFlowProvider>
      <CanvasInner onClose={onClose} />
    </ReactFlowProvider>
  );
}
