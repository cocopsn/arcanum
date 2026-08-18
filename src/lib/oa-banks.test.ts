import { describe, it, expect } from "vitest";
import { parseExercisesMd } from "@/lib/exercises-md";
import { execCode } from "@/lib/js-runner";
import { deepEqual, type CodeExercise, type ProductionExercise, type ChoiceExercise } from "@/lib/exercise";
import { SEED_EXERCISE_MD } from "@/lib/seed-exercises";

// The OA AMAZON banks — one per cell, anchored by the cell UUID, timed on EVERY exercise (the OA is
// a clocked exam; an untimed drill here would be dead text), Amazon-style business-rule statements,
// and NEVER a fake judge. The killer check is the ROUND-TRIP: every code exercise's JS reference
// solution EXECUTES against its own cases (Python refs were executed at authoring by
// scripts/oa-bank-check.mjs via the local interpreter — the seed trusts them per the house rule).
// Composition per nature: pattern cells carry template drills in BOTH languages; SQL and Work
// Simulation carry ZERO code (the engine can't run SQL, and situational judgement is never graded
// as code) and lean on choice + production instead; repo-debug carries the seeded-bug PATCH drills.

const OA = (n: number) => `ce000000-0000-4000-8000-${String(n + 1).padStart(12, "0")}`;
const LABELS: Record<string, string> = Object.fromEntries(Array.from({ length: 14 }, (_, n) => [OA(n), `oa-${n}`]));

const byModule = new Map<string, NonNullable<ReturnType<typeof parseExercisesMd>>>();
for (const md of SEED_EXERCISE_MD) {
  const bank = parseExercisesMd(md);
  if (bank?.meta.moduleId && bank.meta.moduleId.startsWith("ce000000-")) byModule.set(bank.meta.moduleId, bank);
}

describe("OA banks — all 14 seeded, anchored, timed, and self-consistent", () => {
  it("every OA cell has its bank, anchored by UUID, spine OA Amazon, substantial (≥9 exercises)", () => {
    for (const [cell, label] of Object.entries(LABELS)) {
      const bank = byModule.get(cell);
      expect(bank, `${label} bank seeded + anchored to ${cell}`).toBeTruthy();
      expect(bank!.meta.spine, `${label} spine`).toBe("OA Amazon");
      expect(bank!.exercises.length, `${label} is substantial`).toBeGreaterThanOrEqual(9);
    }
  });

  it("EVERY exercise in every OA bank declares a time target (the drill clock is armed path-wide)", () => {
    for (const [cell, label] of Object.entries(LABELS)) {
      for (const ex of byModule.get(cell)!.exercises) {
        expect(ex.timeTargetMin, `${label} «${ex.title}» is timed`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("ROUND-TRIP: every JS reference solution passes its OWN cases — a broken reference cannot ship", () => {
    let jsDrills = 0;
    for (const [cell, label] of Object.entries(LABELS)) {
      for (const ex of byModule.get(cell)!.exercises) {
        if (ex.kind !== "code" || ex.lang !== "js") continue;
        jsDrills++;
        const e = ex as CodeExercise;
        const real = e.testCases.filter((c) => !c.hint);
        const out = execCode(e.referenceSolution, e.functionName, real.map((c) => c.input));
        expect("results" in out, `${label} «${e.title}» reference parses`).toBe(true);
        if ("results" in out) {
          real.forEach((c, i) => {
            const r = out.results[i]!;
            expect(r.ok && deepEqual(r.value, c.expected), `${label} «${e.title}» caso ${i}: ${JSON.stringify(c)}`).toBe(true);
          });
        }
      }
    }
    expect(jsDrills, "the OA path ships a real fleet of executable drills").toBeGreaterThanOrEqual(12);
  });

  it("code drills are exam-shaped: both languages per drill, ≥6 cases each (edge cases live there)", () => {
    for (const [cell, label] of Object.entries(LABELS)) {
      const code = byModule.get(cell)!.exercises.filter((e): e is CodeExercise => e.kind === "code");
      const titles = new Map<string, Set<string>>();
      for (const e of code) {
        expect(e.testCases.length, `${label} «${e.title}» has ≥6 cases`).toBeGreaterThanOrEqual(6);
        if (!titles.has(e.title)) titles.set(e.title, new Set());
        titles.get(e.title)!.add(e.lang);
      }
      for (const [t, langs] of titles) {
        expect([...langs].sort(), `${label} «${t}» ships JS AND Python`).toEqual(["js", "python"]);
      }
    }
  });

  it("composition follows the nature: patterns carry drills; SQL and Work Simulation carry ZERO code; repo-debug carries the patch drills", () => {
    const codeCount = (n: number) => byModule.get(OA(n))!.exercises.filter((e) => e.kind === "code").length;
    const prodCount = (n: number) => byModule.get(OA(n))!.exercises.filter((e) => e.kind === "production").length;
    const choiceCount = (n: number) => byModule.get(OA(n))!.exercises.filter((e) => e.kind === "choice").length;
    for (let n = 0; n <= 10; n++) expect(codeCount(n), `oa-${n} has executable drills`).toBeGreaterThanOrEqual(4); // ≥2 blocks × 2 langs
    expect(codeCount(11), "oa-11 (SQL) has no fake SQL runner").toBe(0);
    expect(prodCount(11), "oa-11 produces the real query against a model").toBeGreaterThanOrEqual(2);
    expect(codeCount(12), "oa-12 patch drills (seeded bugs)").toBeGreaterThanOrEqual(6); // 3 blocks × 2 langs
    expect(prodCount(12), "oa-12 carries the exam protocol as production").toBeGreaterThanOrEqual(1);
    expect(codeCount(13), "oa-13 is NEVER graded as code").toBe(0);
    expect(prodCount(13), "oa-13 produces rules-sheet + scenario").toBeGreaterThanOrEqual(2);
    expect(choiceCount(13), "oa-13 trains most/least against the documented pattern").toBeGreaterThanOrEqual(8);
    for (let n = 0; n <= 13; n++) expect(choiceCount(n), `oa-${n} has recognition items`).toBeGreaterThanOrEqual(5);
  });

  it("choice items teach the discrimination: ≥3 options and a substantive rationale", () => {
    for (const [cell, label] of Object.entries(LABELS)) {
      const choice = byModule.get(cell)!.exercises.filter((e): e is ChoiceExercise => e.kind === "choice");
      for (const c of choice) {
        expect(c.options.length, `${label} «${c.title}» options`).toBeGreaterThanOrEqual(3);
        expect(c.rationale.trim().length, `${label} «${c.title}» rationale teaches`).toBeGreaterThanOrEqual(120);
      }
    }
  });

  it("production items are complete (model + rule + rubric) — a bare textarea would be a placebo", () => {
    for (const [cell, label] of Object.entries(LABELS)) {
      const prods = byModule.get(cell)!.exercises.filter((e): e is ProductionExercise => e.kind === "production");
      for (const p of prods) {
        expect(p.modelAnswer.trim().length, `${label} «${p.title}» model`).toBeGreaterThan(0);
        expect(p.rule.trim().length, `${label} «${p.title}» rule`).toBeGreaterThan(0);
        expect(p.rubric.length, `${label} «${p.title}» rubric`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("no bank ever claims to BE the judge: the intro of each bank names the real judge (the OA)", () => {
    for (const md of SEED_EXERCISE_MD) {
      const bank = parseExercisesMd(md);
      if (!bank?.meta.moduleId?.startsWith("ce000000-")) continue;
      expect(md, `${bank.meta.title} names the real judge`).toMatch(/juez real es el OA|juez real|OA de Amazon/);
    }
  });
});
