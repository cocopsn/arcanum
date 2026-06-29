import { describe, it, expect } from "vitest";
import { prereqsOf, isMastered, isRevealed, nodeStatus, wouldCreateCycle } from "@/core/roadmap";
import { project } from "@/core/projector";
import { makeEvent } from "@/core/event";
import type { ModuleRM, Edge } from "@/core/read-model";

const mod = (id: string, over: Partial<ModuleRM> = {}): ModuleRM => ({
  id,
  goalId: "g",
  title: id,
  status: "idle",
  kind: "core",
  prereqs: [],
  S: 1,
  lastReinforcedDays: 0,
  dueDays: 0,
  startedDays: null,
  archived: false,
  firetestRatio: null,
  x: null,
  y: null,
  sourceObligationId: null,
  gatePassed: false,
  ...over,
});

describe("roadmap derivation", () => {
  it("prereqsOf returns edge sources pointing at the node", () => {
    const edges: Edge[] = [
      { from: "a", to: "c" },
      { from: "b", to: "c" },
      { from: "a", to: "d" },
    ];
    expect(prereqsOf("c", edges).sort()).toEqual(["a", "b"]);
    expect(prereqsOf("a", edges)).toEqual([]);
  });

  it("isMastered: completed or firetest ≥ threshold", () => {
    expect(isMastered(mod("x", { status: "completed" }))).toBe(true);
    expect(isMastered(mod("x", { firetestRatio: 0.7 }))).toBe(true);
    expect(isMastered(mod("x", { firetestRatio: 0.6 }))).toBe(false);
    expect(isMastered(mod("x"))).toBe(false);
  });

  it("nodeStatus derives sealed/available/started/completed from prereqs + events", () => {
    const root = mod("root");
    const child = mod("child");
    const byId = new Map([
      ["root", root],
      ["child", child],
    ]);
    const edges: Edge[] = [{ from: "root", to: "child" }];
    expect(nodeStatus(root, edges, byId)).toBe("available"); // no prereqs
    expect(nodeStatus(child, edges, byId)).toBe("sealed"); // root not mastered

    const rootDone = mod("root", { status: "completed" });
    const byId2 = new Map([
      ["root", rootDone],
      ["child", child],
    ]);
    expect(nodeStatus(child, edges, byId2)).toBe("available"); // root completed → revealed
    expect(nodeStatus(mod("child", { status: "started" }), edges, byId2)).toBe("started");
    expect(nodeStatus(mod("child", { status: "completed" }), edges, byId2)).toBe("completed");
  });

  it("firetest on a prereq reveals the downstream node (skips the path)", () => {
    const child = mod("child");
    const root = mod("root", { firetestRatio: 0.8 }); // cleared the bar without completing
    const byId = new Map([
      ["root", root],
      ["child", child],
    ]);
    expect(isRevealed("child", [{ from: "root", to: "child" }], byId)).toBe(true);
  });

  it("an archived prereq is not a gate — its downstream node is not sealed forever", () => {
    const root = mod("root", { archived: true });
    const child = mod("child");
    const byId = new Map([
      ["root", root],
      ["child", child],
    ]);
    const edges: Edge[] = [{ from: "root", to: "child" }];
    expect(isRevealed("child", edges, byId)).toBe(true);
    expect(nodeStatus(child, edges, byId)).toBe("available");
  });

  it("passing the adversarial exit gate (gatePassed) masters a cell and reveals the next", () => {
    const a = mod("a", { gatePassed: true }); // exit gate passed
    const b = mod("b");
    const byId = new Map([
      ["a", a],
      ["b", b],
    ]);
    const edges: Edge[] = [{ from: "a", to: "b" }];
    expect(isMastered(a)).toBe(true);
    expect(nodeStatus(b, edges, byId)).toBe("available"); // gate gave real power over progression
  });

  it("a firetest-mastered node surfaces itself even with an unmet prereq (not buried)", () => {
    const root = mod("root"); // unmastered prereq
    const child = mod("child", { firetestRatio: 0.8 }); // proven via firetest
    const byId = new Map([
      ["root", root],
      ["child", child],
    ]);
    expect(nodeStatus(child, [{ from: "root", to: "child" }], byId)).toBe("available");
  });

  it("wouldCreateCycle rejects self-loops and back-edges", () => {
    const edges: Edge[] = [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ];
    expect(wouldCreateCycle(edges, "a", "a")).toBe(true); // self
    expect(wouldCreateCycle(edges, "c", "a")).toBe(true); // c→a closes a→b→c→a
    expect(wouldCreateCycle(edges, "a", "c")).toBe(false); // forward shortcut, fine
    expect(wouldCreateCycle(edges, "a", "d")).toBe(false); // new node
  });

  it("reveal is derived from the log and idempotent under re-fold", () => {
    const events = [
      makeEvent("module.upserted", { title: "Root", prereqs: [], kind: "core" }, { ts: 1, deviceId: "d", moduleId: "root", goalId: "g" }),
      makeEvent("module.upserted", { title: "Child", prereqs: [], kind: "core" }, { ts: 2, deviceId: "d", moduleId: "child", goalId: "g" }),
      makeEvent("roadmap.edge.upserted", { from: "root", to: "child" }, { ts: 3, deviceId: "d" }),
      makeEvent("module.completed", {}, { ts: 4, deviceId: "d", moduleId: "root" }),
    ];
    const reveal = () => {
      const rm = project(events);
      const byId = new Map(rm.modules.map((m) => [m.id, m]));
      return nodeStatus(byId.get("child")!, rm.edges, byId);
    };
    expect(reveal()).toBe("available"); // root completed → child revealed
    expect(reveal()).toBe(reveal()); // idempotent under re-projection
  });

  it("node position persists as an event and reconstructs from the log (last move wins)", () => {
    const base = [
      makeEvent("module.upserted", { title: "M", prereqs: [], kind: "core" }, { ts: 1, deviceId: "d", moduleId: "m1", goalId: "g" }),
      makeEvent("roadmap.node.moved", { ref: "m1", x: 120, y: 340 }, { ts: 2, deviceId: "d" }),
    ];
    const m = project(base).modules.find((x) => x.id === "m1")!;
    expect([m.x, m.y]).toEqual([120, 340]);

    const moved = [...base, makeEvent("roadmap.node.moved", { ref: "m1", x: 50, y: 60 }, { ts: 3, deviceId: "d" })];
    const m2 = project(moved).modules.find((x) => x.id === "m1")!;
    expect([m2.x, m2.y]).toEqual([50, 60]);
  });

  it("firetestRatio is derived from the log (best ratio wins)", () => {
    const events = [
      makeEvent("module.upserted", { title: "M", prereqs: [], kind: "core" }, { ts: 1, deviceId: "d", moduleId: "m1" }),
      makeEvent("firetest.attempted", { reached: 3, ceiling: 10 }, { ts: 2, deviceId: "d", moduleId: "m1" }),
      makeEvent("firetest.attempted", { reached: 8, ceiling: 10 }, { ts: 3, deviceId: "d", moduleId: "m1" }),
    ];
    expect(project(events).modules.find((x) => x.id === "m1")!.firetestRatio).toBe(0.8);
  });
});
