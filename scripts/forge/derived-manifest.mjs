#!/usr/bin/env node
// Paso 0 del Atlas (RF-A9, CA-55; design §11.1).
//
//   node scripts/forge/derived-manifest.mjs --cache <dir>        (o ARCANUM_FORGE_CACHE=<dir>)
//
// Regenera, dentro de la caché del barrido (fuera de todo repo):
//   1. derived/docs-aliases.json: las URLs descubiertas por enlaces y su destino final, tomadas de
//      docs/state.jsonl (sólo url, final_url, source y soft_404; ningún cuerpo ni cabecera). Es lo único
//      que atlas-build necesita para los alias y no está en las particiones.
//   2. derived/manifest.json: sólo archivos que existen, con bytes y sha256[:10], ordenados y sin rutas
//      absolutas ni fechas, para que dos corridas sobre la misma caché den bytes idénticos.
// Falla (código 1) si derived/ contiene un archivo de learn, certification o listados de YouTube
// (D1 del orquestador: esos datos no se usan).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const FORBIDDEN_FILE = /(^|[\\/._-])(learn|certification|certifications|youtube)([\\/._-]|$)/i;

function argValue(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}

function sha10(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 10);
}

function walk(dir, base, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, base, out);
    else if (e.isFile()) out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

/** Quita fragmento; deja la URL tal cual la pidió el barrido. */
function sinFragmento(u) {
  const i = u.indexOf("#");
  return i >= 0 ? u.slice(0, i) : u;
}

export function buildAliases(cache) {
  const state = path.join(cache, "docs", "state.jsonl");
  if (!fs.existsSync(state)) return null;
  const rows = [];
  for (const line of fs.readFileSync(state, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    if (typeof r.source !== "string" || !r.source.startsWith("discovered:")) continue;
    if (typeof r.url !== "string" || typeof r.final_url !== "string") continue;
    rows.push([r.url, sinFragmento(r.final_url), r.soft_404 === true]);
  }
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return { v: 1, fuente: "docs/state.jsonl: url, final_url, source, soft_404", descubiertas: rows };
}

export function run(argv, env = process.env) {
  const cache = argValue(argv, "--cache") ?? env.ARCANUM_FORGE_CACHE;
  if (!cache) return { code: 1, err: "derived-manifest: falta --cache <dir> o ARCANUM_FORGE_CACHE" };
  const derived = path.join(cache, "derived");
  if (!fs.existsSync(derived)) return { code: 1, err: `derived-manifest: no existe ${derived}` };

  const aliases = buildAliases(cache);
  if (aliases) fs.writeFileSync(path.join(derived, "docs-aliases.json"), JSON.stringify(aliases) + "\n");

  const files = walk(derived, derived, []).filter((f) => f !== "manifest.json").sort();
  const prohibidos = files.filter((f) => FORBIDDEN_FILE.test(f));
  if (prohibidos.length) {
    return {
      code: 1,
      err: `derived-manifest: derived contiene archivos de learn, certification o listados de YouTube: ${prohibidos.join(", ")}`,
    };
  }
  const entries = files.map((f) => {
    const buf = fs.readFileSync(path.join(derived, f));
    return { file: f, bytes: buf.length, sha256_10: sha10(buf) };
  });
  const manifest = {
    v: 1,
    files: entries,
    total_bytes: entries.reduce((s, e) => s + e.bytes, 0),
    file_count: entries.length,
  };
  const text = JSON.stringify(manifest, null, 1) + "\n";
  fs.writeFileSync(path.join(derived, "manifest.json"), text);
  return {
    code: 0,
    out: `derived-manifest: ${entries.length} archivos, ${manifest.total_bytes} bytes, manifest sha256[:10] ${sha10(text)}` +
      (aliases ? `; ${aliases.descubiertas.length} URLs descubiertas en docs-aliases.json` : "; sin docs/state.jsonl"),
  };
}

const same = (a, b) => (process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b);
if (process.argv[1] && same(path.resolve(process.argv[1]), fileURLToPath(import.meta.url))) {
  const r = run(process.argv.slice(2));
  if (r.out) console.log(r.out);
  if (r.err) console.error(r.err);
  process.exit(r.code);
}
