#!/usr/bin/env node
// youtube-import (AF2) — STUB of phase 0 (forge/c0-build). The real importer (forge/p-plataforma, phase 1,
// design §11.6) lists the two channels through YouTube Data API v3 with the owner's key and writes
// public/atlas/v1/videos/canales.json (not versioned: YouTube policy III.E.4). This stub never reads the key's
// value, never prints it and makes no request: it only says whether a key is present, writes nothing and exits 0.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PENDIENTE_AF2 = "pendiente de llave del dueño (AF2)";

/** Presence only (never the value). */
export function hasKey(env = process.env) {
  return Boolean(env.YOUTUBE_API_KEY) || existsSync(path.join("D:\\projects\\arcanum-forge-cache", ".env.youtube"));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!hasKey()) console.log(`[youtube-import] ${PENDIENTE_AF2}`);
  else console.log(`[youtube-import] stub de la Fase 0: hay llave, pero el importador aún no está en esta versión; ${PENDIENTE_AF2}`);
  process.exit(0);
}
