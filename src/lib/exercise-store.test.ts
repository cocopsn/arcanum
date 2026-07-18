import { describe, it, expect } from "vitest";
import { parseExercisesMd } from "@/lib/exercises-md";
import { execCode } from "@/lib/js-runner";
import { deepEqual, type CodeExercise } from "@/lib/exercise";
import { SEED_EXERCISE_MD, seedExerciseBanks } from "@/lib/seed-exercises";
import { saveExerciseBank, loadBankForModule, getBanksForModule, listBanks } from "@/lib/exercise-store";

const C = { c1: "ca000000-0000-4000-8000-000000000002", c2: "ca000000-0000-4000-8000-000000000003", c3: "ca000000-0000-4000-8000-000000000004", c4: "ca000000-0000-4000-8000-000000000005" };

describe("exercise-store — seed round-trip + ingestion", () => {
  it("every seed bank .md parses and satisfies the contract", () => {
    expect(SEED_EXERCISE_MD).toHaveLength(11); // 4 ITC (C1-C4) + 7 FrED Operativo (op-0..op-5, op-7)
    for (const md of SEED_EXERCISE_MD) {
      const bank = parseExercisesMd(md);
      expect(bank, "seed bank parses").not.toBeNull();
      expect(bank!.exercises.length).toBeGreaterThan(0);
    }
  });

  it("ROUND-TRIP: every seed JS reference solution PASSES its own cases via the real engine (self-consistent)", () => {
    let jsCount = 0;
    for (const md of SEED_EXERCISE_MD) {
      const bank = parseExercisesMd(md)!;
      for (const ex of bank.exercises) {
        if (ex.kind !== "code" || ex.lang !== "js") continue;
        jsCount++;
        const e = ex as CodeExercise;
        const out = execCode(e.referenceSolution, e.functionName, e.testCases.map((c) => c.input));
        expect("results" in out, `${e.title}: reference parses`).toBe(true);
        if ("results" in out) {
          e.testCases.forEach((c, i) => {
            const r = out.results[i]!;
            expect(r.ok && deepEqual(r.value, c.expected), `${e.title} caso ${i}: ${JSON.stringify(c)}`).toBe(true);
          });
        }
      }
    }
    expect(jsCount).toBeGreaterThanOrEqual(6); // the migrated C1-C4 code exercises (JS side)
  });

  it("the migrated bank covers ITC C1-C4 with the expected counts (16 runtime entries)", () => {
    const byModule: Record<string, number> = {};
    let itcTotal = 0;
    const itcModules = new Set(Object.values(C));
    for (const md of SEED_EXERCISE_MD) {
      const bank = parseExercisesMd(md)!;
      byModule[bank.meta.moduleId!] = bank.exercises.length;
      if (itcModules.has(bank.meta.moduleId!)) itcTotal += bank.exercises.length;
    }
    expect(byModule[C.c1]).toBe(4); // 2 choice + 1 code×2 langs
    expect(byModule[C.c2]).toBe(4); // 2 code×2 langs
    expect(byModule[C.c3]).toBe(5); // 2 code×2 langs + 1 choice
    expect(byModule[C.c4]).toBe(3); // 2 code (js-only) + 1 choice
    expect(itcTotal).toBe(16);
  });

  it("every FrED Operativo bank (op-0..op-5, op-7) parses, anchors to its seeded cell, and is non-trivial", () => {
    const OP = [
      "cb000000-0000-4000-8000-000000000009", "cb000000-0000-4000-8000-00000000000a", "cb000000-0000-4000-8000-00000000000b",
      "cb000000-0000-4000-8000-00000000000c", "cb000000-0000-4000-8000-00000000000d", "cb000000-0000-4000-8000-00000000000e",
      "cb000000-0000-4000-8000-00000000000f",
    ];
    const seen = new Set<string>();
    for (const md of SEED_EXERCISE_MD) {
      const bank = parseExercisesMd(md)!;
      if (!OP.includes(bank.meta.moduleId!)) continue;
      seen.add(bank.meta.moduleId!);
      expect(bank.exercises.length, `${bank.meta.title} has exercises`).toBeGreaterThanOrEqual(4);
    }
    expect([...seen].sort()).toEqual([...OP].sort()); // all 7 Operativo cells have a bank
  });

  it("seed → store → loadBankForModule returns the cell's exercises anchored by module_id", async () => {
    await seedExerciseBanks();
    const banks = await listBanks();
    expect(banks.length).toBeGreaterThanOrEqual(4);
    const c3 = await loadBankForModule(C.c3);
    expect(c3.length).toBe(5);
    expect(c3.every((e) => e.moduleId === C.c3)).toBe(true);
    // idempotent: re-seeding does not duplicate
    await seedExerciseBanks();
    expect((await getBanksForModule(C.c3)).length).toBe(1);
  });

  it("saveExerciseBank REJECTS a broken bank (reference fails its own cases) — never persisted", async () => {
    const broken = ["---", "module_id: broken-mod", "spine: ITC", "title: Roto", "kind: exercises", "languages: [javascript]", "generated_by: t", "version: 1", "---", "", "## Malo", "type: code", "", "x*2", "", "### Firma", "```javascript", "function f(x) {}", "```", "", "### Casos", "```json", '[{ "input": [2], "expected": 4 }]', "```", "", "### Solución", "```javascript", "function f(x) { return x + 1; }", "```", ""].join("\n");
    const res = await saveExerciseBank(broken, { source: "import" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.details?.[0]).toContain("Malo");
    expect(await getBanksForModule("broken-mod")).toHaveLength(0); // nothing landed
  });
});
