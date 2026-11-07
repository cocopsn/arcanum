import { describe, expect, it } from "vitest";
import { classicRows, placeRow, SUELTOS } from "@/lib/library/catalog";
import { forgeCellId } from "@/forge/ids";
import type { BookRow } from "@/lib/book-store";
import type { ExerciseBankRow } from "@/lib/exercise-store";
import type { ReadModel } from "@/core/read-model";

// Filas clásicas de Lecturas (design poblar §5.1). Mundo por la celda anclada; un suelto sólo se cuelga de un mundo si
// su espina tiene un tema propio (no el de omisión); las filas de celdas de Forge nunca salen como clásicas.
const ITC = { id: "g-itc", title: "ITC", priority: 1, color: "", sigil: "", archived: false };
const ALE = { id: "g-ale", title: "Alemán", priority: 2, color: "", sigil: "", archived: false };
const NUEVO = { id: "g-nuevo", title: "Mi mundo nuevo", priority: 3, color: "", sigil: "", archived: false }; // tema de omisión
const rm = {
  goals: [ITC, ALE, NUEVO],
  paths: [{ id: "p-itc", goalId: "g-itc", slug: "itc", name: "ITC · base", description: "", order: 0, archived: false }],
  modules: [{ id: "m-1", goalId: "g-itc", pathId: "p-itc", title: "CS50", archived: false, prereqs: [], status: "idle" } as unknown as ReadModel["modules"][number]],
  edges: [],
} as unknown as Pick<ReadModel, "goals" | "paths" | "modules" | "edges">;

const book = (over: Partial<BookRow>): BookRow =>
  ({ id: "b", moduleId: null, spine: "", title: "Libro", md: "", meta: { generatedBy: "Claude Sonnet 5", readingMinutes: 30 } as BookRow["meta"], bytes: 1, source: "seed", ts: 1, ...over }) as BookRow;
const bank = (over: Partial<ExerciseBankRow>): ExerciseBankRow =>
  ({ id: "k", moduleId: null, spine: "", title: "Banco", md: "", meta: { generatedBy: "" } as ExerciseBankRow["meta"], count: 6, bytes: 1, source: "seed", ts: 1, ...over }) as ExerciseBankRow;

describe("Lecturas · filas clásicas (design poblar §5.1)", () => {
  it("una fila anclada toma mundo, ruta y celda de su módulo", () => {
    const p = placeRow({ moduleId: "m-1", spine: "ITC" }, rm);
    expect(p.world).toEqual({ goalId: "g-itc", title: "ITC" });
    expect(p.route).toEqual({ id: "p-itc", slug: "itc", name: "ITC · base" });
    expect(p.cell.title).toBe("CS50");
  });

  it("un suelto con espina conocida se cuelga de su mundo por el tema", () => {
    expect(placeRow({ moduleId: null, spine: "Alemán" }, rm).world.goalId).toBe("g-ale");
  });

  it("un suelto con espina desconocida va a «Sueltos», nunca al mundo del tema de omisión", () => {
    const p = placeRow({ moduleId: null, spine: "Una espina que no existe" }, rm);
    expect(p.world.goalId, `un libro suelto con espina desconocida se colgó de ${p.world.title}`).toBeNull();
    expect(p.world.title).toBe(SUELTOS);
  });

  it("semillas «incluido» y «Autorado»; importaciones «tu importación» e «Importado»; generated_by tal cual", () => {
    const rows = classicRows([book({ id: "s", moduleId: "m-1" }), book({ id: "i", moduleId: "m-1", source: "import", meta: { generatedBy: "yo" } as BookRow["meta"] })], [bank({ moduleId: "m-1" })], rm);
    const s = rows.find((r) => r.key === "libro:s")!;
    const i = rows.find((r) => r.key === "libro:i")!;
    expect([s.disponible, s.autoria, s.generatedBy, s.minutes]).toEqual(["incluido", "autorado", "Claude Sonnet 5", 30]);
    expect([i.disponible, i.autoria, i.disponibleDetalle]).toEqual(["si", "importado", "En este dispositivo · tu importación"]);
    expect(rows.find((r) => r.key === "banco:k")!.items).toEqual({ total: 6, disponibles: 6 });
  });

  it("una fila de Dexie de una celda de Forge no sale como clásica (se funde con su celda del índice)", () => {
    const f004 = forgeCellId("F0-04");
    const rows = classicRows([book({ id: "forge-f0-04", moduleId: f004, spine: "Engineering Forge" }), book({ id: "x", moduleId: "m-1" })], [bank({ id: "fk", moduleId: f004 })], rm);
    expect(rows.filter((r) => r.cell.id === f004 || r.key.includes("forge-f0-04")), "el libro de F0-04 aparece dos veces").toHaveLength(0);
    expect(rows).toHaveLength(1);
  });
});
