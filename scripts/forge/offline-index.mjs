#!/usr/bin/env node
// offline-index: índice de descarga por ruta → src/forge/data/offline-index.json (design poblar §6.4). GENERADO (en
// .gitignore). Corre después de library-index.mjs, antes de dev, build, test y typecheck (package.json), y solo como
// `pnpm forge:offline-index`.
//
// STUB de la Fase 0 (§10): escribe el índice vacío `{ "v": 1, "atlas_fuente": "", "rutas": {} }`. El cuerpo (libros,
// bancos, Python, particiones del Atlas y figuras de las 19 rutas) lo escribe poblar/offline-motor. Sin caché: cada
// corrida reescribe el archivo entero.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Escribe src/forge/data/offline-index.json bajo `root`. Fase 0: el índice vacío. */
export function writeOfflineIndex(root = ROOT) {
  const index = { v: 1, atlas_fuente: "", rutas: {} };
  const dataDir = path.join(root, "src/forge/data");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(path.join(dataDir, "offline-index.json"), JSON.stringify(index, null, 1) + "\n");
  return { ok: true, rutas: Object.keys(index.rutas).length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = writeOfflineIndex();
  console.log(`[offline-index] stub de la Fase 0: ${r.rutas} rutas`);
}
