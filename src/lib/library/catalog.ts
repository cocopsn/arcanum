// Filas clásicas del catálogo de Lecturas (design poblar §5.1): los libros y bancos de Dexie de los mundos clásicos y las
// importaciones del aprendiz. Puro. Una fila cuyo moduleId es una celda de Forge nunca produce una fila clásica: se
// funde con la fila de esa celda (src/forge/model/library-catalog.ts).
import type { BookRow } from "@/lib/book-store";
import type { ExerciseBankRow } from "@/lib/exercise-store";
import type { LibraryRow } from "@/lib/library/types";
import type { ReadModel, ModuleRM } from "@/core/read-model";
import { themeForGoal } from "@/lib/subject-themes";
import { nodeStatus } from "@/core/roadmap";
import { isForgeCellId } from "@/forge/ids";

export const SUELTOS = "Sueltos";
export const SIN_RUTA = "Sin ruta";

type RM = Pick<ReadModel, "goals" | "paths" | "modules" | "edges">;
type Row = (BookRow | ExerciseBankRow) & { kind: "libro" | "banco" };

/** Mundo, ruta y celda de una fila de Dexie. Anclada: por su celda. Suelta: el goal cuyo tema es el de su espina, sólo
 *  si ese tema no es el de omisión (themeForGoal devuelve el mismo DEFAULT_THEME para cualquier título desconocido). */
export function placeRow(row: { moduleId: string | null; spine: string }, rm: RM): Pick<LibraryRow, "world" | "route" | "cell"> & { mod: ModuleRM | null } {
  const mod = row.moduleId ? rm.modules.find((m) => m.id === row.moduleId && !m.archived) ?? null : null;
  if (mod) {
    const goal = rm.goals.find((g) => g.id === mod.goalId) ?? null;
    const path = mod.pathId ? rm.paths.find((p) => p.id === mod.pathId && !p.archived) ?? null : null;
    return {
      world: goal ? { goalId: goal.id, title: goal.title } : { goalId: null, title: SUELTOS },
      route: path ? { id: path.id, slug: path.slug, name: path.name } : { id: null, slug: null, name: null },
      cell: { id: mod.id, code: null, title: mod.title },
      mod,
    };
  }
  const theme = themeForGoal(row.spine);
  const goal = theme.slug !== "default" ? rm.goals.find((g) => !g.archived && themeForGoal(g.title) === theme) ?? null : null;
  return {
    world: goal ? { goalId: goal.id, title: goal.title } : { goalId: null, title: SUELTOS },
    route: { id: null, slug: null, name: null },
    cell: { id: null, code: null, title: null },
    mod: null,
  };
}

/** Filas clásicas (sin las de celdas de Forge, que se funden con el índice). */
export function classicRows(books: readonly BookRow[], banks: readonly ExerciseBankRow[], rm: RM): LibraryRow[] {
  const byId = new Map(rm.modules.map((m) => [m.id, m]));
  const rows: Row[] = [...books.map((b) => ({ ...b, kind: "libro" as const })), ...banks.map((b) => ({ ...b, kind: "banco" as const }))];
  const out: LibraryRow[] = [];
  for (const r of rows) {
    if (isForgeCellId(r.moduleId)) continue;
    const { world, route, cell, mod } = placeRow(r, rm);
    const imported = r.source === "import";
    const bank = r.kind === "banco" ? (r as ExerciseBankRow) : null;
    const book = r.kind === "libro" ? (r as BookRow) : null;
    const pend = bank?.pendientes?.length ?? 0;
    out.push({
      key: `${r.kind}:${r.id}`,
      kind: r.kind,
      world,
      route,
      cell,
      title: r.title,
      minutes: book ? book.meta?.readingMinutes ?? null : null,
      items: bank ? { total: bank.count, disponibles: Math.max(0, bank.count - pend) } : null,
      autoria: imported ? "importado" : "autorado",
      generatedBy: (r.meta as { generatedBy?: string } | undefined)?.generatedBy ?? "",
      disponible: imported ? "si" : "incluido",
      disponibleDetalle: imported ? "En este dispositivo · tu importación" : "Incluido en la app",
      sealed: mod ? nodeStatus(mod, rm.edges, byId) === "sealed" : false,
      source: r.source,
    });
  }
  return out;
}
