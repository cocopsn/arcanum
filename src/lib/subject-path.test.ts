import { describe, it, expect } from "vitest";
import { orderTopics } from "@/lib/subject-path";
import type { ModuleRM, Edge } from "@/core/read-model";

const mod = (id: string, title = id, over: Partial<ModuleRM> = {}): ModuleRM => ({
  id,
  goalId: "g",
  title,
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

describe("orderTopics — Duolingo path order", () => {
  it("orders a linear prereq chain root→…→leaf", () => {
    const mods = [mod("c"), mod("a"), mod("b")];
    const edges: Edge[] = [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ];
    expect(orderTopics(mods, edges).map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("breaks ties by title for determinism", () => {
    const mods = [mod("z", "Zeta"), mod("a", "Alfa")];
    expect(orderTopics(mods, []).map((m) => m.title)).toEqual(["Alfa", "Zeta"]);
  });

  it("excludes archived topics", () => {
    const mods = [mod("a"), mod("b", "b", { archived: true })];
    expect(orderTopics(mods, []).map((m) => m.id)).toEqual(["a"]);
  });

  it("degrades without dropping topics if edges reference unknown nodes", () => {
    const mods = [mod("a"), mod("b")];
    const edges: Edge[] = [{ from: "ghost", to: "b" }]; // 'ghost' not in this goal
    const out = orderTopics(mods, edges).map((m) => m.id);
    expect(out.sort()).toEqual(["a", "b"]); // both present, none dropped
  });
});
