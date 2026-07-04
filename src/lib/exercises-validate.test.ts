import { describe, it, expect } from "vitest";
import { parseExercisesMd } from "@/lib/exercises-md";
import { validateBank, type ExecRunner } from "@/lib/exercises-validate";
import type { TestCase, RunResult } from "@/lib/exercise";

const md = (...lines: string[]) => lines.join("\n");
const HEAD = (langs: string) => ["---", "module_id: m", "spine: ITC", "title: V", "kind: exercises", `languages: [${langs}]`, "generated_by: t", "version: 1", "---", ""];

const jsBank = (solution: string) =>
  md(...HEAD("javascript"), "## Doblar", "type: code", "", "Devuelve x*2.", "", "### Firma", "```javascript", "function doblar(x) {}", "```", "", "### Casos", "```json", '[{ "input": [3], "expected": 6 }, { "input": [5], "expected": 10 }]', "```", "", "### Solución", "```javascript", solution, "```", "");

const pyBank = md(...HEAD("python"), "## PyDoblar", "type: code", "", "Devuelve x*2.", "", "### Firma", "```python", "def doblar(x):", "    pass", "```", "", "### Casos", "```json", '[{ "input": [3], "expected": 6 }]', "```", "", "### Solución", "```python", "def doblar(x):", "    return x * 2", "```", "");

const passRunner: ExecRunner = async (_code, _fn, cases): Promise<RunResult> => ({
  syntaxError: null,
  cases: cases.filter((c: TestCase) => !c.hint).map((c) => ({ input: c.input, expected: c.expected, output: c.expected, pass: true })),
});

describe("exercises-validate — auto-consistency gate (reference must pass its own cases)", () => {
  it("ACCEPTS a bank whose JS reference passes all its cases (validated via execCode, real)", async () => {
    const bank = parseExercisesMd(jsBank("function doblar(x) { return x * 2; }"))!;
    const v = await validateBank(bank);
    expect(v.ok).toBe(true);
  });

  it("REJECTS a bank whose JS reference fails a case — names the exercise + the exact case", async () => {
    const bank = parseExercisesMd(jsBank("function doblar(x) { return x * 3; }"))!; // wrong: x*3
    const v = await validateBank(bank);
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.errors[0]).toContain("Doblar");
      expect(v.errors[0]).toContain("6"); // esperado
      expect(v.errors[0]).toContain("9"); // obtenido (3*3)
    }
  });

  it("REJECTS a bank whose JS reference doesn't even parse (syntax error surfaced)", async () => {
    const bank = parseExercisesMd(jsBank("function doblar(x) { return x * ; }"))!;
    const v = await validateBank(bank);
    expect(v.ok).toBe(false);
  });

  it("python without a runtime and not trusted → HONEST error (never silently accepted)", async () => {
    const bank = parseExercisesMd(pyBank)!;
    const v = await validateBank(bank); // no pyRun, no trust
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors[0]).toMatch(/runtime|conéctate/i);
  });

  it("python is skipped when trusted (bundled seed — build-time validated)", async () => {
    const bank = parseExercisesMd(pyBank)!;
    const v = await validateBank(bank, { trustPython: true });
    expect(v.ok).toBe(true);
  });

  it("python is validated when a runner is provided (import path)", async () => {
    const bank = parseExercisesMd(pyBank)!;
    const v = await validateBank(bank, { pyRun: passRunner });
    expect(v.ok).toBe(true);
  });
});
