import { describe, it, expect } from "vitest";
import { buildInterrogationContext, heuristicInterrogation, missionForModule } from "@/lib/mission";
import { project } from "@/core/projector";
import { makeEvent } from "@/core/event";
import { SEED_EVENTS } from "@/lib/seed";
import { SPINES } from "@/lib/spines";
import { nodeStatus } from "@/core/roadmap";

const rm = project(SEED_EVENTS);
const cs = SPINES[0]!; // ITC
const missionCell = cs.cells.find((c) => c.mission)!; // first ITC mission (C1)
const missionIdx = cs.cells.indexOf(missionCell);
const nextCell = cs.cells[missionIdx + 1]!; // the node blocked behind the mission

const dev = (ts: number) => ({ ts, deviceId: "d" });

describe("missionForModule / buildInterrogationContext", () => {
  it("exposes the cell's directed mission (assignment + deliverable, anchored to the real source)", () => {
    const mission = missionForModule(missionCell.id)!;
    expect(mission.assignment.length).toBeGreaterThan(0);
    expect(mission.deliverable.length).toBeGreaterThan(0);

    const ctx = buildInterrogationContext(rm, missionCell.id, "  mis notas  ")!;
    expect(ctx.cellTitle).toBe(missionCell.title);
    expect(ctx.assignment.length).toBeGreaterThan(0);
    expect(ctx.sourceRefs.some((u) => u.startsWith("http"))).toBe(true);
    expect(ctx.notes).toBe("mis notas"); // trimmed
  });

  it("returns null for a cell that is not a mission cell", () => {
    const plain = cs.cells.find((c) => !c.mission)!;
    expect(missionForModule(plain.id)).toBeNull();
    expect(buildInterrogationContext(rm, plain.id, "x")).toBeNull();
  });
});

describe("heuristicInterrogation — honest, NEVER auto-passes", () => {
  const base = { cellTitle: "CS50 L1", assignment: "a", deliverable: "d", sourceRefs: [] as string[] };

  it("rejects trivial/short evidence outright (anti-gaming)", () => {
    const v = heuristicInterrogation({ ...base, notes: "vi el video, estuvo bien" });
    expect(v.passed).toBe(false);
    expect(v.summary).toMatch(/insuficiente/i);
    expect(v.questions).toEqual([]);
  });

  it("substantial evidence STILL does not open the gate — it requires the interrogator", () => {
    const long = Array.from({ length: 40 }, (_, i) => `palabra${i}`).join(" ");
    const v = heuristicInterrogation({ ...base, notes: long });
    expect(v.passed).toBe(false); // local heuristic can NEVER open a mission gate (no placebo)
    expect(v.feedback).toMatch(/interrogador|evaluador/i);
  });
});

describe("the directed-mission loop — block is derived from the log; only a PASS opens it", () => {
  it("seeds the first ITC mission as a heavy mission cell (kind:'mission')", () => {
    const m = rm.modules.find((x) => x.id === missionCell.id)!;
    expect(m.kind).toBe("mission");
  });

  it("the next node is SEALED until the mission's interrogation passes", () => {
    const byId = new Map(rm.modules.map((m) => [m.id, m]));
    expect(nodeStatus(byId.get(nextCell.id)!, rm.edges, byId)).toBe("sealed");
  });

  it("a PASS (after submitting evidence) unseals the next node; the questions ride on the log", () => {
    const T = SEED_EVENTS[SEED_EVENTS.length - 1]!.ts + 10_000;
    const events = [
      ...SEED_EVENTS,
      makeEvent("mission.submitted", { notes: "Mis notas reales de la lecture de C…" }, { ...dev(T), moduleId: missionCell.id }),
      makeEvent(
        "gate.evaluated",
        {
          passed: true,
          score: 0.92,
          summary: "Defendible.",
          feedback: "Explicaste el desbordamiento desde la representación de complemento a dos.",
          questions: ["¿Qué hace clang en la fase de linking?", "¿Por qué INT_MAX+1 da negativo?"],
          source: "ai",
          provider: "openai",
        },
        { ...dev(T + 1), moduleId: missionCell.id },
      ),
    ];
    const next = project(events);
    const m = next.modules.find((x) => x.id === missionCell.id)!;
    expect(m.gatePassed).toBe(true);

    const byId = new Map(next.modules.map((x) => [x.id, x]));
    expect(nodeStatus(byId.get(nextCell.id)!, next.edges, byId)).toBe("available");

    // evidence + generated questions are in the read model (auditable)
    expect(next.missions.find((x) => x.moduleId === missionCell.id)!.notes).toMatch(/notas reales/);
    expect(next.gates.find((g) => g.moduleId === missionCell.id)!.questions).toHaveLength(2);

    expect(project(events)).toEqual(next); // idempotent under re-fold
  });

  it("submitting evidence WITHOUT a pass does not unseal — and marking the cell completed can't bypass it", () => {
    const T = SEED_EVENTS[SEED_EVENTS.length - 1]!.ts + 10_000;
    const events = [
      ...SEED_EVENTS,
      makeEvent("module.started", {}, { ...dev(T), moduleId: missionCell.id }),
      makeEvent("mission.submitted", { notes: "algo" }, { ...dev(T + 1), moduleId: missionCell.id }),
      makeEvent(
        "gate.evaluated",
        { passed: false, score: 0.1, summary: "No.", feedback: "Genérico.", questions: ["q1"], source: "ai", provider: "openai" },
        { ...dev(T + 2), moduleId: missionCell.id },
      ),
      // even a manual completion must NOT open the next node for a mission cell
      makeEvent("module.completed", {}, { ...dev(T + 3), moduleId: missionCell.id }),
    ];
    const next = project(events);
    const m = next.modules.find((x) => x.id === missionCell.id)!;
    expect(m.gatePassed).toBe(false);
    expect(m.status).toBe("completed"); // the cell itself is completed…

    const byId = new Map(next.modules.map((x) => [x.id, x]));
    // …yet the next node stays SEALED: a mission is mastered ONLY by passing the interrogation
    expect(nodeStatus(byId.get(nextCell.id)!, next.edges, byId)).toBe("sealed");
  });
});
