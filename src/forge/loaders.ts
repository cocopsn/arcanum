import type { ReadModel } from "@/core/read-model";
import type { ForgeBankItem } from "@/forge/bank/registry";
import type { ForgeRouteData } from "@/forge/route-data";

// LAZY LOADERS of Forge (design §6.2, §6.3, §22.3). The SIGNATURES are frozen in Phase 0; these bodies are STUBS
// that answer honestly «not downloaded» (they never fabricate a book, a bank or a route). forge/p-plataforma
// writes the real bodies in Phase 1 (with banks-loader.test.ts and books-loader.test.ts); the tests of the other
// branches mock this module.

export type EnsureResult =
  | { ok: true; refreshed: boolean }
  | { ok: false; reason: "desconocido" | "no-descargado" | "despues-del-intento" | "formato" };

export type EnsureBankResult =
  | { ok: true; refreshed: boolean; pendientes: string[] }
  | { ok: false; reason: "desconocido" | "no-descargado" | "invalido"; details?: string[] };

/** Route data of one of the 19 paths (`import(./data/routes/<slug>.json)` after checking the slug). Stub: null. */
export async function loadForgeRoute(slug: string): Promise<ForgeRouteData | null> {
  void slug;
  return null;
}

/** The book .md of a cell from public/forge/books/v1 (by the index, never a URL built from free text). Stub: null. */
export async function loadForgeBookMd(code: string): Promise<string | null> {
  void code;
  return null;
}

/** Materialize (or refresh) the book of a cell in arcanum-books (§6.2). Stub: not downloaded. */
export async function ensureForgeBook(code: string, readModel: ReadModel): Promise<EnsureResult> {
  void code;
  void readModel;
  return { ok: false, reason: "no-descargado" };
}

/** Ingest (or refresh) the bank of a cell with saveExerciseBank(md, { source: "seed" }) (§6.3). Stub: not downloaded. */
export async function ensureForgeBank(code: string): Promise<EnsureBankResult> {
  void code;
  return { ok: false, reason: "no-descargado" };
}

/** Items of the cell's bank and the ids of its pending items (§6.3). Stub: null (no bank on this device). */
export async function loadForgeBankItems(code: string): Promise<{ items: ForgeBankItem[]; pendientes: string[] } | null> {
  void code;
  return null;
}
