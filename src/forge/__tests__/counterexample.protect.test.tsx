import { describe, expect, it } from "vitest";
import type { ContraejemploData } from "@/forge/bank/types/contraejemplo";
import { CONTRA_ARGS_MAX, decideCounterexample, gradeCounterexample, parseContraArgs, type ContraFacts } from "@/forge/eval/counterexample";
import { realForgeItem } from "@/forge/__tests__/fixtures/evaluator-blocks";
import { execRunner } from "@/forge/__tests__/helpers/exec-runner";

// e · contraejemplo (design §5.1, §11.1). Protections, each with its red-check in tools/redcheck-specs.json:
//  rc01 an input outside the contract never counts; rc48 an invariant the reference also violates never counts;
//  rc50 an almost-correct version that throws is a difference; rc52 every program gets a fresh copy of the input.

const V = (value: unknown) => ({ ok: true as const, value });
const facts = (over: Partial<ContraFacts>): ContraFacts => ({ pre: true, casi: V(1), ref: V(1), same: true, prop: null, propRef: null, ...over });

describe("contraejemplo · decideCounterexample", () => {
  it("fuera de contrato nunca cuenta, aunque las salidas difieran", () => {
    expect(decideCounterexample(facts({ pre: false, casi: V(2), same: false })).correcto, "una entrada fuera de contrato contó como contraejemplo").toBe(false);
    expect(decideCounterexample(facts({ pre: false, casi: V(2), same: false })).motivo).toBe("fuera-de-contrato");
  });
  it("una invariante que la referencia también viola no cuenta", () => {
    const d = decideCounterexample(facts({ same: true, prop: false, propRef: false }));
    expect(d.correcto, "una invariante que la referencia también viola contó como contraejemplo").toBe(false);
    expect(d.motivo).toBe("coincide");
  });
  it("difiere, viola la invariante con la referencia que la cumple, coincide (comportamiento)", () => {
    expect(decideCounterexample(facts({ casi: V(2), same: false }))).toEqual({ correcto: true, motivo: "difiere" });
    expect(decideCounterexample(facts({ same: true, prop: false, propRef: true }))).toEqual({ correcto: true, motivo: "viola-invariante" });
    expect(decideCounterexample(facts({ same: true, prop: true, propRef: true }))).toEqual({ correcto: false, motivo: "coincide" });
    expect(decideCounterexample(facts({ same: true }))).toEqual({ correcto: false, motivo: "coincide" });
  });
});

describe("contraejemplo · gradeCounterexample con execCode", () => {
  const a101 = () => realForgeItem("A1-01", "a1-01-contra-primera", "contraejemplo").data;
  const base = (over: Partial<ContraejemploData>): ContraejemploData => ({
    firma: "function f(a) {}",
    functionName: "f",
    pre: "function pre(a) { return Array.isArray(a); }",
    casi: "function f(a) { return a[0]; }",
    referencia: "function f(a) { return a[0]; }",
    comparador: null,
    invariante: null,
    testigo: [[3, 1, 2]],
    ...over,
  });

  it("sobre A1-01 real: el testigo se acepta, [[1, 3, 5], 3] coincide y [[3, 1, 2], 1] está fuera de contrato (comportamiento)", async () => {
    const d = a101();
    const t = await gradeCounterexample(d, d.testigo, execRunner);
    expect(t).toMatchObject({ estado: "calificada", correcto: true, motivo: "difiere" });
    expect(await gradeCounterexample(d, [[1, 3, 5], 3], execRunner)).toMatchObject({ estado: "calificada", correcto: false, motivo: "coincide" });
    expect(await gradeCounterexample(d, [[3, 1, 2], 1], execRunner)).toMatchObject({ estado: "calificada", correcto: false, motivo: "fuera-de-contrato" });
  });

  it("una casi correcta que lanza cuenta como diferencia", async () => {
    const d = base({ casi: "function f(a) { throw new Error('boom'); }" });
    const g = await gradeCounterexample(d, [[3, 1, 2]], execRunner);
    expect(g.estado === "calificada" && g.correcto, "una casi correcta que lanza no contó como diferencia").toBe(true);
    expect(g).toMatchObject({ motivo: "difiere", casi: { ok: false } });
  });

  it("cada programa recibe su propia copia de la entrada", async () => {
    // the almost-correct version sorts its input in place; the reference reads a[0]: 1 vs 3 only with fresh copies
    const d = base({ casi: "function f(a) { a.sort((x, y) => x - y); return a[0]; }" });
    const args = [[3, 1, 2]];
    const g = await gradeCounterexample(d, args, execRunner);
    expect(g.estado === "calificada" ? g.motivo : g.estado, "un programa cambió la entrada del siguiente").toBe("difiere");
    expect(args, "un programa cambió la entrada del alumno").toEqual([[3, 1, 2]]);
  });

  it("una referencia que lanza y una invariante que la referencia viola son error-item (comportamiento)", async () => {
    const lanza = await gradeCounterexample(base({ referencia: "function f(a) { throw new Error('x'); }" }), [[1]], execRunner);
    expect(lanza.estado).toBe("error-item");
    if (lanza.estado === "error-item") expect(lanza.motivo).toMatch(/la referencia falló con una entrada dentro del contrato/);
    const viola = await gradeCounterexample(base({ invariante: "function prop(args, out) { return false; }" }), [[1]], execRunner);
    expect(viola).toEqual({ estado: "error-item", motivo: "la referencia viola su propia invariante con esta entrada" });
  });

  it("con invariante: la salida que la viola cuenta sólo si la referencia la cumple (comportamiento)", async () => {
    const d = base({ casi: "function f(a) { return -1; }", referencia: "function f(a) { return a.length; }", comparador: "function same(a, b, args) { return true; }", invariante: "function prop(args, out) { return out >= 0; }" });
    expect(await gradeCounterexample(d, [[1, 2]], execRunner)).toMatchObject({ estado: "calificada", correcto: true, motivo: "viola-invariante" });
  });

  it("una precondición que no termina es tiempo y no corre nada más (comportamiento)", async () => {
    let calls = 0;
    const g = await gradeCounterexample(base({}), [[1]], async () => {
      calls++;
      return { syntaxError: null, cases: [], timedOut: true };
    });
    expect(g).toEqual({ estado: "tiempo" });
    expect(calls).toBe(1);
  });
});

describe("contraejemplo · parseContraArgs (comportamiento)", () => {
  it("rechaza lo que no es JSON, un objeto y más de 20,000 caracteres; acepta una lista", () => {
    expect(parseContraArgs("[1, 2").ok).toBe(false);
    expect(parseContraArgs('{"a": 1}').ok).toBe(false);
    const largo = JSON.stringify(["x".repeat(CONTRA_ARGS_MAX - 3)]);
    expect(largo.length).toBe(CONTRA_ARGS_MAX + 1);
    expect(parseContraArgs(largo).ok).toBe(false);
    expect(parseContraArgs("[[1, 2], 3]")).toEqual({ ok: true, args: [[1, 2], 3] });
  });
});
