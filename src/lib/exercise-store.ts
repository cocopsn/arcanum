import Dexie, { type Table } from "dexie";
import { parseExercisesMd, type ExerciseBankMeta } from "@/lib/exercises-md";
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

export type SaveBankResult = { ok: true; bank: { id: string; meta: ExerciseBankMeta; count: number } } | { ok: false; error: string; details?: string[] };

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
  const parsed = parseExercisesMd(md);
  if (!parsed) {
    return { ok: false, error: "Formato inválido: el .md no cumple el contrato de ejercicios (frontmatter kind: exercises + al menos un ejercicio bien formado)." };
  }
  const v = await validateBank(parsed, { pyRun: opts.pyRun, jsRun: opts.jsRun, trustPython: opts.source === "seed" });
  if (!v.ok) {
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
    source: opts.source ?? "import",
    ts: Date.now(),
  };
  await db().banks.put(row);
  return { ok: true, bank: { id, meta: parsed.meta, count: parsed.exercises.length } };
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
  return banks.flatMap((b) => parseExercisesMd(b.md)?.exercises ?? []);
}
