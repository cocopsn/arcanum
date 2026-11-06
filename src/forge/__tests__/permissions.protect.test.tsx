import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { parseExercisesMd } from "@/lib/exercises-md";
import type { ForgeBankItem } from "@/forge/bank/registry";
import { evaluatePermission, gradePermisos } from "@/forge/eval/permissions";
import { check } from "@/forge/bank/check/permisos";
import { BLOCKS, bankMd } from "@/forge/__tests__/fixtures/forge-blocks";
import { createEnvelope, type Envelope } from "@/forge/__tests__/helpers/flow-envelope";
import PermisosRunner from "@/forge/ui/exercises/PermisosRunner";

vi.mock("@/app/providers", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).providersMock);
vi.mock("@/forge/ai-port", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).aiPortMock);

// PROTECTION of `permisos` (design §9.3 n, CA-32): the grade comes from the propagation evaluator; a derived dataset
// inherits the marking of its origin; a bank whose solution contradicts the evaluator is rejected; the solution and the
// reasons are not in the DOM before the answer is in the log.

const CELL_ID = "cf000000-0000-4000-8000-0000000000c1";

function item(block = BLOCKS.permisos): ForgeBankItem & { type: "permisos" } {
  const it = (parseExercisesMd(bankMd([block], CELL_ID))?.exercises ?? []).find((e): e is ForgeBankItem => e.kind === "forge");
  if (!it || it.type !== "permisos") throw new Error("el bloque de prueba no parseó como permisos");
  return it;
}

describe("permisos · evaluador de propagación", () => {
  it("a dataset derived by join inherits the marking and denies whoever lacks it", () => {
    const { modelo } = item().data;
    const r = evaluatePermission(modelo, { usuario: "u1", operacion: "ver", recurso: "union" });
    expect(r.permitido, "un derivado perdió el marking de su origen").toBe(false);
    expect(r.razon).toContain("heredado de «pacientes» por la derivación");
    expect(evaluatePermission(modelo, { usuario: "u2", operacion: "ver", recurso: "pacientes" }).permitido).toBe(true);
  });
  it("role access is not inherited through derivation", () => {
    const { modelo } = item().data;
    expect(evaluatePermission(modelo, { usuario: "u2", operacion: "ver", recurso: "union" }).permitido, "el acceso por rol se heredó por derivación").toBe(false);
  });
  it("grades against the evaluator, all right = correct", () => {
    const d = item().data;
    expect(gradePermisos(d, { q1: false, q2: true, q3: false, q4: false, q5: false, q6: false }).correcto).toBe(true);
    expect(gradePermisos(d, { q1: false, q2: true, q3: true, q4: false, q5: false, q6: false }).correcto).toBe(false);
  });
});

describe("permisos · ingesta", () => {
  it("accepts the fixture and never executes", async () => {
    const jsRun = vi.fn(async () => ({ syntaxError: null, cases: [] }));
    expect(await check(item(), { source: "seed", jsRun })).toEqual({ ok: true });
    expect(jsRun).not.toHaveBeenCalled();
  });
  it("rejects a bank whose solution contradicts the evaluator, naming the question", async () => {
    const r = await check(item(BLOCKS.permisos.replace('"q3": false', '"q3": true')), { source: "seed", jsRun: async () => ({ syntaxError: null, cases: [] }) });
    expect("ok" in r && r.ok === false, "el banco aceptó una solución que contradice al evaluador").toBe(true);
    expect(JSON.stringify(r)).toContain("q3");
  });
  it("rejects a cycle in deriva_de", async () => {
    const cyc = BLOCKS.permisos.replace('"markings": ["pii"] },', '"markings": ["pii"], "deriva_de": ["union"] },');
    const r = await check(item(cyc), { source: "seed", jsRun: async () => ({ syntaxError: null, cases: [] }) });
    expect(JSON.stringify(r), "un ciclo de derivación pasó la ingesta").toContain("ciclo");
  });
});

describe("permisos · interfaz", () => {
  let env: Envelope;
  beforeEach(async () => {
    env = await createEnvelope();
  });
  afterEach(() => cleanup());

  it("nothing is revealed before the answer is in the log; then every reason is shown", async () => {
    env.mount(PermisosRunner as never, { item: item(), cellCode: "X18", cellId: CELL_ID, readModel: env.store.getState().readModel, onClose: () => {} } as never);
    const text = () => document.body.textContent ?? "";
    expect(text(), "la solución apareció antes de que la respuesta estuviera en el log").not.toMatch(/denegado:|permitido:|correctas/);
    const submit = screen.getByRole("button", { name: "Entregar respuestas" }) as HTMLButtonElement;
    expect(submit.disabled, "se pudo entregar sin responder todas las preguntas").toBe(true);
    for (const [q, v] of Object.entries({ q1: false, q2: true, q3: true, q4: false, q5: false, q6: false })) {
      const group = screen.getByRole("radiogroup", { name: `Respuesta a ${q}` });
      fireEvent.click(group.querySelectorAll("input")[v ? 0 : 1]!);
    }
    await waitFor(() => expect(submit.disabled).toBe(false));
    expect(text(), "la solución apareció antes de que la respuesta estuviera en el log").not.toMatch(/denegado:|permitido:|correctas/);
    fireEvent.click(submit);
    expect(await screen.findByText(/5 de 6 correctas/)).toBeTruthy();
    expect(text()).toContain("heredado de «pacientes» por la derivación");
    const ev = (await env.events()).find((e) => e.type === "evidence.recorded");
    expect(ev?.payload).toMatchObject({ itemId: "perm-join", type: "permisos", phase: "respuesta", outcome: "incorrecto", source: "local" });
  });
});
