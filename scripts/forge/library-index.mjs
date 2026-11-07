#!/usr/bin/env node
// library-index: índice de Lecturas → src/forge/data/library-index.json (design poblar §5.2). GENERADO (en .gitignore).
// Corre después de books-publish.mjs, antes de dev, build, test y typecheck (package.json), y solo como
// `pnpm forge:library-index`.
//
// STUB de la Fase 0 (§10): escribe el índice vacío `{ "v": 1, "celdas": {} }`. El cuerpo (las 136 celdas con libro,
// banco y estado de autoría, la paridad con authoring.ts) lo escribe poblar/lecturas. Sin caché: cada corrida
// reescribe el archivo entero.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Escribe src/forge/data/library-index.json bajo `root`. Fase 0: el índice vacío. */
export function writeLibraryIndex(root = ROOT) {
  const index = { v: 1, celdas: {} };
  const dataDir = path.join(root, "src/forge/data");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(path.join(dataDir, "library-index.json"), JSON.stringify(index, null, 1) + "\n");
  return { ok: true, celdas: Object.keys(index.celdas).length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = writeLibraryIndex();
  console.log(`[library-index] stub de la Fase 0: ${r.celdas} celdas`);
}
