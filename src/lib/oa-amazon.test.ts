import { describe, it, expect } from "vitest";
import { project } from "@/core/projector";
import { makeEvent } from "@/core/event";
import { nodeStatus } from "@/core/roadmap";
import { SEED_EVENTS } from "@/lib/seed";
import { SPINES } from "@/lib/spines";
import { contentForModule } from "@/lib/subject-content";
import { buildInterrogationContext } from "@/lib/mission";
import { resolveCellId } from "@/lib/cell-slugs";
import { themeForGoal } from "@/lib/subject-themes";

// OA AMAZON — the assault spine for the Amazon SDE Intern OA. What this file pins down:
// (1) structure: 14 first-class mission cells (the gate adversarial is OFFERED on every node — the
//     log-only ceiling of FrED Operativo is exactly what this spine avoids);
// (2) the DAG mirrors the real exam: main pattern ladder + three branches (SQL/repo off OA-1,
//     Work Simulation off OA-0) — fog-of-war fail-closed on every front;
// (3) calibration: the core patterns interrogate in 'pattern' mode with their OWN judge (the OA
//     clock), never inheriting the Codeforces default that belongs to Competitiva;
// (4) natures are structural: a_mano ladder, mixto repo-debug (direct+audit vs patch), delegable
//     Work Simulation (comprehension gate);
// (5) the published slug contract (oa-0..oa-13) resolves the user's book names to these cells.

const oa = SPINES.find((s) => s.goalTitle === "OA Amazon")!;
const comp = SPINES.find((s) => s.goalTitle.startsWith("Competitiva"))!;
const rm = project(SEED_EVENTS);

const id = (n: number) => `ce000000-0000-4000-8000-${String(n + 1).padStart(12, "0")}`; // oa-N → cell id
const OA0 = id(0), OA1 = id(1), OA2 = id(2), OA10 = id(10), OA11 = id(11), OA12 = id(12), OA13 = id(13);

const statusOf = (m: ReturnType<typeof project>, cellId: string) => {
  const byId = new Map(m.modules.map((x) => [x.id, x]));
  return nodeStatus(byId.get(cellId)!, m.edges, byId);
};
const passGate = (cellId: string, ts: number) =>
  makeEvent(
    "gate.evaluated",
    { passed: true, score: 1, summary: "ok", feedback: "", source: "ai", provider: "t" },
    { ts, deviceId: "test", goalId: oa.goalId, moduleId: cellId },
  );
const T0 = SEED_EVENTS[SEED_EVENTS.length - 1]!.ts + 50_000;

describe("OA Amazon — the spine (structure + rigor)", () => {
  it("is a sibling goal of ITC with 14 first-class cells, ALL heavy missions (gate offered everywhere)", () => {
    expect(oa.goalId).toBe("a0000000-0000-4000-8000-000000000005");
    expect(oa.cells).toHaveLength(14);
    expect(oa.cells.every((c) => c.mission && c.mission.assignment.length > 0 && c.mission.deliverable.length > 0)).toBe(true);
    expect(oa.cells.every((c) => c.id.startsWith("ce000000-"))).toBe(true);
    // and the seed projects every one of them as kind:'mission' → mastered ONLY by its gate
    const cells = rm.modules.filter((m) => m.id.startsWith("ce000000-"));
    expect(cells).toHaveLength(14);
    expect(cells.every((m) => m.kind === "mission")).toBe(true);
  });

  it("every cell is anchored to real, https-only sources (curl-verified 200 at authoring)", () => {
    for (const c of oa.cells) {
      expect(c.sourceUrls.length, `${c.title} has sources`).toBeGreaterThanOrEqual(2);
      for (const u of c.sourceUrls) expect(u).toMatch(/^https:\/\//);
    }
  });

  it("EVERY OA cell interrogates in 'exam' mode (the FAANG bar) with its OWN honest judge — never the Codeforces default", () => {
    for (const c of oa.cells) {
      expect(c.interrogationMode, `${c.title} is exam-calibrated`).toBe("exam");
      expect((c.judge?.label ?? "").length, `${c.title} names its own judge`).toBeGreaterThan(0);
      expect(c.judge!.label).not.toMatch(/Codeforces/);
    }
    // the core pattern ladder names the OA clock as its judge explicitly
    for (let n = 0; n <= 10; n++) {
      const c = oa.cells.find((x) => x.id === id(n))!;
      expect(c.judge!.label, `${c.title} judge is the OA clock`).toMatch(/OA de Amazon|carácter por carácter|reloj/);
    }
    // Competitiva keeps 'pattern' + its Codeforces default (no judge override — the HUD falls back)
    expect(comp.cells.every((c) => c.interrogationMode === "pattern" && c.judge === undefined)).toBe(true);
  });

  it("the judge flows to TopicContent (the arena HUD reads it), and Competitiva's stays null → default", () => {
    expect(contentForModule(OA2)!.judge?.label).toMatch(/el reloj/);
    expect(contentForModule(comp.cells[0]!.id)!.judge).toBeNull();
  });

  it("natures are structural: a_mano ladder · mixto repo-debug (with its two parts) · delegable Work Simulation", () => {
    for (const n of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
      expect(oa.cells.find((x) => x.id === id(n))!.nature, `oa-${n} is a_mano`).toBe("a_mano");
    }
    const repo = oa.cells.find((x) => x.id === OA12)!;
    expect(repo.nature).toBe("mixto");
    expect(repo.parts).toHaveLength(2);
    expect(repo.parts!.map((p) => p.nature).sort()).toEqual(["a_mano", "delegable"]);
    expect(oa.cells.find((x) => x.id === OA13)!.nature).toBe("delegable");
  });

  it("nature + mode reach the REAL interrogation context (not cosmetic)", () => {
    const pat = buildInterrogationContext(rm, OA2, "traje mi tiempo")!;
    expect(pat.mode).toBe("exam");
    expect(pat.nature).toBe("a_mano");
    const ws = buildInterrogationContext(rm, OA13, "mi hoja de reglas")!;
    expect(ws.mode).toBe("exam"); // the whole path holds the exam bar…
    expect(ws.nature).toBe("delegable"); // …and the nature pivots dimension 2 away from code
    expect(ws.assignment).toMatch(/DELEGABLE/); // the stance is folded into what the interrogator reads
    const repo = buildInterrogationContext(rm, OA12, "los tres bugs")!;
    expect(repo.nature).toBe("mixto");
    expect(repo.assignment).toMatch(/Sub-partes/); // mixto spells its parts out to the evaluator
  });

  it("the log-derived DRILL SIGNAL reaches the exam interrogator (mechanical evidence, not self-reported)", () => {
    // at seed: zero verified reinforcements — the signal says so honestly
    const fresh = buildInterrogationContext(rm, OA2, "evidencia")!;
    expect(fresh.assignment).toMatch(/SEÑAL DEL MOTOR LOCAL/);
    expect(fresh.assignment).toMatch(/0 refuerzo/);
    // one real checkpoint.passed on the cell → the signal counts it
    const withDrill = project([
      ...SEED_EVENTS,
      makeEvent("checkpoint.passed", { score: 1, kind: "exercise" }, { ts: T0, deviceId: "test", goalId: oa.goalId, moduleId: OA2 }),
    ]);
    const after = buildInterrogationContext(withDrill, OA2, "evidencia")!;
    expect(after.assignment).toMatch(/1 refuerzo/);
    // a NON-exam mission (FrED) carries no drill signal — scoped to the exam bar
    const fredMission = SPINES.find((s) => s.goalTitle === "FrED Factory")!.cells.find((c) => c.mission)!;
    const fred = buildInterrogationContext(rm, fredMission.id, "evidencia")!;
    expect(fred.assignment).not.toMatch(/SEÑAL DEL MOTOR LOCAL/);
  });
});

describe("OA Amazon — the DAG mirrors the real exam (three parallel fronts, fail-closed)", () => {
  const prereqsOf = (to: string) => rm.edges.filter((e) => e.to === to).map((e) => e.from).sort();

  it("main ladder is linear oa-0→oa-1→oa-2→…→oa-10; branches hang off oa-1 (SQL, repo) and oa-0 (work sim)", () => {
    expect(prereqsOf(OA1)).toEqual([OA0]);
    expect(prereqsOf(OA2)).toEqual([OA1]);
    for (let n = 3; n <= 10; n++) expect(prereqsOf(id(n)), `oa-${n} gated by oa-${n - 1}`).toEqual([id(n - 1)]);
    expect(prereqsOf(OA11)).toEqual([OA1]); // SQL branch
    expect(prereqsOf(OA12)).toEqual([OA1]); // repo-debug branch
    expect(prereqsOf(OA13)).toEqual([OA0]); // work-sim branch — parallel to the whole coding ladder
    expect(prereqsOf(OA0)).toEqual([]); // the root is open
  });

  it("fog-of-war: only oa-0 available at seed; everything else sealed", () => {
    expect(statusOf(rm, OA0)).toBe("available");
    for (const n of [1, 2, 5, 10, 11, 12, 13]) expect(statusOf(rm, id(n)), `oa-${n} sealed at seed`).toBe("sealed");
  });

  it("passing oa-0's gate unseals oa-1 AND the work-sim branch — but NOT oa-2 (each front re-earns its own gates)", () => {
    const m = project([...SEED_EVENTS, passGate(OA0, T0)]);
    expect(statusOf(m, OA1)).toBe("available");
    expect(statusOf(m, OA13)).toBe("available"); // the exam's third section opens early, in parallel
    expect(statusOf(m, OA2)).toBe("sealed");
    expect(statusOf(m, OA11)).toBe("sealed"); // SQL still needs oa-1
  });

  it("passing oa-1 unseals the three second-tier fronts (oa-2, SQL, repo) — the ladder beyond stays sealed", () => {
    const m = project([...SEED_EVENTS, passGate(OA0, T0), passGate(OA1, T0 + 1)]);
    expect(statusOf(m, OA2)).toBe("available");
    expect(statusOf(m, OA11)).toBe("available");
    expect(statusOf(m, OA12)).toBe("available");
    expect(statusOf(m, id(3))).toBe("sealed");
    expect(statusOf(m, OA10)).toBe("sealed");
  });

  it("mission cells do NOT master by completion — only the gate opens the next node (zero placebo)", () => {
    const completed = makeEvent("module.completed", {}, { ts: T0, deviceId: "test", goalId: oa.goalId, moduleId: OA0 });
    const m = project([...SEED_EVENTS, completed]);
    expect(statusOf(m, OA1)).toBe("sealed"); // completing without the interrogation moves nothing
  });
});

describe("OA Amazon — the published slug contract (books + banks anchor here)", () => {
  it("resolves the user's real book names (full temario slugs) to their cells", () => {
    expect(resolveCellId("oa-0-fundamentos")).toBe(OA0);
    expect(resolveCellId("oa-1-arrays-hashmap")).toBe(OA1);
    expect(resolveCellId("oa-4-binary-search-answer")).toBe(id(4));
    expect(resolveCellId("oa-13-work-simulation")).toBe(OA13);
  });

  it("digit boundaries are safe: oa-10-dp → oa-10, oa-1-… → oa-1 (never cross-matched)", () => {
    expect(resolveCellId("oa-10-dp")).toBe(OA10);
    expect(resolveCellId("oa-1-arrays-hashmap")).toBe(OA1);
    expect(resolveCellId("oa-11-sql")).toBe(OA11);
    expect(resolveCellId("oa-12-repo-debug")).toBe(OA12);
  });

  it("bare short slugs work too, and an unknown handle stays loose (null)", () => {
    expect(resolveCellId("oa-7")).toBe(id(7));
    expect(resolveCellId("oa-99-inventado")).toBeNull();
  });

  it("the OA world resolves its own theme (the coliseum), not the default", () => {
    expect(themeForGoal("OA Amazon").slug).toBe("oa");
  });
});
