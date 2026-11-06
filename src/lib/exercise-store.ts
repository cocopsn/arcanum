import Dexie, { type Table } from "dexie";
import { explainExercisesMd, parseExercisesMd, type ExerciseBankMeta } from "@/lib/exercises-md";
import { validateBank, type ExecRunner } from "@/lib/exercises-validate";
import { slugify } from "@/lib/book";
import type { Exercise } from "@/lib/exercise";

// Offline CURATED-EXERCISE store — a SEPARATE Dexie DB from the event log (the log is SACRED; a bank is
// reconstructible CACHE — the .md is the truth). Mirrors book-store.ts. Banks are anchored to a cell by
// module_id (same id as the sibling book). Ingesting a bank RE-VALIDATES every reference solution against
// its own cases (validateBank) before persisting → a broken AI-generated bank never lands. Reading a bank
// re-parses its .md (deterministic, stable ids) so the runtime never depends on stale parsed state.
// Device-local cache → Date.now() is fine (this is not the atemporal fold, and never the log).

export interface ExerciseBankRow {
  /** primary key: the module_id (anchored) or a slug of the title (loose) */
  id: string;
  moduleId: string | null;
  spine: string;
  title: string;
  /** the raw .md — the source of truth, so the exercises are always reconstructible */
  md: string;
  meta: ExerciseBankMeta;
  /** number of runtime exercises (code langs counted separately) — for display */
  count: number;
  bytes: number;
  source: "seed" | "import";
  ts: number;
  /** Exercise ids of Forge items whose ingestion check is still a Phase-0 stub (regla de pendientes, §9.2): the
   *  bank was accepted, those items were NOT validated and loadBankForModule never offers them. Absent = none. */
  pendientes?: string[];
}

class ExercisesDB extends Dexie {
  banks!: Table<ExerciseBankRow, string>;
  constructor(name = "arcanum-exercises") {
    super(name);
    this.version(1).stores({ banks: "id, moduleId, spine" });
  }
}
let _db: ExercisesDB | null = null;
function db(): ExercisesDB {
  return (_db ??= new ExercisesDB());
}

export type SaveBankResult =
  | { ok: true; bank: { id: string; meta: ExerciseBankMeta; count: number; pendientes: string[] } }
  | { ok: false; error: string; details?: string[]; missingCheck?: true };

export interface SaveBankOpts {
  source?: "seed" | "import";
  /** the Python runner (runPy) for validating python references at import. */
  pyRun?: ExecRunner;
  /** override the JS runner (app import passes the shielded worker runJs). */
  jsRun?: ExecRunner;
}

/** Parse + VALIDATE (auto-consistency) + persist a bank .md. Returns the specific validation errors when a
 *  reference solution doesn't pass its own cases (honest — never ingests a broken bank). null-safe. */
export async function saveExerciseBank(md: string, opts: SaveBankOpts = {}): Promise<SaveBankResult> {
  const explained = explainExercisesMd(md);
  if (!explained.ok) {
    // the reason names the exercise and the field (CA-31), so an author knows what to fix
    return { ok: false, error: "Formato inválido: el .md no cumple el contrato de ejercicios (frontmatter kind: exercises + al menos un ejercicio bien formado).", details: [explained.error] };
  }
  const parsed = explained.bank;
  const source = opts.source ?? "import";
  const v = await validateBank(parsed, { pyRun: opts.pyRun, jsRun: opts.jsRun, trustPython: source === "seed", source });
  if (!v.ok) {
    if (v.missingCheck) return { ok: false, error: "No descargado · requiere conexión una vez.", details: v.errors, missingCheck: true };
    return { ok: false, error: "El banco tiene ejercicios corruptos — la solución de referencia no pasa sus propios test cases:", details: v.errors };
  }
  const id = parsed.meta.moduleId ?? slugify(parsed.meta.title);
  const row: ExerciseBankRow = {
    id,
    moduleId: parsed.meta.moduleId,
    spine: parsed.meta.spine,
    title: parsed.meta.title,
    md,
    meta: parsed.meta,
    count: parsed.exercises.length,
    bytes: md.length,
    source,
    ts: Date.now(),
    ...(v.pendientes.length ? { pendientes: v.pendientes } : {}),
  };
  await db().banks.put(row);
  return { ok: true, bank: { id, meta: parsed.meta, count: parsed.exercises.length, pendientes: v.pendientes } };
}

export async function getBank(id: string): Promise<ExerciseBankRow | null> {
  try {
    return (await db().banks.get(id)) ?? null;
  } catch {
    return null;
  }
}
export async function getBanksForModule(moduleId: string): Promise<ExerciseBankRow[]> {
  try {
    return await db().banks.where("moduleId").equals(moduleId).toArray();
  } catch {
    return [];
  }
}
export async function listBanks(): Promise<ExerciseBankRow[]> {
  try {
    return await db().banks.toArray();
  } catch {
    return [];
  }
}
export async function deleteBank(id: string): Promise<void> {
  await db().banks.delete(id);
}
export async function totalBankBytes(): Promise<number> {
  try {
    return (await db().banks.toArray()).reduce((n, b) => n + b.bytes, 0);
  } catch {
    return 0;
  }
}

/** The curated exercises for a cell — flattened from every ingested bank anchored to it. Re-parses the
 *  stored .md (deterministic, stable ids) so the exercise model is always fresh from the source of truth. */
export async function loadBankForModule(moduleId: string): Promise<Exercise[]> {
  const banks = await getBanksForModule(moduleId);
  return banks.flatMap((b) => {
    const pending = new Set(b.pendientes ?? []);
    // a pending item (stub check, §9.2) was never validated → it is never offered
    return (parseExercisesMd(b.md)?.exercises ?? []).filter((ex) => !pending.has(ex.id));
  });
}
