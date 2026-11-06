#!/usr/bin/env node
// oembed-fetch — STUB of phase 0 (forge/c0-build). The real script (forge/p-plataforma, phase 1, design §11.6)
// asks YouTube's official oEmbed for the catalog ids at ≤ 1 req/s and writes public/atlas/v1/videos/oembed.json.
// This stub makes NO request: it writes the same file with every item as «sin dato» (the client then shows its
// own label plus «Video no revisado»), prints that, and exits 0 so the build never fails on it.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** Every 11-char YouTube id found as a value of a `youtube`/`id` field in videos.json (best effort). Pure. */
export function catalogIds(videos) {
  const out = new Set();
  const walk = (v, key) => {
    if (typeof v === "string") {
      if ((key === "id" || key === "youtube" || key === "yt") && YT_ID.test(v)) out.add(v);
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(videos, null);
  return [...out].sort();
}

export function stubOembed(ids) {
  const items = {};
  for (const id of ids) items[id] = { estado: "sin dato", procedencia: "oembed" };
  return { v: 1, fetched_at: null, expires_at: null, items };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const vf = path.join(ROOT, "src/forge/data/videos.json");
  let ids = [];
  try {
    if (existsSync(vf)) ids = catalogIds(JSON.parse(readFileSync(vf, "utf8")));
  } catch {
    ids = [];
  }
  const outDir = path.join(ROOT, "public/atlas/v1/videos");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "oembed.json"), JSON.stringify(stubOembed(ids), null, 1) + "\n");
  console.log(`[oembed-fetch] stub de la Fase 0: ${ids.length} videos, todos «sin dato» (sin pedidos a oEmbed)`);
  process.exit(0);
}
