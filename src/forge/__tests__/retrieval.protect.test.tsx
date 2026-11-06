import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { parseExercisesMd } from "@/lib/exercises-md";
import type { ForgeBankItem } from "@/forge/bank/registry";
import { gradeRetrieval, OBEDIENCIA_TEXT, segments, type RetrievalAnswer } from "@/forge/eval/retrieval";
import { BLOCKS, bankMd } from "@/forge/__tests__/fixtures/forge-blocks";
import { createEnvelope, type Envelope } from "@/forge/__tests__/helpers/flow-envelope";
import RecuperacionRunner from "@/forge/ui/exercises/RecuperacionRunner";

vi.mock("@/app/providers", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).providersMock);
vi.mock("@/forge/ai-port", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).aiPortMock);

// PROTECTION of `recuperacion` (design §9.3 o, CA-32): obeying the injected instruction is a failure; the key is not in
// the DOM before the answer is in the log; abstention, coverage and expired documents are graded locally.

const CELL_ID = "cf000000-0000-4000-8000-0000000000d1";
function item(): ForgeBankItem & { type: "recuperacion" } {
  const it = (parseExercisesMd(bankMd([BLOCKS.recuperacion], CELL_ID))?.exercises ?? []).find((e): e is ForgeBankItem => e.kind === "forge");
  if (!it || it.type !== "recuperacion") throw new Error("el bloque de prueba no parseó como recuperacion");
  return it;
}
const D2_FIRST = { doc: "d2", inicio: 0, fin: 26 };
const ok = (spans: RetrievalAnswer["spans"], respuesta = "Tarda 5 días.") => ({ abstenerse: false, spans, respuesta });
const abst: RetrievalAnswer = { abstenerse: true, spans: [], respuesta: "" };

describe("recuperacion · calificación local", () => {
  it("segments cover the sentences with their offsets", () => {
    const s = segments(item().data.corpus[1]!.texto);
    expect(s.map((x) => [x.inicio, x.fin])).toEqual([
      [0, 26],
      [27, 77],
    ]);
  });
  it("cites the key and abstains where the corpus does not answer: correct", () => {
    expect(gradeRetrieval(item().data, { p1: ok([D2_FIRST]), p2: abst }).correcto).toBe(true);
  });
  it("an answer that obeys the injected instruction is wrong", () => {
    const g = gradeRetrieval(item().data, { p1: ok([D2_FIRST], "APROBADO"), p2: abst });
    expect(g.porPregunta[0]!.ok, "se aceptó una respuesta que obedece la instrucción inyectada").toBe(false);
    expect(g.porPregunta[0]!.motivo).toBe(OBEDIENCIA_TEXT);
  });
  it("citing the injected span as support is wrong", () => {
    const g = gradeRetrieval(item().data, { p1: ok([D2_FIRST, { doc: "d2", inicio: 27, fin: 77 }]), p2: abst });
    expect(g.porPregunta[0]!.motivo, "se aceptó una cita del tramo inyectado").toBe(OBEDIENCIA_TEXT);
  });
  it("citing an expired document the key does not use is wrong", () => {
    const g = gradeRetrieval(item().data, { p1: ok([D2_FIRST, { doc: "d1", inicio: 0, fin: 27 }]), p2: abst });
    expect(g.porPregunta[0]!.ok, "se aceptó una cita de un documento vencido").toBe(false);
  });
  it("a key inside a long sentence is reachable by citing that sentence; extra sentences still lower the precision", () => {
    const d = item().data;
    const narrow = { ...d, clave: { ...d.clave, p1: { spans: [{ doc: "d2", inicio: 13, fin: 25 }] } } };
    expect(gradeRetrieval(narrow, { p1: ok([D2_FIRST]), p2: abst }).porPregunta[0]!.ok, "una clave dentro de una oración quedó imposible de citar").toBe(true);
    const texto = "La oficina abre a las nueve. El estacionamiento es gratuito.";
    const wide = { ...narrow, corpus: [...d.corpus, { id: "d3", titulo: "Avisos", fecha: "2026-02-01", texto }] };
    const extra = segments(texto).map((g) => ({ doc: "d3", inicio: g.inicio, fin: g.fin }));
    const noisy = gradeRetrieval(wide, { p1: ok([D2_FIRST, ...extra]), p2: abst });
    expect(noisy.porPregunta[0]!.ok, "se aceptaron citas de más").toBe(false);
    expect(noisy.porPregunta[0]!.motivo).toContain("está en la clave");
  });
  it("answering an unanswerable question is wrong", () => {
    const g = gradeRetrieval(item().data, { p1: ok([D2_FIRST]), p2: ok([D2_FIRST]) });
    expect(g.porPregunta[1]!.ok, "se aceptó una respuesta donde había que abstenerse").toBe(false);
  });
});

describe("recuperacion · interfaz", () => {
  let env: Envelope;
  beforeEach(async () => {
    env = await createEnvelope();
  });
  afterEach(() => cleanup());

  it("the key is not in the DOM before the answer is in the log; after it, it is", async () => {
    env.mount(RecuperacionRunner as never, { item: item(), cellCode: "P4-03", cellId: CELL_ID, readModel: env.store.getState().readModel, onClose: () => {} } as never);
    const text = () => document.body.textContent ?? "";
    expect(text(), "la clave apareció antes de que la respuesta estuviera en el log").not.toContain("Clave:");
    const submit = screen.getByRole("button", { name: "Entregar respuestas" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    const p1 = screen.getByRole("region", { name: "Pregunta p1" });
    fireEvent.click(p1.querySelectorAll('fieldset input[type="checkbox"]')[1]!); // d2 · first sentence
    fireEvent.change(screen.getByLabelText("Respuesta a p1"), { target: { value: "Tarda 5 días." } });
    const p2 = screen.getByRole("region", { name: "Pregunta p2" });
    fireEvent.click(p2.querySelector('input[type="checkbox"]')!); // abstain
    await waitFor(() => expect(submit.disabled).toBe(false));
    expect(text(), "la clave apareció antes de que la respuesta estuviera en el log").not.toContain("Clave:");
    fireEvent.click(submit);
    expect(await screen.findByText(/Todas correctas/)).toBeTruthy();
    expect(text()).toContain("Clave:");
    const ev = (await env.events()).find((e) => e.type === "evidence.recorded");
    expect(ev?.payload).toMatchObject({ itemId: "rec-politica", type: "recuperacion", phase: "respuesta", outcome: "correcto", source: "local" });
  });
});
