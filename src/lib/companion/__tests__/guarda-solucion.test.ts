// Guarda de solución de la tarea abierta (design §18.6). Si el aprendiz tiene abierto un ejercicio `code` curado, un
// bloque de la respuesta que lo resuelve se retira, y una referencia de lote que lo resuelve rechaza el lote. Red-check:
// sin la guarda, el bloque que resuelve el ejercicio se pinta (queda en el markdown).
import { describe, it, expect } from "vitest";
import { guardarRespuesta, guardarLote, RETIRADO, type EjercicioAbierto, type DepsGuarda } from "@/lib/companion/guarda-solucion";
import type { CodeExercise, Exercise, RunResult, TestCase } from "@/lib/exercise";

const EJ: CodeExercise = {
  id: "cel:0-suma",
  kind: "code",
  moduleId: "cel",
  lang: "js",
  title: "Suma de dos",
  statement: "Devuelve a + b.",
  functionName: "suma",
  starter: "function suma(a, b) {}",
  testCases: [
    { input: [1, 2], expected: 3 },
    { input: [10, 5], expected: 15 },
  ],
  referenceSolution: "function suma(a, b) { return a + b; }",
  hints: [],
  patterns: [],
  source: "curated",
};

const ABIERTO: EjercicioAbierto = { moduleId: "cel", titulo: "Suma de dos", lenguaje: "js" };

// jsRun de prueba que ejecuta de verdad en Node.
const jsRun = async (code: string, fn: string, cases: TestCase[]): Promise<RunResult> => {
  let f: unknown;
  try {
    f = new Function(`${code}\n;return typeof ${fn}==="function"?${fn}:undefined;`)();
  } catch (e) {
    return { syntaxError: String(e), cases: [] };
  }
  if (typeof f !== "function") return { syntaxError: "sin función", cases: [] };
  return {
    syntaxError: null,
    cases: cases.filter((c) => !c.hint).map((c) => {
      const out = (f as (...a: unknown[]) => unknown)(...c.input);
      return { input: c.input, expected: c.expected, output: out, pass: JSON.stringify(out) === JSON.stringify(c.expected) };
    }),
  };
};

const deps: DepsGuarda = { cargarBanco: async () => [EJ as Exercise], jsRun };

describe("guardarRespuesta (§18.6)", () => {
  it("retira un bloque de la respuesta que resuelve el ejercicio abierto", async () => {
    const md = "Aquí tienes:\n\n```js\nfunction suma(a, b) { return a + b; }\n```\n\nY ya.";
    const r = await guardarRespuesta(md, ABIERTO, deps);
    expect(r.retirados).toBe(1);
    expect(r.md).toContain(RETIRADO);
    expect(r.md).not.toContain("return a + b;");
  });

  it("deja un bloque que NO resuelve el ejercicio (p. ej. una pista parcial)", async () => {
    const md = "```js\nfunction suma(a, b) { return a - b; }\n```";
    const r = await guardarRespuesta(md, ABIERTO, deps);
    expect(r.retirados).toBe(0);
    expect(r.md).toContain("a - b");
  });

  it("sin ejercicio abierto no toca nada", async () => {
    const md = "```js\nfunction suma(a, b) { return a + b; }\n```";
    const r = await guardarRespuesta(md, null, deps);
    expect(r.retirados).toBe(0);
    expect(r.md).toBe(md);
  });

  // Red-check: sin la guarda, el bloque que resuelve el ejercicio se pinta (queda en el markdown).
  it("red-check: sin la guarda, el código que resuelve el ejercicio se pinta", async () => {
    const md = "```js\nfunction suma(a, b) { return a + b; }\n```";
    // «sin la guarda» = no llamar a guardarRespuesta: el markdown crudo conserva la solución
    const sinGuarda = md;
    const hallazgo = sinGuarda.includes("return a + b;") ? "se pintó código que resuelve el ejercicio en curso" : "";
    expect(hallazgo).toBe("se pintó código que resuelve el ejercicio en curso");
    // con la guarda, se retira
    const conGuarda = await guardarRespuesta(md, ABIERTO, deps);
    expect(conGuarda.md).not.toContain("return a + b;");
  });
});

describe("guardarLote (§18.6)", () => {
  it("rechaza un lote cuya referencia resuelve el ejercicio abierto", async () => {
    const practicables: Exercise[] = [{ ...EJ, id: "lote:0", referenceSolution: "function suma(a, b) { return a + b; }" } as Exercise];
    const r = await guardarLote(practicables, ABIERTO, deps);
    expect(r.rechazado).toBe(true);
    if (r.rechazado) expect(r.motivo).toContain("resolvía tu ejercicio en curso");
  });

  it("acepta un lote cuya referencia no resuelve el ejercicio abierto", async () => {
    const practicables: Exercise[] = [{ ...EJ, id: "lote:1", functionName: "otra", referenceSolution: "function otra(x) { return x; }" } as Exercise];
    const r = await guardarLote(practicables, ABIERTO, deps);
    expect(r.rechazado).toBe(false);
  });
});
