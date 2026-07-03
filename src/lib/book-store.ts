import Dexie, { type Table } from "dexie";
import { parseBook, slugify, type BookMeta } from "@/lib/book";

// Offline DEEP-READING store — a SEPARATE Dexie DB from the event log. The log is SACRED; a book is
// reconstructible CACHE (the .md is the truth, generated externally). Downloaded books read with the
// network off, always. Reading PROGRESS is device-local session state (scroll/sections), NOT the log —
// reading is Phase 1 input; it never grants mastery (only the adversarial gate does). Zero placebo.
// Device-local cache → Date.now() is fine (this is not the atemporal fold).

export interface BookRow {
  /** primary key: the module_id (anchored) or a slug of the title (loose) */
  id: string;
  moduleId: string | null;
  spine: string;
  title: string;
  /** the raw .md — the source of truth, so the render is always reconstructible */
  md: string;
  meta: BookMeta;
  bytes: number;
  source: "seed" | "import";
  ts: number;
}
export interface ProgressRow {
  id: string;
  scrollPct: number;
  readSections: string[];
  completed: boolean;
  ts: number;
}

class BooksDB extends Dexie {
  books!: Table<BookRow, string>;
  progress!: Table<ProgressRow, string>;
  constructor(name = "arcanum-books") {
    super(name);
    this.version(1).stores({ books: "id, moduleId, spine", progress: "id" });
  }
}
let _db: BooksDB | null = null;
function db(): BooksDB {
  return (_db ??= new BooksDB());
}

export interface SavedBook {
  id: string;
  meta: BookMeta;
}

/** Parse + store a .md book. Returns null when the .md does NOT satisfy the contract (honest — the
 *  caller shows "formato inválido", never fakes a book). Keyed by module_id (anchored) or title slug. */
export async function saveBook(md: string, source: "seed" | "import" = "import"): Promise<SavedBook | null> {
  const parsed = parseBook(md);
  if (!parsed) return null;
  const id = parsed.meta.moduleId ?? slugify(parsed.meta.title);
  const row: BookRow = {
    id,
    moduleId: parsed.meta.moduleId,
    spine: parsed.meta.spine,
    title: parsed.meta.title,
    md,
    meta: parsed.meta,
    bytes: md.length,
    source,
    ts: Date.now(),
  };
  await db().books.put(row);
  return { id, meta: parsed.meta };
}

export async function getBook(id: string): Promise<BookRow | null> {
  try {
    return (await db().books.get(id)) ?? null;
  } catch {
    return null;
  }
}
/** The book anchored to a roadmap cell (module_id), or null if none is downloaded for it. */
export async function getBookForModule(moduleId: string): Promise<BookRow | null> {
  try {
    return (await db().books.where("moduleId").equals(moduleId).first()) ?? null;
  } catch {
    return null;
  }
}
export async function listBooks(): Promise<BookRow[]> {
  try {
    return await db().books.toArray();
  } catch {
    return [];
  }
}
export async function deleteBook(id: string): Promise<void> {
  await db().books.delete(id);
  await db().progress.delete(id);
}
export async function totalBookBytes(): Promise<number> {
  try {
    return (await db().books.toArray()).reduce((n, b) => n + b.bytes, 0);
  } catch {
    return 0;
  }
}

// ── reading progress (device-local session state; NEVER the log, NEVER mastery) ──
export async function getProgress(id: string): Promise<ProgressRow | null> {
  try {
    return (await db().progress.get(id)) ?? null;
  } catch {
    return null;
  }
}
export async function setProgress(id: string, patch: Partial<Omit<ProgressRow, "id" | "ts">>): Promise<void> {
  const prev = (await getProgress(id)) ?? { id, scrollPct: 0, readSections: [], completed: false, ts: 0 };
  await db().progress.put({ ...prev, ...patch, id, ts: Date.now() });
}
