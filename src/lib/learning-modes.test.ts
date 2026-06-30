import { describe, it, expect } from "vitest";
import { modesFor, nextReview } from "@/lib/learning-modes";
import { project } from "@/core/projector";
import { present } from "@/core/present";
import { makeEvent } from "@/core/event";
import { SEED_EVENTS } from "@/lib/seed";
import { SPINES } from "@/lib/spines";

const NOW = Date.UTC(2026, 6, 1);
const rm = project(SEED_EVENTS);
const vm = present(rm, NOW);
const fred = SPINES.find((s) => s.goalTitle === "FrED Factory")!;
const s2 = fred.cells.find((c) => c.title.startsWith("S2"))!; // heavy mission cell
const comp = SPINES.find((s) => s.goalTitle.startsWith("Competitiva"))!.cells[0]!; // traced, no mission

describe("modesFor — nature-by-duration (always something to do)", () => {
  it("a mission cell offers heavy + light; review mirrors the global decay queue", () => {
    const m = rm.modules.find((x) => x.id === s2.id)!;
    const modes = modesFor(m, vm);
    expect(modes.heavy).toBe(true);
    expect(modes.light).toBe(true);
    expect(modes.review).toBe(vm.reviewQueue.length);
  });

  it("a traced (non-mission) cell offers light but NOT heavy — still never an empty screen", () => {
    const m = rm.modules.find((x) => x.id === comp.id)!;
    const modes = modesFor(m, vm);
    expect(modes.heavy).toBe(false);
    expect(modes.light).toBe(true); // it has a real source → a light lesson can be generated
  });
});

describe("nextReview — Capa C (the decay queue)", () => {
  it("is null on a fresh universe (caught up — honest, not a fake item)", () => {
    expect(nextReview(rm, vm)).toBeNull();
  });

  it("returns the most-overdue DEMONSTRATED module once its retrievability decays", () => {
    const T = Date.UTC(2026, 0, 1);
    const events = [
      makeEvent("module.upserted", { title: "Done", prereqs: [], kind: "core" }, { ts: T, deviceId: "d", goalId: "g", moduleId: "d1" }),
      makeEvent("module.completed", {}, { ts: T, deviceId: "d", moduleId: "d1" }),
    ];
    const rm2 = project(events);
    const vmLater = present(rm2, T + 1000 * 86_400_000); // ~1000 days later → overdue
    expect(nextReview(rm2, vmLater)?.id).toBe("d1");
  });
});
