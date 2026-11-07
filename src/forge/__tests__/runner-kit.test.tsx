import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { LOG_ERROR, useEvidenceWriter } from "@/forge/ui/exercises/kit";
import { createEnvelope, type Envelope } from "@/forge/__tests__/helpers/flow-envelope";
import { realForgeItem } from "@/forge/__tests__/fixtures/evaluator-blocks";
import type { RunnerProps } from "@/forge/ui/exercises/registry";

// RUNNER KIT (design §4.1, §11.2 points 3 and 7). The RF-3 guard lives once in useEvidenceWriter: an invalid payload
// is never written (rc81) and a failed write reveals nothing and gives no XP (rc32), for every runner. Every touch
// control of the four JS runners measures ≥ 44 px and «Cerrar» closes.

const spies = vi.hoisted(() => ({ fire: vi.fn(async () => {}), passLesson: vi.fn(async () => {}) }));
vi.mock("@/ui/use-actions", () => ({ useActions: () => ({ fire: spies.fire, passLesson: spies.passLesson }) }));
vi.mock("@/app/providers", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).providersMock);

import ContraejemploRunner from "@/forge/ui/exercises/ContraejemploRunner";
import MutantesRunner from "@/forge/ui/exercises/MutantesRunner";
import DesvanecidoRunner from "@/forge/ui/exercises/DesvanecidoRunner";
import HistorialRunner from "@/forge/ui/exercises/HistorialRunner";

const CELL = "cf000000-0000-4000-8000-0000000000aa";
const tactil = (el: HTMLElement) =>
  (parseFloat(el.style.minHeight) >= 44 && parseFloat(el.style.minWidth) >= 44) ||
  (el.classList.contains("min-h-11") && el.classList.contains("min-w-11"));

let env: Envelope;
beforeEach(async () => {
  spies.fire.mockClear();
  spies.passLesson.mockClear();
  env = await createEnvelope();
});
afterEach(() => cleanup());

function props(item: RunnerProps["item"]): RunnerProps {
  return { item, cellCode: item.itemId.slice(0, 5).toUpperCase(), cellId: CELL, readModel: env.store.getState().readModel, onClose: () => {} };
}

describe("kit · evidencia inválida (rc81)", () => {
  it("una evidencia que el pliegue ignora nunca se escribe", async () => {
    const { result } = renderHook(() => useEvidenceWriter(CELL, env.store.getState().readModel));
    await result.current.guarded(() =>
      result.current.record({ itemId: "No Valido", type: "contraejemplo", phase: "respuesta", outcome: "correcto", data: {}, source: "local" }),
    )();
    await waitFor(() => expect(result.current.logError, "se escribió una evidencia que el pliegue ignora").toBe(LOG_ERROR));
    expect(spies.fire).not.toHaveBeenCalled();
  });
});

describe("kit · escritura que falla (rc32)", () => {
  const flush = async () => {
    for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0));
  };

  // Each case submits a CORRECT answer with `fire` rejecting. With the guard intact nothing is revealed and no XP is
  // given; under the rc32 mutation `record` resolves silently, so the success text would be painted and passLesson
  // called — the assertions below (with the spec's message) catch exactly that.
  const casos: { nombre: string; Comp: (p: RunnerProps) => ReactElement; item: () => RunnerProps["item"]; act: () => void; exito: RegExp }[] = [
    {
      nombre: "contraejemplo",
      Comp: ContraejemploRunner as never,
      item: () => realForgeItem("A1-01", "a1-01-contra-primera", "contraejemplo"),
      act: () => {
        fireEvent.change(screen.getByLabelText("Argumentos (lista JSON)"), { target: { value: "[[1, 2, 2, 2, 3], 2]" } });
        fireEvent.click(screen.getByRole("button", { name: /Probar contraejemplo/ }));
      },
      exito: /✓ Contraejemplo/,
    },
    {
      nombre: "mutantes",
      Comp: MutantesRunner as never,
      item: () => realForgeItem("A1-01", "a1-01-mut-frontera", "mutantes"),
      act: () => {
        const it = realForgeItem("A1-01", "a1-01-mut-frontera", "mutantes");
        fireEvent.change(screen.getByLabelText("Tus casos (lista JSON)"), { target: { value: JSON.stringify(it.data.dorados) } });
        fireEvent.click(screen.getByRole("button", { name: /Correr mis casos/ }));
      },
      exito: /✓ Mataste/,
    },
    {
      nombre: "fallas",
      Comp: HistorialRunner as never,
      item: () => realForgeItem("S2-02", "s202-lab-escalera", "historial"),
      act: () => {
        const it = realForgeItem("S2-02", "s202-lab-escalera", "historial");
        if (it.data.modo !== "fallas") throw new Error("no fallas");
        fireEvent.change(screen.getByLabelText("Tu función"), { target: { value: it.data.solucion.js! } });
        fireEvent.click(screen.getByRole("button", { name: /Ejecutar calendarios/ }));
      },
      exito: /✓ 6 de 6 calendarios/,
    },
  ];

  for (const c of casos) {
    it(`${c.nombre}: no revela nada ni da XP`, async () => {
      spies.fire.mockImplementation(async () => {
        throw new Error("dexie");
      });
      render(<c.Comp {...props(c.item())} />);
      c.act();
      await flush();
      expect(c.exito.test(document.body.textContent ?? ""), "se reveló algo tras una escritura fallida").toBe(false);
      expect(spies.passLesson, "se dio XP tras una escritura fallida").not.toHaveBeenCalled();
    });
  }

  it("desvanecido: un nivel de código que no se puede registrar no revela el siguiente ni da XP", async () => {
    spies.fire.mockImplementation(async () => {
      throw new Error("dexie");
    });
    const item = realForgeItem("A1-01", "a1-01-desv-frontera", "desvanecido");
    render(<DesvanecidoRunner {...props(item)} />);
    // nivel 1 of A1-01 hides step 3 (code); fill it with the good code
    fireEvent.change(screen.getByLabelText("Paso 3 (código)"), { target: { value: "    if (a[mid] < x) lo = mid + 1;\n    else hi = mid;" } });
    fireEvent.click(screen.getByRole("button", { name: /Comprobar nivel/ }));
    await flush();
    expect((document.body.textContent ?? "").includes("✓ Nivel 1 superado"), "se reveló algo tras una escritura fallida").toBe(false);
    expect(spies.passLesson, "se dio XP tras una escritura fallida").not.toHaveBeenCalled();
  });
});

describe("kit · táctil y escape (rc26)", () => {
  const items = {
    contraejemplo: () => realForgeItem("A1-01", "a1-01-contra-primera", "contraejemplo"),
    mutantes: () => realForgeItem("A1-01", "a1-01-mut-frontera", "mutantes"),
    desvanecido: () => realForgeItem("A1-01", "a1-01-desv-frontera", "desvanecido"),
    fallas: () => realForgeItem("S2-02", "s202-lab-escalera", "historial"),
  };
  const comps = { contraejemplo: ContraejemploRunner, mutantes: MutantesRunner, desvanecido: DesvanecidoRunner, fallas: HistorialRunner };

  for (const key of Object.keys(items) as (keyof typeof items)[]) {
    it(`${key}: todo botón y summary mide ≥ 44 px y «Cerrar» funciona`, () => {
      let closed = false;
      const Comp = comps[key] as (p: RunnerProps) => ReactElement;
      const p = { ...props(items[key]()), onClose: () => (closed = true) };
      render(<Comp {...p} />);
      const controls = [...document.querySelectorAll("button, summary")] as HTMLElement[];
      expect(controls.length).toBeGreaterThan(0);
      for (const el of controls) expect(tactil(el), `un control del corredor mide menos de 44 px (${key})`).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
      expect(closed).toBe(true);
    });
  }
});
