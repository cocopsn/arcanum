import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ExecRunner } from "@/lib/exercises-validate";
import type { MutantesData } from "@/forge/bank/types/mutantes";
import { gradeMutants, killedBy, parseMutantCases } from "@/forge/eval/mutants";
import { BLOCKS } from "@/forge/__tests__/fixtures/forge-blocks";
import { forgeItem, realForgeItem } from "@/forge/__tests__/fixtures/evaluator-blocks";
import { execRunner } from "@/forge/__tests__/helpers/exec-runner";
import { createEnvelope } from "@/forge/__tests__/helpers/flow-envelope";

vi.mock("@/app/providers", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).providersMock);

import MutantesRunner from "@/forge/ui/exercises/MutantesRunner";

const CELL = "cf000000-0000-4000-8000-0000000000d4";

// d · mutantes (design §5.2, §11.1). Protections, each with its red-check in tools/redcheck-specs.json:
//  rc04/rc51 a wrong expectation never kills a mutant (valid cases only, and mutants run only on them); rc05 a live
//  critical mutant fails the item; rc49 a mutant that does not finish is killed; rc30 a learner's `hint` never makes
//  a runner skip a case; rc82 every run gets fresh copies of the inputs.

const mutMax = () => forgeItem(BLOCKS.mutantes, "mutantes").data;
const byId = (g: Awaited<ReturnType<typeof gradeMutants>>, id: string) => (g.estado === "calificada" ? g.mutantes.find((m) => m.id === id) : undefined);

describe("mutantes · casos válidos y expectativas erróneas", () => {
  it("una expectativa errónea no mata a un mutante aunque haya un caso válido", async () => {
    // [3, 1, 2] → 3 is valid and kills m-ultimo; [1, 2, 3] → 2 is wrong (the reference says 3) and m-primero (1) would «die»
    const g = await gradeMutants(mutMax(), [{ input: [[3, 1, 2]], expected: 3 }, { input: [[1, 2, 3]], expected: 2 }], execRunner);
    expect(g.estado).toBe("calificada");
    expect(byId(g, "m-primero")?.muerto, "una expectativa errónea mató un mutante").toBe(false);
    expect(g.estado === "calificada" && g.correcto).toBe(false);
    expect(byId(g, "m-ultimo")?.muerto).toBe(true);
    if (g.estado === "calificada") {
      expect(g.validos).toEqual([0]);
      expect(g.invalidos).toEqual([{ i: 1, referencia: { ok: true, value: 3 } }]);
    }
  });
  it("con sólo casos erróneos: calificada incorrecta y ningún mutante muerto (comportamiento)", async () => {
    const run = vi.fn<ExecRunner>(execRunner);
    const g = await gradeMutants(mutMax(), [{ input: [[1, 2, 3]], expected: 2 }], run);
    expect(g).toMatchObject({ estado: "calificada", correcto: false, validos: [], muertos: 0 });
    if (g.estado === "calificada") expect(g.mutantes.every((m) => !m.muerto)).toBe(true);
    expect(run).toHaveBeenCalledTimes(1); // only the reference ran
  });
  it("un crítico vivo reprueba aunque los muertos alcancen el mínimo", async () => {
    // only [3, 1, 2] → 3: m-ultimo dies (1 ≥ minimo 1), m-primero (critical) returns 3 and lives
    const g = await gradeMutants(mutMax(), [{ input: [[3, 1, 2]], expected: 3 }], execRunner);
    expect(g).toMatchObject({ estado: "calificada", muertos: 1, criticosVivos: 1 });
    expect(g.estado === "calificada" && g.correcto, "un crítico vivo aprobó el ítem").toBe(false);
  });
  it("matar a todos con casos válidos aprueba (comportamiento)", async () => {
    const g = await gradeMutants(mutMax(), [{ input: [[3, 1, 2]], expected: 3 }, { input: [[1, 2, 3]], expected: 3 }], execRunner);
    expect(g).toMatchObject({ estado: "calificada", correcto: true, muertos: 2, criticosVivos: 0 });
  });
});

describe("mutantes · killedBy", () => {
  it("un mutante que no termina queda muerto", () => {
    expect(killedBy({ syntaxError: null, cases: [], timedOut: true }), "un mutante que no termina quedó vivo").toBe(true);
    expect(killedBy({ syntaxError: null, cases: [{ input: [], expected: 1, output: 1, pass: true }] })).toBe(false);
  });
  it("un timeout del mutante cuenta como muerto en la calificación (comportamiento)", async () => {
    const d = mutMax();
    const run: ExecRunner = async (code, fn, cases) => (code === d.mutantes[0]!.code ? { syntaxError: null, cases: [], timedOut: true } : execRunner(code, fn, cases));
    const g = await gradeMutants(d, [{ input: [[3, 1, 2]], expected: 3 }], run);
    expect(byId(g, "m-primero")).toMatchObject({ muerto: true, porTiempo: true });
    expect(g).toMatchObject({ correcto: true });
  });
});

describe("mutantes · parseMutantCases", () => {
  it("un hint del alumno no salta el caso", async () => {
    const p = parseMutantCases('[{ "input": [[1]], "expected": 1, "hint": true }]');
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect("hint" in p.casos[0]!, "un hint del alumno saltó un caso").toBe(false);
    const g = await gradeMutants(mutMax(), p.casos, execRunner);
    expect(g.estado === "calificada" ? g.validos : [], "un hint del alumno saltó un caso").toEqual([0]);
  });
  it("rechaza lo que no es una lista de 1 a 50 casos con input y expected (comportamiento)", () => {
    expect(parseMutantCases("no").ok).toBe(false);
    expect(parseMutantCases("[]").ok).toBe(false);
    expect(parseMutantCases('[{ "input": 1, "expected": 1 }]').ok).toBe(false);
    expect(parseMutantCases('[{ "input": [1] }]').ok).toBe(false);
    expect(parseMutantCases(JSON.stringify(Array.from({ length: 51 }, () => ({ input: [1], expected: 1 })))).ok).toBe(false);
    expect(parseMutantCases("[" + " ".repeat(20_000) + "]").ok).toBe(false);
  });
});

describe("mutantes · A1-01 real (comportamiento)", () => {
  it("los 7 dorados aprueban y un solo caso no", async () => {
    const d = realForgeItem("A1-01", "a1-01-mut-frontera", "mutantes").data;
    expect(await gradeMutants(d, d.dorados, execRunner)).toMatchObject({ estado: "calificada", correcto: true, criticosVivos: 0 });
    const uno = await gradeMutants(d, [{ input: [[1, 3, 5], 3], expected: 1 }], execRunner);
    expect(uno).toMatchObject({ estado: "calificada", correcto: false });
  });
});

describe("mutantes · interfaz (DOM)", () => {
  afterEach(() => cleanup());
  const text = () => document.body.textContent ?? "";
  const mount = async () => {
    const env = await createEnvelope();
    const item = realForgeItem("A1-01", "a1-01-mut-frontera", "mutantes");
    env.mount(MutantesRunner as never, { item, cellCode: "A1-01", cellId: CELL, readModel: env.store.getState().readModel, onClose: () => {} } as never);
    return { env, item };
  };

  it("los ids y el código de las versiones aparecen sólo tras un acierto; un intento incorrecto no da XP", async () => {
    const { env, item } = await mount();
    const firstMut = item.data.mutantes[0]!;
    expect(text(), "los mutantes se revelaron antes de un acierto registrado").not.toContain(firstMut.code);
    // a single case: kills some but leaves a critical alive → incorrecto
    fireEvent.change(screen.getByLabelText("Tus casos (lista JSON)"), { target: { value: '[{ "input": [[1, 3, 5], 3], "expected": 1 }]' } });
    fireEvent.click(screen.getByRole("button", { name: /Correr mis casos/ }));
    await waitFor(() => expect(env.store.getState().readModel.evidence.length).toBe(1));
    expect(env.store.getState().readModel.evidence[0]).toMatchObject({ type: "mutantes", outcome: "incorrecto", source: "local" });
    expect(text(), "los mutantes se revelaron antes de un acierto registrado").not.toContain(firstMut.code);
    expect((await env.events()).some((e) => e.type === "checkpoint.passed")).toBe(false);
    // the golden cases kill everything → correcto
    fireEvent.change(screen.getByLabelText("Tus casos (lista JSON)"), { target: { value: JSON.stringify(item.data.dorados) } });
    fireEvent.click(screen.getByRole("button", { name: /Correr mis casos/ }));
    await waitFor(() => expect(env.store.getState().readModel.evidence.some((e) => e.outcome === "correcto")).toBe(true));
    await waitFor(() => expect(text()).toContain(firstMut.code));
    expect((await env.events()).some((e) => e.type === "checkpoint.passed")).toBe(true);
  });
});

describe("mutantes · clonado de entradas", () => {
  it("una referencia que ordena su entrada en su lugar no cambia la del mutante", async () => {
    const d: MutantesData = {
      minimo: 1,
      firma: "function primero(a) {}",
      functionName: "primero",
      referencia: "function primero(a) { a.sort((x, y) => x - y); return a[0]; }",
      mutantes: [{ id: "m-sin-orden", critico: true, code: "function primero(a) { return a[0]; }" }],
      dorados: [],
      formato: "",
    };
    // execRunner passes the same input object to every program (no clone): only gradeMutants' clones protect it
    const g = await gradeMutants(d, [{ input: [[3, 1, 2]], expected: 1 }], execRunner);
    expect(g.estado === "calificada" && g.mutantes[0]!.muerto, "un programa cambió la entrada del siguiente (mutantes)").toBe(true);
  });
});
