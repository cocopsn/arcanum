import dagre from "@dagrejs/dagre";
import type { Goal, ModuleRM, Edge } from "@/core/read-model";

export const NODE_W = 184;
export const NODE_H = 68;
const LANE_HEADER = 44;
const LANE_GAP = 56;

export interface LaneLayout {
  positions: Map<string, { x: number; y: number }>;
  /** lane header rows: goal id + y + height of its band */
  lanes: { goalId: string; y: number; height: number }[];
}

/**
 * Auto-layout: each goal is a horizontal lane (dagre LR for topological order
 * within the goal), lanes stacked vertically. Deterministic for a given graph.
 * The caller lets persisted node positions (event-sourced) override these.
 */
export function layoutRoadmap(goals: Goal[], modules: ModuleRM[], edges: Edge[]): LaneLayout {
  const positions = new Map<string, { x: number; y: number }>();
  const lanes: { goalId: string; y: number; height: number }[] = [];
  let laneTop = 0;

  for (const goal of goals) {
    const goalMods = modules.filter((m) => m.goalId === goal.id && !m.archived);
    if (goalMods.length === 0) continue;

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "LR", nodesep: 28, ranksep: 72, marginx: 24, marginy: 12 });
    g.setDefaultEdgeLabel(() => ({}));
    for (const m of goalMods) g.setNode(m.id, { width: NODE_W, height: NODE_H });
    const ids = new Set(goalMods.map((m) => m.id));
    for (const e of edges) if (ids.has(e.from) && ids.has(e.to)) g.setEdge(e.from, e.to);
    dagre.layout(g);

    const bodyTop = laneTop + LANE_HEADER;
    let maxBottom = 0;
    for (const m of goalMods) {
      const n = g.node(m.id);
      positions.set(m.id, { x: n.x - NODE_W / 2 + 24, y: bodyTop + n.y - NODE_H / 2 });
      maxBottom = Math.max(maxBottom, n.y + NODE_H / 2);
    }
    const height = LANE_HEADER + maxBottom + 16;
    lanes.push({ goalId: goal.id, y: laneTop, height });
    laneTop += height + LANE_GAP;
  }

  return { positions, lanes };
}
