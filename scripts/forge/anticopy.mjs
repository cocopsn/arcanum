#!/usr/bin/env node
// anticopy — CA-29. Zero runs of ≥ 12 consecutive identical words between:
//   (1) each Forge book (content/forge/books/*.md) and the body of every palantir.com/docs page it cites, read from
//       the local crawl cache (never from the network), and
//   (2) the A1/A2 books and the existing ITC, Competitiva and OA books (content/books/*.md by `spine:`).
// Excluded from both sides: frontmatter, code fences, inline code, link texts (and images), bare URLs and headings.
// Prints and stores COUNTS ONLY (never a copied run). Exit 1 when any run is found («N tramo(s) copiado(s)»).
//
// Usage: node scripts/forge/anticopy.mjs [--books <dir>] [--cache <dir>] [--out <file.json>]
//   cache: --cache, else $ARCANUM_FORGE_CACHE, else D:\projects\arcanum-forge-cache (pages/<2>/<sha1(url)>.json.gz)
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const N = 12;
const OWN_SPINES = new Set(["itc", "competitiva", "oa amazon", "oa"]);

/** Prose of a markdown text with the excluded parts removed (pure). */
export function prose(md) {
  let t = md.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  t = t.replace(/^\s*(```|~~~)[^\n]*\n[\s\S]*?^\s*\1[^\n]*$/gm, " ");
  t = t.replace(/`[^`\n]*`/g, " ");
  t = t.replace(/!?\[[^\]]*\]\([^)]*\)/g, " ");
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/https?:\/\/\S+/g, " ");
  t = t.split(/\r?\n/).filter((l) => !/^\s*#{1,6}\s/.test(l)).join("\n");
  return t;
}

export const words = (text) => text.toLowerCase().normalize("NFC").match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? [];

/** Set of N-word shingles (joined by a space). Pure. */
export function shingles(ws, n = N) {
  const s = new Set();
  for (let i = 0; i + n <= ws.length; i++) s.add(ws.slice(i, i + n).join(" "));
  return s;
}

/** Number of maximal copied runs (≥ n words) of `ws` found in `set`. Pure. */
export function countRuns(ws, set, n = N) {
  let runs = 0;
  let inRun = false;
  for (let i = 0; i + n <= ws.length; i++) {
    const hit = set.has(ws.slice(i, i + n).join(" "));
    if (hit && !inRun) runs++;
    inRun = hit;
  }
  return runs;
}

export function citedDocs(md) {
  const out = new Set();
  for (const m of md.matchAll(/https:\/\/(?:www\.)?palantir\.com\/docs\/[^\s)>\]"'<]*/g)) {
    out.add(m[0].replace(/[#?].*$/, "").replace(/[.,;:]+$/, ""));
  }
  return [...out].sort();
}

function cacheBody(cache, url) {
  const p = url.replace(/^https:\/\/(?:www\.)?palantir\.com/, "");
  const variants = new Set();
  for (const host of ["https://palantir.com", "https://www.palantir.com"]) {
    variants.add(host + p);
    variants.add(host + (p.endsWith("/") ? p.slice(0, -1) : p + "/"));
  }
  for (const v of variants) {
    const h = createHash("sha1").update(v).digest("hex");
    const f = path.join(cache, "docs", "pages", h.slice(0, 2), `${h}.json.gz`);
    if (!existsSync(f)) continue;
    try {
      const o = JSON.parse(gunzipSync(readFileSync(f)).toString("utf8"));
      const pp = o.pageProps ?? o.props?.pageProps ?? {};
      const md = typeof pp.markdown === "string" ? pp.markdown : pp.page?.content?.markdown;
      if (typeof md === "string") return md;
    } catch {
      /* unreadable entry: treated as no body */
    }
  }
  return null;
}

const spineOf = (md) => ((md.match(/^spine:\s*(.*)$/m) || [])[1] ?? "").trim().replace(/^["']|["']$/g, "").toLowerCase();
const listMd = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md")).sort() : []);

export function run({ booksDir, ownBooksDir, cache }) {
  const libros = [];
  let ownSet = null;
  const docsCache = new Map();
  for (const f of listMd(booksDir)) {
    const md = readFileSync(path.join(booksDir, f), "utf8");
    const ws = words(prose(md));
    const urls = citedDocs(md);
    let conCuerpo = 0;
    let tramosDocs = 0;
    for (const u of urls) {
      if (!docsCache.has(u)) {
        const body = cacheBody(cache, u);
        docsCache.set(u, body === null ? null : shingles(words(prose(body))));
      }
      const set = docsCache.get(u);
      if (!set) continue;
      conCuerpo++;
      tramosDocs += countRuns(ws, set);
    }
    let tramosPropios = 0;
    if (/^a[12]-/.test(f)) {
      if (!ownSet) {
        ownSet = new Set();
        for (const g of listMd(ownBooksDir)) {
          const omd = readFileSync(path.join(ownBooksDir, g), "utf8");
          if (OWN_SPINES.has(spineOf(omd))) for (const s of shingles(words(prose(omd)))) ownSet.add(s);
        }
      }
      tramosPropios = countRuns(ws, ownSet);
    }
    libros.push({ libro: f.replace(/\.md$/, "").toUpperCase(), palabras: ws.length, citadas: urls.length, con_cuerpo: conCuerpo, tramos_docs: tramosDocs, tramos_libros_propios: tramosPropios });
  }
  const tramos = libros.reduce((a, l) => a + l.tramos_docs + l.tramos_libros_propios, 0);
  return { v: 1, n: N, libros, totales: { libros: libros.length, citadas: libros.reduce((a, l) => a + l.citadas, 0), con_cuerpo: libros.reduce((a, l) => a + l.con_cuerpo, 0), tramos } };
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cache = path.resolve(arg("--cache") ?? process.env.ARCANUM_FORGE_CACHE ?? "D:\\projects\\arcanum-forge-cache");
  if (!existsSync(path.join(cache, "docs", "pages"))) {
    console.error(`[anticopy] ✕ sin caché de docs en ${cache}: no se puede comprobar CA-29`);
    process.exit(1);
  }
  const r = run({ booksDir: path.resolve(arg("--books") ?? path.join(ROOT, "content/forge/books")), ownBooksDir: path.join(ROOT, "content/books"), cache });
  const out = arg("--out");
  if (out) writeFileSync(out, JSON.stringify(r, null, 1) + "\n");
  for (const l of r.libros) console.log(`[anticopy] ${l.libro}: ${l.palabras} palabras · ${l.citadas} páginas citadas (${l.con_cuerpo} con cuerpo en caché) · ${l.tramos_docs + l.tramos_libros_propios} tramos`);
  const t = r.totales.tramos;
  if (t > 0) {
    console.error(`[anticopy] ✕ ${t} ${t === 1 ? "tramo copiado" : "tramos copiados"} (≥ ${N} palabras)`);
    process.exit(1);
  }
  console.log(`[anticopy] OK · ${r.totales.libros} libros · 0 tramos copiados`);
}
