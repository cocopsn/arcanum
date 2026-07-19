import { describe, it, expect } from "vitest";
import { parseExercisesMd } from "@/lib/exercises-md";
import { execCode } from "@/lib/js-runner";
import { deepEqual, type CodeExercise, type ProductionExercise } from "@/lib/exercise";
import { SEED_EXERCISE_MD } from "@/lib/seed-exercises";

// The banks THIS milestone added (CC — Competitiva CP1..CP8 + ITC C7/C8 + Alemán A1/A2), each with the
// cell UUID it MUST anchor to (mirrors lib/cell-slugs.ts + lib/spines.ts). Banks anchor by exact module_id.
const COMPETITIVA: Record<string, string> = {
  "cd000000-0000-4000-8000-000000000001": "cp1 · two pointers",
  "cd000000-0000-4000-8000-000000000002": "cp2 · binary search",
  "cd000000-0000-4000-8000-000000000003": "cp3 · prefix sums",
  "cd000000-0000-4000-8000-000000000004": "cp4 · sorting/greedy",
  "cd000000-0000-4000-8000-000000000005": "cp5 · dsu",
  "cd000000-0000-4000-8000-000000000006": "cp6 · grafos",
  "cd000000-0000-4000-8000-000000000007": "cp7 · dp",
  "cd000000-0000-4000-8000-000000000008": "cp8 · segment tree",
};
const ITC_NEW = { "ca000000-0000-4000-8000-000000000008": "itc-c7", "ca000000-0000-4000-8000-000000000009": "itc-c8" };
const ALEMAN = { "cc000000-0000-4000-8000-000000000001": "de-a1", "cc000000-0000-4000-8000-000000000006": "de-a2" };

// index every seed bank by its (already-parsed) module_id
const byModule = new Map<string, ReturnType<typeof parseExercisesMd>>();
for (const md of SEED_EXERCISE_MD) {
  const bank = parseExercisesMd(md);
  if (bank?.meta.moduleId) byModule.set(bank.meta.moduleId, bank);
}

describe("new banks (CC) — Competitiva + ITC C7/C8 + Alemán ingest, anchor, and hold up", () => {
  it("all 12 new banks are seeded, anchor to their cell UUID, and are substantial (>=6 exercises)", () => {
    const all = { ...COMPETITIVA, ...ITC_NEW, ...ALEMAN };
    for (const [cell, label] of Object.entries(all)) {
      const bank = byModule.get(cell);
      expect(bank, `${label} bank is seeded + anchored to ${cell}`).toBeTruthy();
      expect(bank!.exercises.length, `${label} is substantial`).toBeGreaterThanOrEqual(6);
    }
  });

  it("ROUND-TRIP: every JS reference solution in the new banks passes its OWN cases (self-consistent)", () => {
    let jsDrills = 0;
    for (const cell of [...Object.keys(COMPETITIVA), ...Object.keys(ITC_NEW)]) {
      const bank = byModule.get(cell)!;
      for (const ex of bank.exercises) {
        if (ex.kind !== "code" || ex.lang !== "js") continue;
        jsDrills++;
        const e = ex as CodeExercise;
        const out = execCode(e.referenceSolution, e.functionName, e.testCases.map((c) => c.input));
        expect("results" in out, `«${e.title}» reference parses`).toBe(true);
        if ("results" in out) {
          e.testCases.forEach((c, i) => {
            const r = out.results[i]!;
            expect(r.ok && deepEqual(r.value, c.expected), `«${e.title}» caso ${i}: ${JSON.stringify(c)}`).toBe(true);
          });
        }
      }
    }
    expect(jsDrills, "the Competitiva/ITC template + implement drills are present + validated").toBeGreaterThanOrEqual(16);
  });

  it("Competitiva banks train recognition AND a template drill — but NEVER fake the external judge", () => {
    for (const [cell, label] of Object.entries(COMPETITIVA)) {
      const bank = byModule.get(cell)!;
      const code = bank.exercises.filter((e) => e.kind === "code");
      const choice = bank.exercises.filter((e) => e.kind === "choice");
      expect(code.length, `${label} has >=1 pure-function template drill`).toBeGreaterThanOrEqual(1);
      expect(choice.length, `${label} has pattern-recognition/trap items`).toBeGreaterThanOrEqual(3);
      // a template drill has real test cases (a local unit check), it does NOT claim to BE the contest judge
      for (const e of code as CodeExercise[]) expect(e.testCases.length, `${label} «${e.title}» has cases`).toBeGreaterThanOrEqual(6);
    }
  });

  it("Alemán banks are PRODUCTION-led (build-your-own + explain-why); each production ex has model + rule + rubric", () => {
    for (const [cell, label] of Object.entries(ALEMAN)) {
      const bank = byModule.get(cell)!;
      const prod = bank.exercises.filter((e): e is ProductionExercise => e.kind === "production");
      const code = bank.exercises.filter((e) => e.kind === "code");
      expect(prod.length, `${label} is production-led`).toBeGreaterThanOrEqual(5);
      expect(code.length, `${label} has NO code exercises (German is not code)`).toBe(0);
      for (const p of prod) {
        expect(p.modelAnswer.trim().length, `${label} «${p.title}» reveals a model to compare against`).toBeGreaterThan(0);
        expect(p.rule.trim().length, `${label} «${p.title}» states the rule / the why`).toBeGreaterThan(0);
        expect(p.rubric.length, `${label} «${p.title}» has explicit self-check criteria`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
