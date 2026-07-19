import { describe, it, expect } from "vitest";
import { parseExercisesMd } from "@/lib/exercises-md";
import type { CodeExercise, ChoiceExercise, ProductionExercise } from "@/lib/exercise";

// build a bank .md from lines (fence lines as plain strings avoid template-literal backtick escaping)
const md = (...lines: string[]) => lines.join("\n");

const HEAD = [
  "---",
  "module_id: mod-1",
  "spine: ITC",
  "title: Banco de prueba",
  "kind: exercises",
  "languages: [javascript, python]",
  "generated_by: test",
  "version: 1",
  "---",
  "",
];

const CODE_EX = [
  "## Doblar",
  "type: code",
  "",
  "Devuelve x por 2.",
  "",
  "### Especificación",
  "doblar(x): x + x, o x*2.",
  "",
  "### Firma",
  "```javascript",
  "function doblar(x) {}",
  "```",
  "```python",
  "def doblar_num(x):",
  "    pass",
  "```",
  "",
  "### Casos",
  "```json",
  '[{ "input": [3], "expected": 6 }, { "input": [0], "expected": 0 }]',
  "```",
  "",
  "### Solución",
  "```javascript",
  "function doblar(x) { return x * 2; }",
  "```",
  "```python",
  "def doblar_num(x):",
  "    return x * 2",
  "```",
  "",
  "### Pistas",
  "- Multiplica por dos.",
  "",
];

const CHOICE_EX = ["## Recorrer una vez", "type: multiple_choice", "", "¿Complejidad de un recorrido?", "", "### Opciones", "- [x] O(n)", "- O(1)", "- O(n²)", "", "### Justificación", "Un recorrido = n pasos.", ""];

const PRODUCTION_EX = ["## Construye una frase", "type: production", "", "Escribe una frase con el objeto en Akkusativ.", "", "### Modelo", "Ich sehe den Mann.", "", "### Regla", "En Akkusativ solo el masculino cambia: der → den.", "", "### Rúbrica", "- El objeto masculino usa den.", "- El sustantivo va con mayúscula.", ""];

describe("exercises-md — the curated exercise-bank contract (pure parser)", () => {
  it("parses a valid bank: a code exercise → one CodeExercise per language + a choice", () => {
    const bank = parseExercisesMd(md(...HEAD, ...CODE_EX, ...CHOICE_EX));
    expect(bank).not.toBeNull();
    expect(bank!.meta.moduleId).toBe("mod-1");
    expect(bank!.meta.languages).toEqual(["js", "python"]);
    // 2 code (js+py) + 1 choice
    expect(bank!.exercises).toHaveLength(3);
    const js = bank!.exercises.find((e) => e.kind === "code" && e.lang === "js") as CodeExercise;
    const py = bank!.exercises.find((e) => e.kind === "code" && e.lang === "python") as CodeExercise;
    expect(js.functionName).toBe("doblar"); // derived from the JS signature
    expect(py.functionName).toBe("doblar_num"); // python name differs — derived independently
    expect(js.moduleId).toBe("mod-1");
    expect(js.starter).toContain("function doblar(x)");
    expect(js.referenceSolution).toContain("return x * 2");
    expect(js.pseudocode).toContain("doblar(x)");
    expect(js.hints).toEqual(["Multiplica por dos."]);
    expect(js.testCases).toHaveLength(2);
    const choice = bank!.exercises.find((e) => e.kind === "choice") as ChoiceExercise;
    expect(choice.answer).toBe(0); // the [x] option (0-based)
    expect(choice.options).toEqual(["O(n)", "O(1)", "O(n²)"]); // marker stripped
    expect(choice.rationale).toContain("n pasos");
  });

  it("parses a PRODUCTION exercise (free-response) → model + rule + rubric, no auto-grading", () => {
    const bank = parseExercisesMd(md(...HEAD, ...PRODUCTION_EX));
    expect(bank).not.toBeNull();
    expect(bank!.exercises).toHaveLength(1);
    const prod = bank!.exercises[0] as ProductionExercise;
    expect(prod.kind).toBe("production");
    expect(prod.statement).toContain("Akkusativ");
    expect(prod.modelAnswer).toBe("Ich sehe den Mann.");
    expect(prod.rule).toContain("der → den");
    expect(prod.rubric).toEqual(["El objeto masculino usa den.", "El sustantivo va con mayúscula."]);
    expect(prod.moduleId).toBe("mod-1"); // anchored by the bank meta
  });

  it("rejects a PRODUCTION exercise missing the model, the rule, or the rubric (no bare textarea placebo)", () => {
    const noModel = ["## Sin modelo", "type: production", "", "Produce algo.", "", "### Regla", "una regla", "", "### Rúbrica", "- un criterio", ""];
    const noRule = ["## Sin regla", "type: production", "", "Produce algo.", "", "### Modelo", "un modelo", "", "### Rúbrica", "- un criterio", ""];
    const noRubric = ["## Sin rúbrica", "type: production", "", "Produce algo.", "", "### Modelo", "un modelo", "", "### Regla", "una regla", ""];
    expect(parseExercisesMd(md(...HEAD, ...noModel))).toBeNull();
    expect(parseExercisesMd(md(...HEAD, ...noRule))).toBeNull();
    expect(parseExercisesMd(md(...HEAD, ...noRubric))).toBeNull();
  });

  it("is FENCE-AWARE: a `##`/`###` line at column 0 INSIDE a code fence is NOT a boundary", () => {
    const tricky = [
      "## Con fence engañoso",
      "type: code",
      "",
      "Identidad.",
      "",
      "### Firma",
      "```python",
      "def f(x):",
      "    pass",
      "```",
      "",
      "### Casos",
      "```json",
      '[{ "input": [1], "expected": 1 }]',
      "```",
      "",
      "### Solución",
      "```python",
      "def f(x):",
      "    return x",
      "## no es un ejercicio nuevo",
      "### tampoco una seccion",
      "```",
      "",
    ];
    const bank = parseExercisesMd(md(...HEAD, ...tricky));
    expect(bank).not.toBeNull(); // the `##`/`###` inside the fence did NOT spawn a phantom (malformed) exercise
    expect(bank!.exercises).toHaveLength(1);
    expect((bank!.exercises[0] as CodeExercise).referenceSolution).toContain("## no es un ejercicio nuevo");
  });

  it("emits a JS-ONLY exercise when only a javascript signature/solution is present (e.g. trees)", () => {
    const jsonly = ["## Altura", "type: code", "", "Altura del árbol.", "", "### Firma", "```javascript", "function height(n) {}", "```", "", "### Casos", "```json", '[{ "input": [null], "expected": -1 }]', "```", "", "### Solución", "```javascript", "function height(n) { return n === null ? -1 : 0; }", "```", ""];
    const bank = parseExercisesMd(md(...HEAD, ...jsonly));
    expect(bank!.exercises).toHaveLength(1);
    expect((bank!.exercises[0] as CodeExercise).lang).toBe("js");
  });

  it("parses saved improvement patterns (regex + message)", () => {
    const withPat = [...CODE_EX];
    withPat.push("### Patrones", "- `\\.map\\(` — un map es idiomático aquí.", "");
    const bank = parseExercisesMd(md(...HEAD, ...withPat));
    const js = bank!.exercises.find((e) => e.kind === "code" && e.lang === "js") as CodeExercise;
    expect(js.patterns).toEqual([{ test: "\\.map\\(", message: "un map es idiomático aquí." }]);
  });

  it("rejects (→ null) a .md with no frontmatter", () => {
    expect(parseExercisesMd("# solo texto\n\n## hola\ntype: code\n")).toBeNull();
  });

  it("rejects (→ null) a non-exercise .md (kind is not exercises)", () => {
    const book = md("---", "module_id: x", "spine: ITC", "title: Un libro", "kind: book", "---", "", "## Núcleo", "cuerpo");
    expect(parseExercisesMd(book)).toBeNull();
  });

  it("ALL-OR-NOTHING: one malformed exercise rejects the WHOLE bank (a code exercise missing its Casos)", () => {
    const broken = ["## Sin casos", "type: code", "", "Prompt.", "", "### Firma", "```javascript", "function g(x) {}", "```", "", "### Solución", "```javascript", "function g(x) { return x; }", "```", ""];
    expect(parseExercisesMd(md(...HEAD, ...CHOICE_EX, ...broken))).toBeNull();
  });

  it("rejects a choice with zero or multiple correct markers (exactly one [x] required)", () => {
    const none = ["## Sin marca", "type: multiple_choice", "", "¿Cuál?", "", "### Opciones", "- A", "- B", "", "### Justificación", "x"];
    const two = ["## Dos marcas", "type: multiple_choice", "", "¿Cuál?", "", "### Opciones", "- [x] A", "- [x] B", "", "### Justificación", "x"];
    expect(parseExercisesMd(md(...HEAD, ...none))).toBeNull();
    expect(parseExercisesMd(md(...HEAD, ...two))).toBeNull();
  });

  it("FAIL-CLOSED on a stray/unbalanced fence: an odd fence-marker count rejects the whole bank (no silent drop)", () => {
    // a valid bank parses…
    expect(parseExercisesMd(md(...HEAD, ...CODE_EX, ...CHOICE_EX))).not.toBeNull();
    // …but adding ONE stray ``` line (odd total) rejects it rather than silently dropping/truncating exercises
    const strayed = md(...HEAD, ...CODE_EX, "```", ...CHOICE_EX);
    expect(parseExercisesMd(strayed)).toBeNull();
  });

  it("rejects a choice whose correct [x] option has empty text (would render a blank 'correct' button)", () => {
    const blank = ["## Marca vacía", "type: multiple_choice", "", "¿Cuál?", "", "### Opciones", "- [x] ", "- Algo", "", "### Justificación", "x"];
    expect(parseExercisesMd(md(...HEAD, ...blank))).toBeNull();
  });

  it("gives each generated exercise a stable, unique id (so the React key is stable across re-parses)", () => {
    const a = parseExercisesMd(md(...HEAD, ...CODE_EX, ...CHOICE_EX))!;
    const b = parseExercisesMd(md(...HEAD, ...CODE_EX, ...CHOICE_EX))!;
    const idsA = a.exercises.map((e) => e.id);
    expect(new Set(idsA).size).toBe(idsA.length); // unique within the bank
    expect(idsA).toEqual(b.exercises.map((e) => e.id)); // deterministic across re-parses
  });
});
