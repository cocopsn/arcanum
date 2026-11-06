import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { project } from "@/core/projector";
import { parseExercisesMd } from "@/lib/exercises-md";
import { BLOCKS, bankMd } from "@/forge/__tests__/fixtures/forge-blocks";
import type { ForgeBankItem } from "@/forge/bank/registry";

// SqlRunner (design §9.3 k, §9.5): the grade is local and goes to the log as evidence.recorded (source "local"); the
// reference query is not in the DOM until a CORRECT attempt is in the log. Red-check in bitacora-e2-datos.md: showing
// the reference after any graded attempt → «la consulta de referencia apareció antes de un acierto registrado».

const spies = vi.hoisted(() => ({ fire: vi.fn(async () => {}), passLesson: vi.fn(async () => {}), runPy: vi.fn() }));
vi.mock("@/ui/use-actions", () => ({ useActions: () => ({ fire: spies.fire, passLesson: spies.passLesson }) }));
vi.mock("@/lib/py-runner", () => ({ runPy: spies.runPy, pyodideCached: async () => true, PY_NEEDS_DOWNLOAD: "descarga" }));

import SqlRunner from "@/forge/ui/exercises/SqlRunner";

const item = (parseExercisesMd(bankMd([BLOCKS.sql]))?.exercises ?? []).find((e): e is ForgeBankItem => e.kind === "forge" && e.type === "sql")!;
const REF_TEXT = "SELECT cliente, COUNT(*) FROM pedidos GROUP BY cliente";
const table = (rows: (string | number)[][]) => ({ cols: ["cliente", "n"], rows });
const answer = (alumnoRows: (string | number)[][][]) => async (_c: string, _f: string, cases: { input: unknown[] }[]) => ({
  syntaxError: null,
  cases: cases.map((c, i) => ({ input: c.input, expected: null, pass: false, output: { ref: table([["a", i + 1]]), alumno: table(alumnoRows[i]!) } })),
});

beforeEach(() => {
  spies.fire.mockClear();
  spies.passLesson.mockClear();
  spies.runPy.mockReset();
});

describe("SqlRunner", () => {
  it("un intento incorrecto se registra como evidencia local y no revela la referencia", async () => {
    spies.runPy.mockImplementation(answer([[["a", 1]], [["a", 1]]]));
    render(<SqlRunner item={item} cellCode="P1-02" cellId="x" readModel={project([])} onClose={() => {}} />);
    expect(document.body.textContent).not.toContain(REF_TEXT);
    fireEvent.change(screen.getByLabelText("Consulta SQL"), { target: { value: "SELECT cliente, 1 FROM pedidos" } });
    fireEvent.click(screen.getByRole("button", { name: /Ejecutar y calificar/ }));
    await waitFor(() => expect(spies.fire).toHaveBeenCalledTimes(1));
    const [type, payload] = spies.fire.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(type).toBe("evidence.recorded");
    expect(payload).toMatchObject({ itemId: "sql-doble", type: "sql", outcome: "incorrecto", source: "local" });
    expect(await screen.findByText(/Incorrecta/)).toBeTruthy();
    expect(document.body.textContent, "la consulta de referencia apareció antes de un acierto registrado").not.toContain(REF_TEXT);
    expect(spies.passLesson).not.toHaveBeenCalled();
  });
  it("un acierto registrado da passLesson(1) y sólo entonces muestra la referencia", async () => {
    spies.runPy.mockImplementation(answer([[["a", 1]], [["a", 2]]]));
    render(<SqlRunner item={item} cellCode="P1-02" cellId="x" readModel={project([])} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("Consulta SQL"), { target: { value: "SELECT cliente, COUNT(*) FROM pedidos GROUP BY cliente" } });
    fireEvent.click(screen.getByRole("button", { name: /Ejecutar y calificar/ }));
    await waitFor(() => expect(spies.passLesson).toHaveBeenCalledTimes(1));
    expect((spies.fire.mock.calls[0] as unknown as [string, Record<string, unknown>])[1]).toMatchObject({ outcome: "correcto", source: "local" });
    expect(await screen.findByText(/consulta de referencia/)).toBeTruthy();
  });
  it("si la escritura en el log falla, no se revela nada ni se da XP", async () => {
    spies.runPy.mockImplementation(answer([[["a", 1]], [["a", 2]]]));
    spies.fire.mockImplementationOnce(async () => {
      throw new Error("dexie");
    });
    render(<SqlRunner item={item} cellCode="P1-02" cellId="x" readModel={project([])} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("Consulta SQL"), { target: { value: "SELECT 1" } });
    fireEvent.click(screen.getByRole("button", { name: /Ejecutar y calificar/ }));
    expect(await screen.findByText(/No se pudo registrar el intento/)).toBeTruthy();
    expect(document.body.textContent, "la referencia apareció sin un acierto en el log").not.toContain(REF_TEXT);
    expect(spies.passLesson).not.toHaveBeenCalled();
  });
});
