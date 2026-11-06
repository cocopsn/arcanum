import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { parseExercisesMd } from "@/lib/exercises-md";
import { makeEvent } from "@/core/event";
import type { EvidenceRM } from "@/core/read-model";
import type { ForgeBankItem } from "@/forge/bank/registry";
import { calibration, firstEvidence } from "@/forge/model/calibration";
import { BLOCKS, bankMd } from "@/forge/__tests__/fixtures/forge-blocks";
import { createEnvelope, type Envelope } from "@/forge/__tests__/helpers/flow-envelope";
import PrediccionRunner from "@/forge/ui/exercises/PrediccionRunner";

vi.mock("@/app/providers", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).providersMock);
vi.mock("@/forge/ai-port", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).aiPortMock);

// PROTECTION of `prediccion` (design §9.3 a, CA-43): the marked option and the justification appear only when the
// prediction is in the log; everything derives from the FIRST record (a later answer changes neither the registered
// prediction nor the calibration); with a fixed set the calibration is the expected one.

const CELL_ID = "cf000000-0000-4000-8000-0000000000e1";
function item(): ForgeBankItem {
  const it = (parseExercisesMd(bankMd([BLOCKS.prediccion], CELL_ID))?.exercises ?? []).find((e): e is ForgeBankItem => e.kind === "forge");
  if (!it || it.type !== "prediccion") throw new Error("el bloque de prueba no parseó como prediccion");
  return it;
}
const ev = (itemId: string, confianza: number, outcome: "correcto" | "incorrecto", moduleId = CELL_ID): EvidenceRM => ({
  id: `${itemId}-${confianza}-${outcome}`,
  moduleId,
  goalId: null,
  itemId,
  type: "prediccion",
  phase: "respuesta",
  outcome,
  data: { elegida: 0, confianza },
  source: "local",
  provider: null,
  passed: null,
  ts: 0,
});

describe("prediccion · calibración", () => {
  it("Brier and bias over a fixed set, with n", () => {
    const c = calibration({ evidence: [ev("a", 90, "correcto"), ev("b", 70, "incorrecto"), ev("c", 50, "correcto")] }, CELL_ID);
    expect(c.n).toBe(3);
    expect(c.aciertos).toBe(2);
    expect(c.brier).toBeCloseTo(0.25, 10);
    expect(c.sesgo).toBeCloseTo(0.7 - 2 / 3, 10);
  });
  it("only the first prediction of each item counts", () => {
    const base = [ev("a", 90, "correcto"), ev("b", 70, "incorrecto")];
    const later = [...base, ev("a", 50, "incorrecto")];
    expect(calibration({ evidence: later }, CELL_ID), "una edición posterior cambió la predicción registrada").toEqual(calibration({ evidence: base }, CELL_ID));
    expect(firstEvidence({ evidence: later }, CELL_ID, "a", "respuesta")?.outcome, "una edición posterior cambió la predicción registrada").toBe("correcto");
  });
  it("per cell and global", () => {
    const list = [ev("a", 90, "correcto"), ev("x", 90, "incorrecto", "cf000000-0000-4000-8000-0000000000e2")];
    expect(calibration({ evidence: list }, CELL_ID).n).toBe(1);
    expect(calibration({ evidence: list }).n).toBe(2);
  });
});

describe("prediccion · interfaz", () => {
  let env: Envelope;
  beforeEach(async () => {
    env = await createEnvelope();
  });
  afterEach(() => cleanup());

  it("the solution appears only once the prediction is in the log; a second answer changes nothing", async () => {
    env.mount(PrediccionRunner as never, { item: item(), cellCode: "P2-06", cellId: CELL_ID, readModel: env.store.getState().readModel, onClose: () => {} } as never);
    const text = () => document.body.textContent ?? "";
    expect(text(), "la solución apareció antes de que la predicción estuviera en el log").not.toContain("Cada pedido se repite");
    const btn = screen.getByRole("button", { name: "Registrar predicción" }) as HTMLButtonElement;
    expect(btn.disabled, "la predicción tenía un valor por omisión").toBe(true);
    fireEvent.click(screen.getByLabelText("Igual que pedidos"));
    fireEvent.click(screen.getByLabelText("90 %"));
    expect(text(), "la solución apareció antes de que la predicción estuviera en el log").not.toContain("Cada pedido se repite");
    await waitFor(() => expect(btn.disabled).toBe(false));
    fireEvent.click(btn);
    expect(await screen.findByText(/Cada pedido se repite/)).toBeTruthy();
    expect(text()).toContain("No acertaste");
    expect(text()).toContain("n = 1");
    // a later, different answer (another device, an edit) reaches the log: the registered prediction does not change
    const later = makeEvent("evidence.recorded", { itemId: "pred-join", type: "prediccion", phase: "respuesta", outcome: "correcto", data: { elegida: 0, confianza: 50 }, source: "local" }, { ts: Date.now() + 1000, deviceId: "otro", goalId: null, moduleId: CELL_ID });
    await env.store.getState().dispatch(later, Date.now() + 1000);
    await waitFor(() => expect(env.store.getState().readModel.evidence.length).toBe(2));
    expect(text(), "una edición posterior cambió la predicción registrada").toContain("No acertaste");
    expect(text()).toContain("n = 1");
  });
});
