import { describe, it, expect } from "vitest";
import { buildRoadmapGraph } from "@/lib/roadmap-graph";
import { project } from "@/core/projector";
import { makeEvent } from "@/core/event";
import type { RoadmapNodeData } from "@/ui/roadmap/RoadmapNode";

const noop = () => {};

function seedRm() {
  const events = [
    makeEvent("goal.upserted", { title: "ITC", priority: 1, color: "#2ec0d6", sigil: "itc" }, { ts: 1, deviceId: "d", goalId: "g" }),
    makeEvent("module.upserted", { title: "Root", prereqs: [], kind: "core" }, { ts: 2, deviceId: "d", goalId: "g", moduleId: "root" }),
    makeEvent("module.upserted", { title: "Child", prereqs: [], kind: "core" }, { ts: 3, deviceId: "d", goalId: "g", moduleId: "child" }),
    makeEvent("roadmap.edge.upserted", { from: "root", to: "child" }, { ts: 4, deviceId: "d" }),
  ];
  return project(events);
}

describe("buildRoadmapGraph", () => {
  it("emits one node per module plus a lane header, and the prereq edge", () => {
    const { nodes, edges } = buildRoadmapGraph(seedRm(), new Map(), noop);
    expect(nodes.filter((n) => n.type === "roadmapNode")).toHaveLength(2);
    expect(nodes.filter((n) => n.type === "laneHeader")).toHaveLength(1);
    expect(edges).toEqual([
      expect.objectContaining({ source: "root", target: "child", type: "default" }),
    ]);
  });

  it("derives node status into data: root available, child sealed (fog-of-war)", () => {
    const { nodes } = buildRoadmapGraph(seedRm(), new Map(), noop);
    const data = (id: string) => nodes.find((n) => n.id === id)!.data as RoadmapNodeData;
    expect(data("root").status).toBe("available");
    expect(data("child").status).toBe("sealed");
  });

  it("dims the edge into a sealed target, brightens it once revealed", () => {
    const sealed = buildRoadmapGraph(seedRm(), new Map(), noop);
    expect(sealed.edges[0]!.style!.opacity).toBeCloseTo(0.32);

    const revealed = project([
      makeEvent("goal.upserted", { title: "ITC", priority: 1, color: "#2ec0d6", sigil: "itc" }, { ts: 1, deviceId: "d", goalId: "g" }),
      makeEvent("module.upserted", { title: "Root", prereqs: [], kind: "core" }, { ts: 2, deviceId: "d", goalId: "g", moduleId: "root" }),
      makeEvent("module.upserted", { title: "Child", prereqs: [], kind: "core" }, { ts: 3, deviceId: "d", goalId: "g", moduleId: "child" }),
      makeEvent("roadmap.edge.upserted", { from: "root", to: "child" }, { ts: 4, deviceId: "d" }),
      makeEvent("module.completed", {}, { ts: 5, deviceId: "d", moduleId: "root" }),
    ]);
    const g = buildRoadmapGraph(revealed, new Map(), noop);
    expect((g.nodes.find((n) => n.id === "child")!.data as RoadmapNodeData).status).toBe("available");
    expect(g.edges[0]!.style!.opacity).toBeCloseTo(0.62);
  });

  it("uses the persisted (event-sourced) position when present, else auto-layout", () => {
    const moved = project([
      makeEvent("goal.upserted", { title: "ITC", priority: 1, color: "#2ec0d6", sigil: "itc" }, { ts: 1, deviceId: "d", goalId: "g" }),
      makeEvent("module.upserted", { title: "Root", prereqs: [], kind: "core" }, { ts: 2, deviceId: "d", goalId: "g", moduleId: "root" }),
      makeEvent("roadmap.node.moved", { ref: "root", x: 777, y: 222 }, { ts: 3, deviceId: "d" }),
    ]);
    const { nodes } = buildRoadmapGraph(moved, new Map(), noop);
    expect(nodes.find((n) => n.id === "root")!.position).toEqual({ x: 777, y: 222 });
  });
});
