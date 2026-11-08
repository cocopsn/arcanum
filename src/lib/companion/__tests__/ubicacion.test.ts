// Ubicación pedagógica (design §12.2, §12.4). armarUbicacion pura sobre read model, view model y sensado de prueba.
import { describe, expect, it } from "vitest";
import type { ReadModel } from "@/core/read-model";
import type { ViewModel } from "@/core/present";
import type { Sensado } from "@/ui/companion/sensor";
import { armarUbicacion, tiposSugeridos } from "../ubicacion";

const rmVacio = (over: Partial<ReadModel> = {}): ReadModel =>
  ({
    goals: [],
    paths: [],
    modules: [],
    edges: [],
    qualifiedDays: [],
    stats: {} as never,
    reviewDue: [],
    notes: [],
    sleepCycles: [],
    obligations: [],
    canvas: {} as never,
    celebratedGrade: null,
    evaluations: [],
    gates: [],
    missions: [],
    pendingAi: [],
    evidence: [],
    forgeVerdicts: [],
    ...over,
  }) as ReadModel;

const vm = (over: Partial<ViewModel> = {}): ViewModel => ({ modules: [], reviewQueue: [], streakAlive: true, ritoPending: false, todayQualified: true, canvas: {} as never, ...over });

const sensado = (over: Partial<Sensado> = {}): Sensado => ({
  mundoData: "forge",
  resume: { v: 1, world: "g1", cell: "cell-1", bookId: null, library: false, ts: 0 } as never,
  superficie: "celda",
  tituloDialogo: "Edits y concurrencia",
  libroEtiqueta: null,
  lenguaje: null,
  tipoItem: null,
  codigoForge: "P2-06",
  itemRetencion: false,
  ...over,
});

describe("tiposSugeridos (§12.4)", () => {
  it("por modo de falla", () => {
    expect(tiposSugeridos("concepto", false)).toEqual(["multiple_choice", "production"]);
    expect(tiposSugeridos("ejecucion", false)).toEqual(["code"]);
  });
  it("sin modo: code; en Alemán production + multiple_choice", () => {
    expect(tiposSugeridos(undefined, false)).toEqual(["code"]);
    expect(tiposSugeridos(undefined, true)).toEqual(["production", "multiple_choice"]);
  });
});

describe("armarUbicacion (§12.2)", () => {
  it("mundo, superficie y celda con estado de Forge y masteryPct de vm", () => {
    const rm = rmVacio({ modules: [{ id: "cell-1", title: "Edits", goalId: "g1" } as never] });
    const u = armarUbicacion(sensado(), rm, vm({ modules: [{ id: "cell-1", retrievability: 0.73 }] }), {
      tituloMundo: "Engineering Forge",
      extrasForge: { codigo: "P2-06", estado: "en_curso", competencia: "en_aprendizaje" },
    });
    expect(u.mundo).toBe("Engineering Forge");
    expect(u.celda?.estado).toBe("en_curso");
    expect(u.celda?.codigo).toBe("P2-06");
    expect(u.celda?.masteryPct).toBe(73);
  });

  it("modosFalla: los dos últimos no nulos de los veredictos Forge de la celda", () => {
    const rm = rmVacio({
      modules: [{ id: "cell-1", title: "x", goalId: "g1" } as never],
      forgeVerdicts: [
        { moduleId: "cell-1", failureMode: "concepto" },
        { moduleId: "cell-1", failureMode: null },
        { moduleId: "cell-1", failureMode: "ejecucion" },
        { moduleId: "cell-1", failureMode: "defensa" },
      ] as never,
    });
    const u = armarUbicacion(sensado(), rm, vm(), { tituloMundo: "Engineering Forge", extrasForge: { codigo: "P2-06" } });
    expect(u.modosFalla).toEqual(["ejecucion", "defensa"]);
  });

  it("últimoVeredicto del GateRM, brechas de la evaluación y repasos de la reviewQueue", () => {
    const rm = rmVacio({
      modules: [
        { id: "cell-1", title: "x", goalId: "g1" } as never,
        { id: "rev-1", title: "Repaso A", goalId: "g1" } as never,
      ],
      gates: [{ moduleId: "cell-1", passed: false, summary: "faltó defender el invariante" } as never],
      evaluations: [{ moduleId: "cell-1", gaps: ["no justifica", "", "falta un caso borde"] } as never],
    });
    const u = armarUbicacion(sensado(), rm, vm({ reviewQueue: [{ moduleId: "rev-1", dueDays: 0 } as never] }), { tituloMundo: "Engineering Forge", extrasForge: { codigo: "P2-06" } });
    expect(u.ultimoVeredicto).toEqual({ aprobado: false, resumen: "faltó defender el invariante" });
    expect(u.brechas).toEqual(["no justifica", "falta un caso borde"]);
    expect(u.repasos).toEqual(["Repaso A"]);
  });

  it("libro: superficie libro con su etiqueta", () => {
    const u = armarUbicacion(sensado({ superficie: "libro", libroEtiqueta: "Árboles", resume: { v: 1, world: "g1", cell: null, bookId: "b1", library: false, ts: 0 } as never, codigoForge: null }), rmVacio(), vm(), { tituloMundo: "ITC" });
    expect(u.libro).toEqual({ titulo: "Árboles" });
    expect(u.celda).toBeUndefined();
  });
});
