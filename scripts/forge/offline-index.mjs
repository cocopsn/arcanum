#!/usr/bin/env node
// offline-index: índice de descarga por ruta → src/forge/data/offline-index.json (design poblar §6.4). GENERADO (en
// .gitignore). Corre después de books-publish.mjs y library-index.mjs, antes de dev, build, test y typecheck
// (package.json), y solo como `pnpm forge:offline-index`.
//
// Para cada una de las 19 rutas: los libros publicados (book-index.json), los bancos (bank-index.json), si necesita
// Python (alguna cerca python/py/python3, o SQLite) y SQLite (algún ítem sql o forense), las particiones del Atlas de
// las páginas que citan sus celdas (celdas.<sha>.json → alias.<sha>.json → pages[].u de cada partición) y las figuras
// de palantir.com de sus libros. Una cita que ninguna partición tiene no rompe dev ni build: se avisa por consola y
// se anota en `sin_resolver` (offline-index.test.ts falla con los datos reales nombrando la celda).
//
// SIN CACHÉ: cada corrida lee libros, bancos y Atlas actuales y reescribe el archivo entero (leer las 85 particiones
// toma ≈ 0.1 s, H30). Una caché con llave incompleta dejaría una ruta «Descargada» sin Python.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBank } from "./bank-check.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Código de ruta → slug: la tabla FORGE_PATHS de src/forge/ids.ts (offline-index.test.ts las compara). */
export const ROUTE_SLUGS = {
  F0: "f0", A1: "a1", A2: "a2", S1: "s1", S2: "s2", P1: "p1", P2: "p2", P3: "p3", P4: "p4", P5: "p5",
  F1: "f1", F2: "f2", SW1: "sw1", SW2: "sw2", SW3: "sw3", SW4: "sw4", D: "diagnostico", X: "retos", SD: "expedientes",
};
const PY_LANGS = new Set(["python", "py", "python3"]);
const SQLITE_TYPES = new Set(["sql", "forense"]);
const FIGURE_PREFIX = "https://www.palantir.com/docs/resources/";
// el párrafo de figura de un libro: ![alt](src "figura <página>") en su propia línea (BookReader, FigureImage)
const FIGURE_LINE = /^!\[[^\]]*\]\((\S+?)(?:\s+"[^"]*")?\)\s*$/;

/** Código de celda → código de ruta: P2-06 → P2, SD-01 → SD, D3 → D, X07 → X. */
export function routeCodeOf(code) {
  const m = /^([A-Z][A-Z0-9]*?)(?:-\d{2}|\d+)$/.exec(code);
  return m ? m[1] : null;
}

/** URL de página normalizada como `pages[].u`: sin fragmento, sin consulta y sin barra final. */
function pageUrl(u) {
  try {
    const x = new URL(u);
    x.hash = "";
    x.search = "";
    return x.href.replace(/\/+$/, "");
  } catch {
    return String(u);
  }
}

/** Figuras de un libro: las URLs de sus párrafos de figura que son de palantir.com/docs/resources, sin repetir. */
export function bookFigures(md) {
  const out = [];
  for (const line of md.split(/\r?\n/)) {
    const m = FIGURE_LINE.exec(line.trim());
    if (!m) continue;
    const src = m[1];
    if (src.startsWith(FIGURE_PREFIX) && !src.includes("?") && !src.includes("#") && !out.includes(src)) out.push(src);
  }
  return out;
}

/** Lo que pide un banco: Python si alguna cerca es python/py/python3; SQLite si algún ítem es sql o forense. */
export function bankNeeds(md) {
  const items = parseBank(md);
  const sqlite = items.some((it) => SQLITE_TYPES.has(it.tipo));
  const python = sqlite || items.some((it) => it.secciones.some((s) => s.cercas.some((c) => PY_LANGS.has(c.lenguaje))));
  return { python, sqlite };
}

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

/** Construye el índice desde `root` (puro salvo lecturas). Devuelve { index, avisos }. */
export function buildOfflineIndex(root = ROOT) {
  const avisos = [];
  const dataDir = path.join(root, "src/forge/data");
  const books = existsSync(path.join(dataDir, "book-index.json")) ? readJson(path.join(dataDir, "book-index.json")) : {};
  const banks = existsSync(path.join(dataDir, "bank-index.json")) ? readJson(path.join(dataDir, "bank-index.json")) : {};
  const atlasDir = path.join(root, "public/atlas/v1");
  const manifestPath = path.join(atlasDir, "manifest.json");
  const manifest = existsSync(manifestPath) ? readJson(manifestPath) : null;

  // URL de página → archivo de partición (relativo a /atlas/v1/), leyendo cada partición
  const pageFile = new Map();
  const fileBytes = new Map();
  for (const part of manifest?.particiones ?? []) {
    for (const file of part.files ?? []) {
      const abs = path.join(atlasDir, file);
      if (!existsSync(abs)) {
        avisos.push(`falta la partición ${file}`);
        continue;
      }
      fileBytes.set(file, statSync(abs).size);
      for (const pg of readJson(abs).pages ?? []) if (pg?.u) pageFile.set(pageUrl(pg.u), file);
    }
  }
  const alias = new Map();
  if (manifest?.alias && existsSync(path.join(atlasDir, manifest.alias))) {
    for (const [from, to] of readJson(path.join(atlasDir, manifest.alias)).alias ?? []) alias.set(pageUrl(from), pageUrl(to));
  }
  const celdasFile = manifest?.capas?.celdas?.archivo;
  const celdas = celdasFile && existsSync(path.join(atlasDir, celdasFile)) ? (readJson(path.join(atlasDir, celdasFile)).celdas ?? []) : [];
  const citas = new Map(); // código → [url]
  const rutaDe = new Map();
  for (const c of celdas) {
    citas.set(c.codigo, c.directas ?? []);
    rutaDe.set(c.codigo, c.ruta);
  }

  /** @type {Record<string, { libros: { code: string; file: string; bytes: number }[]; bancos: string[]; python: boolean; sqlite: boolean; atlas: { file: string; bytes: number }[]; figuras: string[]; sin_resolver: string[] }>} */
  const rutas = {};
  for (const slug of Object.values(ROUTE_SLUGS)) rutas[slug] = { libros: [], bancos: [], python: false, sqlite: false, atlas: [], figuras: [], sin_resolver: [] };
  const slugOf = (code) => ROUTE_SLUGS[rutaDe.get(code) ?? routeCodeOf(code)] ?? null;
  const codes = [...new Set([...Object.keys(books), ...Object.keys(banks), ...citas.keys()])].sort();
  for (const code of codes) {
    const slug = slugOf(code);
    if (!slug) {
      avisos.push(`${code}: sin ruta conocida`);
      continue;
    }
    const r = rutas[slug];
    const book = books[code];
    if (book?.file) {
      r.libros.push({ code, file: book.file, bytes: book.bytes });
      const published = path.join(root, "public/forge/books/v1", book.file);
      if (existsSync(published)) for (const f of bookFigures(readFileSync(published, "utf8"))) if (!r.figuras.includes(f)) r.figuras.push(f);
    }
    if (banks[code]) {
      r.bancos.push(code);
      const bankPath = path.join(root, "content/forge/exercises", `${code.toLowerCase()}.md`);
      if (existsSync(bankPath)) {
        try {
          const need = bankNeeds(readFileSync(bankPath, "utf8"));
          if (need.sqlite) r.sqlite = true;
          if (need.python) r.python = true;
        } catch (e) {
          avisos.push(`${code}: banco ilegible (${e.message})`);
        }
      }
    }
    for (const cited of citas.get(code) ?? []) {
      const u = pageUrl(cited);
      const file = pageFile.get(u) ?? pageFile.get(alias.get(u) ?? "");
      if (!file) {
        r.sin_resolver.push(`${code} ${cited}`);
        continue;
      }
      if (!r.atlas.some((a) => a.file === file)) r.atlas.push({ file, bytes: fileBytes.get(file) ?? 0 });
    }
  }
  for (const r of Object.values(rutas)) {
    if (r.sqlite) r.python = true;
    r.atlas.sort((a, b) => a.file.localeCompare(b.file));
    for (const s of r.sin_resolver) avisos.push(`sin resolver: ${s}`);
  }
  return { index: { v: 1, atlas_fuente: manifest?.fuente_sha10 ?? "", rutas }, avisos };
}

/** Escribe src/forge/data/offline-index.json bajo `root`, entero, en cada corrida. */
export function writeOfflineIndex(root = ROOT) {
  const { index, avisos } = buildOfflineIndex(root);
  const dataDir = path.join(root, "src/forge/data");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(path.join(dataDir, "offline-index.json"), JSON.stringify(index, null, 1) + "\n");
  return { ok: true, rutas: Object.keys(index.rutas).length, avisos, index };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = writeOfflineIndex();
  for (const a of r.avisos) console.warn(`[offline-index] ${a}`);
  const t = Object.values(r.index.rutas).reduce(
    (n, x) => ({ libros: n.libros + x.libros.length, atlas: n.atlas + x.atlas.length, figuras: n.figuras + x.figuras.length }),
    { libros: 0, atlas: 0, figuras: 0 },
  );
  console.log(`[offline-index] ${r.rutas} rutas · ${t.libros} libros · ${t.atlas} particiones por ruta · ${t.figuras} figuras por ruta`);
}
