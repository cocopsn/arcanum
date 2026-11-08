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
vi.mock("@/lib/py-runner", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/py-runner")>();
  const { cpythonRunner } = await import("@/forge/__tests__/helpers/cpython");
  return { ...real, runPy: (code: string, fn: string, cases: unknown) => cpythonRunner(code, fn, cases as never) };
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import ContraejemploRunner from "@/forge/ui/exercises/ContraejemploRunner";
import MutantesRunner from "@/forge/ui/exercises/MutantesRunner";
import DesvanecidoRunner from "@/forge/ui/exercises/DesvanecidoRunner";
import HistorialRunner from "@/forge/ui/exercises/HistorialRunner";
import ForenseRunner from "@/forge/ui/exercises/ForenseRunner";
import RetencionRunner from "@/forge/ui/exercises/RetencionRunner";
import { PY } from "@/forge/__tests__/helpers/cpython";
import { forgeItem } from "@/forge/__tests__/fixtures/evaluator-blocks";
import { BLOCKS } from "@/forge/__tests__/fixtures/forge-blocks";
import { RUNNER_LOADERS, type RunnerType } from "@/forge/ui/exercises/registry";
import { PENDING_TEXT } from "@/forge/ui/flow-contract";
import { parseExercisesMd } from "@/lib/exercises-md";
import { readdirSync } from "node:fs";

const CELL = "cf000000-0000-4000-8000-0000000000aa";
const DUE_FORGE = { v: 1, kind: "mision", essential: ["sistemas"], capabilities: { sistemas: 3 }, critical: [{ id: "consistencia", passed: true }], failureMode: null, scope: "local", apoyo: "independiente" };
async function mountDueRetencion(itemId: string) {
  const { createEnvelope } = await import("@/forge/__tests__/helpers/flow-envelope");
  const { makeEvent } = await import("@/core/event");
  const env = await createEnvelope();
  const cellId = env.store.getState().readModel.modules[0]?.id ?? CELL;
  const goalId = env.store.getState().readModel.modules[0]?.goalId ?? null;
  const now = Date.UTC(2026, 11, 20, 0, 0, 0);
  const g = makeEvent("gate.evaluated", { passed: true, score: 1, summary: "", feedback: "", source: "ai", provider: "azure", forge: DUE_FORGE } as never, { ts: now - 200 * 86_400_000, deviceId: "t", goalId, moduleId: cellId });
  await env.store.getState().dispatch(g, now);
  vi.spyOn(Date, "now").mockReturnValue(now);
  const item = realForgeItem("P2-06", itemId, "retencion");
  return { env, cellId, item };
}
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

  it.skipIf(!PY)("forense: una entrega correcta que no se puede registrar no revela nada ni da XP", async () => {
    spies.fire.mockImplementation(async () => {
      throw new Error("dexie");
    });
    const item = forgeItem(BLOCKS.forense, "forense");
    render(<ForenseRunner {...props(item)} />);
    fireEvent.change(screen.getByLabelText("Paso de la mentira 1"), { target: { value: "unir" } });
    fireEvent.change(screen.getByLabelText("Control de la mentira 1"), { target: { value: "SELECT id FROM unidos GROUP BY id HAVING COUNT(*) > 1" } });
    fireEvent.click(screen.getByRole("button", { name: /Entregar/ }));
    for (let i = 0; i < 40; i++) await new Promise((r) => setTimeout(r, 25));
    expect((document.body.textContent ?? "").includes("corrección"), "se reveló algo tras una escritura fallida").toBe(false);
    expect(spies.passLesson, "se dio XP tras una escritura fallida").not.toHaveBeenCalled();
  }, 40000);

  it("retencion (código vencida): una respuesta correcta que no se puede registrar no revela la solución ni da XP", async () => {
    spies.fire.mockImplementation(async () => {
      throw new Error("dexie");
    });
    const { env, cellId, item } = await mountDueRetencion("p206-ret-timeout");
    if (item.data.forma !== "codigo") throw new Error("no codigo");
    render(<RetencionRunner item={item} cellCode="P2-06" cellId={cellId} readModel={env.store.getState().readModel} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("Tu función"), { target: { value: item.data.solucion.js! } });
    fireEvent.click(screen.getByRole("button", { name: /Ejecutar y calificar/ }));
    await flush();
    expect((document.body.textContent ?? "").includes("solución") && !!document.querySelector("pre"), "se reveló la solución tras una escritura fallida").toBe(false);
    expect(spies.passLesson, "se dio XP tras una escritura fallida").not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

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

const tactilCtrl = (el: HTMLElement): boolean => tactil(el) || (el.tagName === "LABEL" && !el.querySelector("input")) || (el.tagName === "LABEL" && parseFloat(getComputedStyle(el).minHeight) >= 44);

describe("kit · táctil y escape (rc26) — seis corredores", () => {
  // historial in fallas, forense visible, retencion code vencida; the four JS ones in their fixtures. Every button,
  // summary, select and label-with-input measures ≥ 44 px, and «Cerrar» closes.
  const items = {
    contraejemplo: () => realForgeItem("A1-01", "a1-01-contra-primera", "contraejemplo"),
    mutantes: () => realForgeItem("A1-01", "a1-01-mut-frontera", "mutantes"),
    desvanecido: () => realForgeItem("A1-01", "a1-01-desv-frontera", "desvanecido"),
    fallas: () => realForgeItem("S2-02", "s202-lab-escalera", "historial"),
    forense: () => forgeItem(BLOCKS.forense, "forense"),
  };
  const comps = { contraejemplo: ContraejemploRunner, mutantes: MutantesRunner, desvanecido: DesvanecidoRunner, fallas: HistorialRunner, forense: ForenseRunner };

  for (const key of Object.keys(items) as (keyof typeof items)[]) {
    it(`${key}: todo botón, summary, select y label mide ≥ 44 px y «Cerrar» funciona`, () => {
      let closed = false;
      const Comp = comps[key] as (p: RunnerProps) => ReactElement;
      const p = { ...props(items[key]()), onClose: () => (closed = true) };
      render(<Comp {...p} />);
      const controls = [...document.querySelectorAll("button, summary, select")] as HTMLElement[];
      const choiceLabels = ([...document.querySelectorAll("label")] as HTMLElement[]).filter((l) => l.querySelector('input[type="radio"], input[type="checkbox"]'));
      expect(controls.length).toBeGreaterThan(0);
      for (const el of [...controls, ...choiceLabels]) expect(tactil(el), `un control del corredor mide menos de 44 px (${key})`).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
      expect(closed).toBe(true);
    });
  }

  it("retencion (defensa vencida): sus radios y botón miden ≥ 44 px y «Cerrar» funciona", async () => {
    const { env, cellId, item } = await mountDueRetencion("p206-ret-inventario");
    let closed = false;
    render(<RetencionRunner item={item} cellCode="P2-06" cellId={cellId} readModel={env.store.getState().readModel} onClose={() => (closed = true)} />);
    expect(screen.getAllByRole("radio").length, "la retención de defensa no se abrió (no está vencida)").toBeGreaterThan(0);
    const controls = [...document.querySelectorAll("button, summary, select")] as HTMLElement[];
    const choiceLabels = ([...document.querySelectorAll("label")] as HTMLElement[]).filter((l) => l.querySelector('input[type="radio"], input[type="checkbox"]'));
    for (const el of [...controls, ...choiceLabels]) expect(tactilCtrl(el), "un control del corredor mide menos de 44 px (retencion)").toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(closed).toBe(true);
    vi.restoreAllMocks();
  });

  it("ningún archivo nuevo de corredor usa dangerouslySetInnerHTML ni innerHTML", () => {
    const dir = join(process.cwd(), "src", "forge", "ui", "exercises");
    for (const f of ["ForenseRunner.tsx", "RetencionRunner.tsx", "kit.tsx"]) {
      const src = readFileSync(join(dir, f), "utf8");
      expect(/dangerouslySetInnerHTML|innerHTML/.test(src), `HTML sin escapar en un corredor de Forge (${f})`).toBe(false);
    }
  });
});

describe("kit · los 61 ítems reales montan su corredor sin PENDING_TEXT (§11.2.8)", () => {
  const TIPOS: RunnerType[] = ["contraejemplo", "mutantes", "desvanecido", "forense", "retencion", "historial"];
  const allReal = () => {
    const d = join(process.cwd(), "content", "forge", "exercises");
    return readdirSync(d)
      .filter((f) => f.endsWith(".md"))
      .flatMap((f) => (parseExercisesMd(readFileSync(join(d, f), "utf8"))?.exercises ?? []).filter((e): e is RunnerProps["item"] => e.kind === "forge"));
  };

  it("cada ítem de los seis tipos monta y no pinta el texto pendiente", async () => {
    const comps: Record<string, (p: RunnerProps) => ReactElement> = {
      contraejemplo: ContraejemploRunner as never,
      mutantes: MutantesRunner as never,
      desvanecido: DesvanecidoRunner as never,
      forense: ForenseRunner as never,
      retencion: RetencionRunner as never,
      historial: HistorialRunner as never,
    };
    const reales = allReal().filter((it) => TIPOS.includes(it.type as RunnerType) && !(it.type === "historial" && (it.data as { modo?: string }).modo === "traza"));
    expect(reales.length).toBeGreaterThanOrEqual(60);
    for (const it of reales) {
      const Comp = comps[it.type]!;
      const { unmount } = render(<Comp {...props(it)} />);
      expect(document.body.textContent, `${it.type} ${it.itemId} pintó el texto pendiente`).not.toContain(PENDING_TEXT);
      unmount();
    }
  });
});
