#!/usr/bin/env node
// books-publish: content/forge/books/*.md → public/forge/books/v1/<code>.<sha10>.md + src/forge/data/book-index.json,
// and content/forge/exercises/*.md (+ content/forge/verification/<code>.json) → src/forge/data/bank-index.json.
// Design §6.2 and §5.7. The three outputs are GENERATED (in .gitignore). Deterministic: sorted by code, no dates.
// Runs before dev, build, test and typecheck (package.json), and alone as `pnpm forge:publish`.
//
// Minimal frontmatter parse on purpose: a dependency-free .mjs cannot import parseBook (src/lib/book.ts); the full
// contract is books.test.ts'. This script fails with exit 1 when a book:
//   - starts with a BOM (the browser drops it in res.text() and the sha10 would stop matching),
//   - has no frontmatter or no title (what parseBook rejects),
//   - has a module_id that is not forge-<code> of an existing code (keys of src/forge/data/maestro-urls.json).
//
// bank-index.json, per code: { sha10, verificacion } where verificacion is null (no run) or
//   { sha10, vigente, ejecutables, cubiertos, fallidos }  — sha10 of the verification file; vigente = the run's
//   md sha10 equals the bank's current sha10; counts from the run (cubiertos = passed). See bank-check.mjs.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const sha10 = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 10);

/** Flat key: value frontmatter (same tolerance as parseBook). Returns null without frontmatter. Pure. */
export function parseFrontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    meta[kv[1]] = v;
  }
  return meta;
}

const listMd = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md")).sort() : []);

/** Validate one book's bytes. Returns { ok, code, entry } or { ok:false, error }. Pure (besides hashing). */
export function checkBook(fileName, buf, codes) {
  const base = fileName.replace(/\.md$/, "");
  const code = base.toUpperCase();
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return { ok: false, error: `${fileName}: empieza con BOM` };
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(base)) return { ok: false, error: `${fileName}: el nombre debe ser el código en minúsculas` };
  const md = buf.toString("utf8");
  const meta = parseFrontmatter(md);
  if (!meta) return { ok: false, error: `${fileName}: sin frontmatter (parseBook lo rechaza)` };
  if (!(meta.title ?? "").trim()) return { ok: false, error: `${fileName}: sin title (parseBook lo rechaza)` };
  if (!codes.has(code)) return { ok: false, error: `${fileName}: ${code} no es un código del maestro` };
  if (meta.module_id !== `forge-${base}`) return { ok: false, error: `${fileName}: module_id debe ser forge-${base} (vino: ${meta.module_id ?? "nada"})` };
  const minutes = Number.parseInt(meta.reading_minutes ?? "", 10);
  const s = sha10(buf);
  return { ok: true, code, entry: { file: `${base}.${s}.md`, sha10: s, bytes: buf.length, minutes: Number.isFinite(minutes) ? minutes : null, title: meta.title.trim() } };
}

/** Summary of a verification file for bank-index (pure). */
export function verificationSummary(vbuf, bankSha10) {
  let v;
  try {
    v = JSON.parse(vbuf.toString("utf8"));
  } catch {
    return { sha10: sha10(vbuf), vigente: false, ejecutables: 0, cubiertos: 0, fallidos: 0, invalida: true };
  }
  const items = Array.isArray(v.items) ? v.items : [];
  return {
    sha10: sha10(vbuf),
    vigente: v.sha10 === bankSha10,
    ejecutables: items.length,
    cubiertos: items.filter((i) => i.resultado === "paso").length,
    fallidos: items.filter((i) => i.resultado === "fallo").length,
  };
}

/** Shape of a cell code of the master program (A1-01, D3, X07, SD-01, SW4-02…); same alphabet as ids.ts CODE_RE. */
const CELL_CODE_RE = /^[A-Z0-9]{1,3}(-[0-9]{2})?$/;

/** Valid codes from maestro-urls.json, tolerant of both shapes (D11.1): the design's `{ code: [urls] }` and
 *  c0-nucleo's `{ maestro_sha10, urls: { code: [urls] } }`. Metadata keys (maestro_sha10 or anything that is not a
 *  code) never count as codes. Pure. */
export function codesFromMaestroUrls(data) {
  const src = data && typeof data.urls === "object" && data.urls !== null && !Array.isArray(data.urls) ? data.urls : data ?? {};
  return new Set(Object.keys(src).map((k) => k.toUpperCase()).filter((k) => CELL_CODE_RE.test(k)));
}

function loadCodes(root) {
  const f = path.join(root, "src/forge/data/maestro-urls.json");
  if (!existsSync(f)) return null;
  return codesFromMaestroUrls(JSON.parse(readFileSync(f, "utf8")));
}

export function publish(root = ROOT) {
  const booksDir = path.join(root, "content/forge/books");
  const banksDir = path.join(root, "content/forge/exercises");
  const verDir = path.join(root, "content/forge/verification");
  const outDir = path.join(root, "public/forge/books/v1");
  const dataDir = path.join(root, "src/forge/data");
  const books = listMd(booksDir);
  const banks = listMd(banksDir);
  const codes = loadCodes(root);
  const errors = [];
  if (!codes && (books.length || banks.length)) errors.push("falta src/forge/data/maestro-urls.json: sin lista de códigos válidos");

  const bookIndex = {};
  for (const f of books) {
    const r = checkBook(f, readFileSync(path.join(booksDir, f)), codes ?? new Set());
    if (!r.ok) errors.push(r.error);
    else bookIndex[r.code] = r.entry;
  }
  const bankIndex = {};
  for (const f of banks) {
    const base = f.replace(/\.md$/, "");
    const code = base.toUpperCase();
    const buf = readFileSync(path.join(banksDir, f));
    if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) errors.push(`${f}: el banco empieza con BOM`);
    if (codes && !codes.has(code)) errors.push(`${f}: ${code} no es un código del maestro`);
    const s = sha10(buf);
    const vf = path.join(verDir, `${base}.json`);
    bankIndex[code] = { sha10: s, verificacion: existsSync(vf) ? verificationSummary(readFileSync(vf), s) : null };
  }
  if (errors.length) return { ok: false, errors };

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  for (const f of books) {
    const e = bookIndex[f.replace(/\.md$/, "").toUpperCase()];
    writeFileSync(path.join(outDir, e.file), readFileSync(path.join(booksDir, f)));
  }
  mkdirSync(dataDir, { recursive: true });
  const sorted = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
  writeFileSync(path.join(dataDir, "book-index.json"), JSON.stringify(sorted(bookIndex), null, 1) + "\n");
  writeFileSync(path.join(dataDir, "bank-index.json"), JSON.stringify(sorted(bankIndex), null, 1) + "\n");
  const bytes = Object.values(bookIndex).reduce((a, e) => a + e.bytes, 0);
  return { ok: true, books: books.length, banks: banks.length, bytes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = publish();
  if (!r.ok) {
    for (const e of r.errors) console.error(`[books-publish] ✕ ${e}`);
    process.exit(1);
  }
  console.log(`[books-publish] ${r.books} libros (${r.bytes} B) y ${r.banks} bancos publicados`);
}
