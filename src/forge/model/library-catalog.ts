// Filas de Engineering Forge del catálogo de Lecturas (design poblar §5.1, §5.3 y §5.6). Puro salvo forgeLibraryIndex(),
// que carga library-index.json en un chunk perezoso. Vive bajo src/forge/, así que nunca entra al chunk de página (H21).
// Las filas sólo llevan título, celda, ruta, minutos, ítems, estados y generated_by (D12: ningún enunciado, hecho
// oculto ni giro).
import type { BookRow } from "@/lib/book-store";
import type { ExerciseBankRow } from "@/lib/exercise-store";
import type { LibraryRow, Autoria } from "@/lib/library/types";
import type { LibraryCell, LibraryIndex } from "@/forge/model/library-types";
import type { ReadModel, ModuleRM } from "@/core/read-model";
import { bookAvailability } from "@/lib/offline/rules";
import { FORGE_SPINE } from "@/lib/spines-forge";
import { FORGE_GOAL_ID } from "@/core/forge-verdict";
import { forgeCellId } from "@/forge/ids";
import { forgeCellState } from "@/forge/model/console-stats";

export const FORGE_WORLD_TITLE = "Engineering Forge";
const BOOK_FILE = /^[a-z0-9-]+\.[0-9a-f]{10}\.md$/;
const CODE = /^[A-Z][A-Z0-9]{0,3}-\d{2}$/;

let indexP: Promise<LibraryIndex | null> | null = null;
/** library-index.json, validado (v === 1). null si el chunk no carga o el formato no es el esperado; la promesa se
 *  descarta al fallar para que «Reintentar» lo vuelva a pedir. */
export function forgeLibraryIndex(): Promise<LibraryIndex | null> {
  indexP ??= import("../data/library-index.json")
    .then((m) => {
      const data = ((m as { default?: unknown }).default ?? m) as LibraryIndex;
      if (!data || data.v !== 1 || typeof data.celdas !== "object") throw new Error("library-index: formato inesperado");
      return data;
    })
    .catch((e) => {
      indexP = null;
      console.warn("[lecturas] el catálogo de Engineering Forge no se pudo cargar", e);
      return null;
    });
  return indexP;
}
/** Sólo para pruebas: olvida el índice memorizado. */
export function resetForgeLibraryIndex(): void {
  indexP = null;
}

export interface ForgeRowsInput {
  index: LibraryIndex;
  readModel: Pick<ReadModel, "modules" | "edges" | "paths" | "goals" | "evidence" | "pendingAi"> & Partial<ReadModel>;
  /** Filas de Dexie cuyo moduleId es una celda de Forge (se funden con su celda). */
  books: readonly BookRow[];
  banks: readonly ExerciseBankRow[];
  /** sha10 del md de cada fila de libro de Forge presente, por moduleId (loaders.sha10). */
  bookSha10: ReadonlyMap<string, string>;
  /** sha10 del md de cada banco de Forge presente, por moduleId. */
  bankSha10: ReadonlyMap<string, string>;
  /** forgeBookCacheFiles(): nombres de archivo en arcanum-forge-books-v1; null sin Cache API. */
  cacheFiles: ReadonlySet<string> | null;
  /** el service worker controla la página: el precache de la build (chunks de bancos incluidos) está completo (§6.2) */
  precacheListo: boolean;
}

const autoriaOf = (c: LibraryCell): Autoria => c.autoria.estado ?? "incompleta";

/** Filas de libro y de banco de las 136 celdas del índice. */
export function forgeRows(input: ForgeRowsInput): LibraryRow[] {
  const { index, readModel } = input;
  const byId = new Map<string, ModuleRM>(readModel.modules.map((m) => [m.id, m]));
  const cellTitle = new Map(FORGE_SPINE.cells.map((c) => [c.id, c.title]));
  const pathBySlug = new Map(FORGE_SPINE.paths.map((p) => [p.slug, p]));
  const world = { goalId: FORGE_GOAL_ID, title: FORGE_WORLD_TITLE };
  const out: LibraryRow[] = [];
  for (const code of Object.keys(index.celdas).sort()) {
    if (!CODE.test(code)) continue;
    const c = index.celdas[code]!;
    const p = pathBySlug.get(c.ruta);
    if (!p) continue; // un código que no está en FORGE_SPINE se descarta (§5.7)
    const id = forgeCellId(code);
    const route = { id: p.id, slug: p.slug, name: p.name };
    const cell = { id, code, title: cellTitle.get(id) ?? code };
    const sealed = forgeCellState(byId.get(id), readModel as ReadModel, byId) === "sellado";
    // ── libro ──
    const bookRow = input.books.find((b) => b.moduleId === id) ?? null;
    if (c.libro && BOOK_FILE.test(c.libro.file)) {
      const imported = bookRow?.source === "import";
      const av = bookAvailability({
        row: bookRow ? { source: bookRow.source, sha10: input.bookSha10.get(id) ?? "" } : null,
        current: { file: c.libro.file, sha10: c.libro.sha10 },
        cacheFiles: input.cacheFiles,
      });
      out.push({
        key: `forge-libro:${code}`,
        kind: "libro",
        world,
        route,
        cell,
        title: c.libro.title,
        minutes: c.libro.minutes,
        items: null,
        autoria: imported ? "importado" : autoriaOf(c),
        generatedBy: imported ? bookRow!.meta?.generatedBy ?? "" : c.libro.generated_by,
        disponible: av.disponible,
        disponibleDetalle: av.detalle,
        sealed,
        source: "forge",
        forge: { file: c.libro.file, sha10: c.libro.sha10, bankCodigo: !!c.banco?.codigo },
      });
    } else {
      out.push({
        key: `forge-libro:${code}`,
        kind: "libro",
        world,
        route,
        cell,
        title: cell.title,
        minutes: null,
        items: null,
        autoria: autoriaOf(c),
        generatedBy: "",
        disponible: "pendiente",
        disponibleDetalle: "Libro pendiente",
        sealed,
        source: "forge",
        forge: { file: null, sha10: null, bankCodigo: !!c.banco?.codigo },
      });
    }
    // ── banco ──
    if (c.banco) {
      const rows = input.banks.filter((b) => b.moduleId === id);
      const imported = rows.find((r) => r.source === "import");
      const seeded = rows.find((r) => r.source === "seed");
      const vigente = !!seeded && input.bankSha10.get(id) === c.banco.sha10;
      const disponible = imported ? "si" : vigente || input.precacheListo ? "incluido" : "no";
      out.push({
        key: `forge-banco:${code}`,
        kind: "banco",
        world,
        route,
        cell,
        title: c.banco.title || cell.title,
        minutes: null,
        items: { total: c.banco.items, disponibles: Math.max(0, c.banco.items - c.banco.pendientes.length) },
        autoria: imported ? "importado" : autoriaOf(c),
        generatedBy: imported ? imported.meta?.generatedBy ?? "" : c.banco.generated_by,
        disponible,
        disponibleDetalle: imported ? "En este dispositivo · tu importación" : disponible === "incluido" ? "Incluido en la app" : "Abre la app una vez con conexión",
        sealed,
        source: "forge",
        forge: { file: null, sha10: c.banco.sha10, bankCodigo: c.banco.codigo },
      });
    }
  }
  return out;
}
