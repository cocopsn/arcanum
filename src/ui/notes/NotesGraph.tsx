"use client";

import "@xyflow/react/dist/style.css";

import { useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import Dagre from "@dagrejs/dagre";
import { buildNoteGraph, type NoteGraphCell } from "@/lib/note-graph";
import type { NoteRM } from "@/core/read-model";

// The notes graph view — DERIVED graph (note↔note wikilinks + note↔cell anchors) laid out with dagre,
// rendered with React Flow (already in the stack). No fog-of-war: this is knowledge territory, not
// progression. Pan/zoom, themed; tap a note to open it. iPhone-first.

type GNodeData = { label: string; kind: "note" | "cell"; onOpen?: () => void };

function GraphNodeView({ data }: NodeProps) {
  const d = data as GNodeData;
  const isCell = d.kind === "cell";
  return (
    <div
      onClick={d.onOpen}
      className="max-w-[160px] truncate rounded-[var(--r-sm)] border px-3 py-2 text-center text-[12px] leading-tight transition"
      style={{
        cursor: d.onOpen ? "pointer" : "default",
        background: isCell ? "color-mix(in srgb, var(--topic) 14%, var(--surface))" : "var(--surface-raised)",
        borderColor: isCell ? "var(--topic)" : "color-mix(in srgb, var(--rank) 40%, var(--line))",
        color: isCell ? "var(--topic)" : "var(--text)",
        fontFamily: isCell ? "inherit" : "var(--font-serif, inherit)",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      {isCell ? "◆ " : ""}
      {d.label}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const NODE_TYPES = { graph: GraphNodeView };

function laidOut(notes: NoteRM[], cells: NoteGraphCell[], onOpen: (noteId: string) => void): { nodes: Node[]; edges: Edge[] } {
  const g = buildNoteGraph(notes, cells);
  const dg = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  dg.setGraph({ rankdir: "TB", nodesep: 36, ranksep: 64 });
  g.nodes.forEach((n) => dg.setNode(n.id, { width: 168, height: 46 }));
  g.edges.forEach((e) => dg.setEdge(e.source, e.target));
  Dagre.layout(dg);

  const nodes: Node[] = g.nodes.map((n) => {
    const p = dg.node(n.id);
    return {
      id: n.id,
      type: "graph",
      position: { x: (p?.x ?? 0) - 84, y: (p?.y ?? 0) - 23 },
      data: { label: n.label, kind: n.kind, onOpen: n.kind === "note" ? () => onOpen(n.id) : undefined } as GNodeData,
      draggable: true,
    };
  });
  const edges: Edge[] = g.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: e.kind === "anchor",
    style:
      e.kind === "anchor"
        ? { stroke: "var(--topic)", strokeDasharray: "4 3", strokeWidth: 1.5 }
        : { stroke: "color-mix(in srgb, var(--rank) 55%, transparent)", strokeWidth: 1.5 },
  }));
  return { nodes, edges };
}

export function NotesGraph({ notes, cells, onOpen }: { notes: NoteRM[]; cells: NoteGraphCell[]; onOpen: (noteId: string) => void }) {
  const { nodes, edges } = useMemo(() => laidOut(notes, cells, onOpen), [notes, cells, onOpen]);

  if (nodes.length === 0) {
    return (
      <div className="grid h-full place-items-center px-6 text-center">
        <p className="font-serif text-[14px] italic text-text-faint">
          El grafo crece con tus notas. Enlaza con [[otra nota]] o ancla una nota a su celda.
        </p>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        edgesFocusable={false}
        panOnScroll
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="var(--line)" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
    </ReactFlowProvider>
  );
}
