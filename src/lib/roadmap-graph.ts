import type { Node, Edge as RFEdge } from "@xyflow/react";
import { layoutRoadmap } from "@/lib/roadmap-layout";
import { nodeStatus } from "@/core/roadmap";
import type { ReadModel } from "@/core/read-model";
import type { RoadmapNodeData } from "@/ui/roadmap/RoadmapNode";
import type { LaneHeaderData } from "@/ui/roadmap/LaneHeader";

/**
 * Pure: derive the React Flow graph from the read-model. Node positions come
 * from the log (persisted move events) and fall back to dagre auto-layout.
 * Type-only React Flow import → no runtime/CSS coupling, fully testable.
 */
export function buildRoadmapGraph(
  rm: ReadModel,
  rById: Map<string, number>,
  onOpen: (id: string) => void,
): { nodes: Node[]; edges: RFEdge[] } {
  const goals = rm.goals.filter((g) => !g.archived);
  const modules = rm.modules.filter((m) => !m.archived);
  const byId = new Map(modules.map((m) => [m.id, m]));
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const layout = layoutRoadmap(goals, modules, rm.edges);
  const colorOf = (mid: string) => {
    const gid = byId.get(mid)?.goalId;
    return (gid && goalById.get(gid)?.color) || "var(--topic)";
  };

  const nodes: Node[] = [];
  for (const lane of layout.lanes) {
    const goal = goalById.get(lane.goalId);
    if (!goal) continue;
    nodes.push({
      id: `lane-${goal.id}`,
      type: "laneHeader",
      position: { x: -236, y: lane.y },
      data: { title: goal.title, color: goal.color } satisfies LaneHeaderData,
      draggable: false,
      selectable: false,
      connectable: false,
      deletable: false,
    });
  }
  for (const m of modules) {
    const pos =
      m.x !== null && m.y !== null
        ? { x: m.x, y: m.y }
        : layout.positions.get(m.id) ?? { x: 0, y: 0 };
    nodes.push({
      id: m.id,
      type: "roadmapNode",
      position: pos,
      // Deletion is only via the detail sheet's Archive → node.archived event.
      // No keyboard/programmatic delete may drop a node outside the log.
      deletable: false,
      data: {
        title: m.title,
        status: nodeStatus(m, rm.edges, byId),
        retrievability: rById.get(m.id) ?? 0,
        goalColor: colorOf(m.id),
        firetestRatio: m.firetestRatio,
        onOpen,
      } satisfies RoadmapNodeData,
    });
  }

  const edges: RFEdge[] = rm.edges
    .filter((e) => byId.has(e.from) && byId.has(e.to))
    .map((e) => {
      const targetSealed = nodeStatus(byId.get(e.to)!, rm.edges, byId) === "sealed";
      return {
        id: `${e.from}->${e.to}`,
        source: e.from,
        target: e.to,
        type: "default",
        style: {
          stroke: colorOf(e.from),
          strokeWidth: 1.5,
          strokeLinecap: "round" as const,
          opacity: targetSealed ? 0.32 : 0.62,
        },
      };
    });

  return { nodes, edges };
}
