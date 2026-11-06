#!/usr/bin/env node
// budget-report — Forge bundle and precache budgets over a production build (design §6.7). Runs AFTER `pnpm build`.
// Attributes by the MODULE GRAPH (.next/forge-chunks.json from ForgeChunkMapPlugin), never by text. Fails closed
// (exit 1) with the list of problems; writes the report JSON either way.
//
// Usage: node scripts/forge/budget-report.mjs [--project] [--root <repo>] [--next <dir>] [--out <file.json>]
//   --project   adds the projection «measured mean × 124 banks / × 136 books» (after the pilots, §6.7).
//   --out       default: $ARCANUM_FORGE_TASKS/budget-report.json, else D:\projects\auctorum-systems\.agents\tasks\
//               arcanum-forge\budget-report.json when that folder exists, else <next>/budget-report.json.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KiB = 1024;
const MiB = 1024 * 1024;
export const LIMITS = {
  archivo: 5_242_880, // any emitted or precached file (RD-6)
  pagina: 2706.5 * KiB, // app/page-*.js
  paginaBase: 2406.5 * KiB,
  forgeTotal: 7 * MiB,
  bancos: 4.0 * MiB,
  banco: 48 * KiB,
  datos: 1.0 * MiB,
  datosArchivo: 256 * KiB,
  ui: 1.25 * MiB,
  fuentes: 0.25 * MiB,
  libro: 64 * KiB,
  atlasArchivo: 2 * MiB,
  bancosProyectados: 124,
  librosProyectados: 136,
};

const toPosix = (p) => p.split(path.sep).join("/");

function walk(dir, base = dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, base, out);
    else out.push({ rel: toPosix(path.relative(base, full)), full, bytes: st.size });
  }
  return out;
}

/** What may never sit in the page chunk (§6.7). Returns true when `p` is forbidden there. Pure. */
export function forbiddenInPage(p) {
  if (p === "src/forge/ai.ts" || p === "src/forge/ai-drain.ts") return true;
  if (p.startsWith("src/forge/ui/")) return p !== "src/forge/ui/exercises/registry.ts";
  if (p.startsWith("src/forge/bank/check/")) return p !== "src/forge/bank/check/registry.ts";
  if (p.startsWith("src/forge/data/")) return p !== "src/forge/data/videos.json";
  if (p.startsWith("src/forge/atlas/")) return p !== "src/forge/atlas/types.ts";
  return p.startsWith("src/forge/eval/") || p.startsWith("src/forge/model/") || p.startsWith("content/forge/");
}

/** Category of a non-page Forge file from its module paths. Pure. */
export function categoryOf(paths) {
  if (paths.every((p) => p.startsWith("content/forge/exercises/"))) return "bancos";
  if (paths.every((p) => p.startsWith("src/forge/data/"))) return "datos";
  return "ui";
}

/** Precache URLs from a built Serwist sw.js (entries `url:"…"` / `"url":"…"`). Pure. */
export function precacheUrls(swText) {
  const out = [];
  const re = /["']?url["']?\s*:\s*["']([^"']+)["']/g;
  let m;
  // a Windows build writes public/ entries with escaped backslashes ('/atlas\\v1\\…'): normalize to '/'
  while ((m = re.exec(swText))) out.push(m[1].replace(/\\+/g, "/"));
  return out;
}

/** Marker sentences of a book: up to 3 prose lines (outside fences, not headings/links) of ≥ 60 chars. Pure. */
export function bookMarkers(md) {
  const body = md.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  const out = [];
  let fence = false;
  for (const raw of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(raw)) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    const line = raw.trim();
    if (!line || /^[#>|\-*+!\[]/.test(line) || /^\d+\./.test(line) || /[`\[\]()*_]/.test(line)) continue;
    const s = line.slice(0, 80);
    if (s.length >= 60 && !out.includes(s)) out.push(s);
    if (out.length === 3) break;
  }
  return out;
}

function urlsInOrder(v, out = []) {
  if (typeof v === "string") {
    if (/^https:\/\//.test(v)) out.push(v);
  } else if (Array.isArray(v)) v.forEach((x) => urlsInOrder(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) (urlsInOrder(k, out), urlsInOrder(x, out));
  return out;
}

const TEXT = /\.(js|mjs|cjs|css|json|html|txt|map|md)$/;

/** Run every check. Returns the report object (with `ok` and `fallas`). */
export function evaluate({ root, nextDir, project = false }) {
  const fallas = [];
  const avisos = [];
  const report = { v: 1, fallas, avisos };
  const mapFile = path.join(nextDir, "forge-chunks.json");
  if (!existsSync(mapFile)) {
    fallas.push("sin mapa de chunks de Forge");
    report.ok = false;
    return report;
  }
  const map = JSON.parse(readFileSync(mapFile, "utf8"));
  const chunks = map.chunks ?? {};
  const medios = map.medios ?? {};
  const sizeOf = (rel) => {
    const f = path.join(nextDir, rel);
    return existsSync(f) ? statSync(f).size : null;
  };
  for (const rel of [...Object.keys(chunks), ...Object.keys(medios)]) {
    if (sizeOf(rel) === null) fallas.push(`el mapa de chunks lista ${rel}, que no existe en .next`);
  }

  // page chunk
  const pageFiles = Object.keys(chunks).filter((k) => chunks[k].pagina);
  const pageJs = pageFiles.filter((k) => /(^|\/)app\/page-[^/]*\.js$/.test(k));
  let paginaBytes = 0;
  for (const k of pageJs) paginaBytes += sizeOf(k) ?? 0;
  if (pageJs.length === 0) fallas.push("el mapa no tiene el chunk de página app/page-*.js");
  if (paginaBytes > LIMITS.pagina) fallas.push(`chunk de página ${paginaBytes} B > ${LIMITS.pagina} B`);
  for (const k of pageFiles) for (const p of chunks[k].forge) if (forbiddenInPage(p)) fallas.push(`un evaluador de Forge entró al chunk de página: ${p}`);
  const paginaCrecimiento = Math.max(0, paginaBytes - LIMITS.paginaBase);

  // categories
  const cat = { bancos: 0, datos: 0, ui: 0, fuentes: 0 };
  const porArchivo = [];
  const forgeFiles = new Set();
  for (const [k, e] of Object.entries(chunks)) {
    if (e.pagina || !e.forge.length) continue;
    const bytes = sizeOf(k) ?? 0;
    const c = categoryOf(e.forge);
    cat[c] += bytes;
    forgeFiles.add(k);
    porArchivo.push({ archivo: k, categoria: c, bytes });
    if (c === "bancos" && bytes > LIMITS.banco) fallas.push(`banco ${k} ${bytes} B > ${LIMITS.banco} B`);
    if (c === "datos" && bytes > LIMITS.datosArchivo) fallas.push(`datos ${k} ${bytes} B > ${LIMITS.datosArchivo} B`);
  }
  const fontsDir = path.join(root, "src/forge/fonts");
  const fuentesN = existsSync(fontsDir) ? readdirSync(fontsDir).filter((f) => f.endsWith(".woff2")).length : 0;
  let fuentesAtribuidas = 0;
  for (const [k, owner] of Object.entries(medios)) {
    const bytes = sizeOf(k) ?? 0;
    forgeFiles.add(k);
    if (k.endsWith(".woff2")) {
      fuentesAtribuidas++;
      cat.fuentes += bytes;
      porArchivo.push({ archivo: k, categoria: "fuentes", bytes, modulo: owner });
    } else {
      cat.ui += bytes;
      porArchivo.push({ archivo: k, categoria: "ui", bytes, modulo: owner });
    }
  }
  if (fuentesAtribuidas !== fuentesN) fallas.push(`las fuentes de Forge no se atribuyeron: ${fuentesAtribuidas} de ${fuentesN}`);

  // baseline 0098936 (static/media and static/css)
  const baseFile = path.join(root, "src/forge/__tests__/fixtures/static-media-0098936.json");
  let base = null;
  if (existsSync(baseFile)) base = JSON.parse(readFileSync(baseFile, "utf8"));
  else avisos.push("sin base static-media-0098936.json (c0-nucleo): no se mide el crecimiento del CSS global y todo medio fuera del mapa se reporta como nuevo");
  const baseNames = (list) => new Set((Array.isArray(list) ? list : []).map((x) => (typeof x === "string" ? x : x.name ?? x.nombre)).filter(Boolean).map((n) => path.posix.basename(n)));
  const baseMedia = baseNames(base?.media ?? base?.static_media);
  const baseCss = Array.isArray(base?.css) ? base.css : [];
  const statics = walk(path.join(nextDir, "static")).map((f) => ({ ...f, rel: `static/${f.rel}` }));
  const mediosNuevos = [];
  for (const f of statics) {
    if (!f.rel.startsWith("static/media/") || medios[f.rel]) continue;
    if (!baseMedia.has(path.posix.basename(f.rel))) mediosNuevos.push({ archivo: f.rel, bytes: f.bytes });
  }
  if (mediosNuevos.length) avisos.push(`${mediosNuevos.length} medio(s) nuevo(s) no atribuido(s) (no cuentan contra Forge)`);
  let cssCrecimiento = 0;
  const cssNow = statics.filter((f) => f.rel.startsWith("static/css/") && f.rel.endsWith(".css") && !forgeFiles.has(f.rel)).reduce((a, f) => a + f.bytes, 0);
  if (base) {
    const cssBase = baseCss.reduce((a, x) => a + (x.bytes ?? 0), 0);
    cssCrecimiento = Math.max(0, cssNow - cssBase);
  }

  // per-file limit over everything emitted
  for (const f of statics) if (f.bytes > LIMITS.archivo) fallas.push(`archivo ${f.rel} ${f.bytes} B > ${LIMITS.archivo} B`);
  if (cat.bancos > LIMITS.bancos) fallas.push(`bancos ${cat.bancos} B > ${LIMITS.bancos} B`);
  if (cat.datos > LIMITS.datos) fallas.push(`datos ${cat.datos} B > ${LIMITS.datos} B`);
  if (cat.ui > LIMITS.ui) fallas.push(`UI y evaluadores ${cat.ui} B > ${LIMITS.ui} B`);
  if (cat.fuentes > LIMITS.fuentes) fallas.push(`fuentes ${cat.fuentes} B > ${LIMITS.fuentes} B`);
  const forgeTotal = cat.bancos + cat.datos + cat.ui + cat.fuentes + paginaCrecimiento + cssCrecimiento;
  if (forgeTotal > LIMITS.forgeTotal) fallas.push(`lo que Forge agrega al precache ${forgeTotal} B > ${LIMITS.forgeTotal} B`);

  // bank sources (≤ 48 KiB per bank)
  const banksDir = path.join(root, "content/forge/exercises");
  const bancosMd = walk(banksDir).filter((f) => f.rel.endsWith(".md"));
  for (const b of bancosMd) if (b.bytes > LIMITS.banco) fallas.push(`banco content/forge/exercises/${b.rel} ${b.bytes} B > ${LIMITS.banco} B`);

  // books (outside the precache)
  const libros = walk(path.join(root, "public/forge/books/v1"));
  for (const b of libros) if (b.bytes > LIMITS.libro) fallas.push(`libro ${b.rel} ${b.bytes} B > ${LIMITS.libro} B`);
  const librosTotal = libros.reduce((a, b) => a + b.bytes, 0);

  // Atlas files
  const atlas = walk(path.join(root, "public/atlas/v1"));
  for (const a of atlas) if (a.bytes > LIMITS.atlasArchivo) fallas.push(`archivo del Atlas ${a.rel} ${a.bytes} B > ${LIMITS.atlasArchivo} B`);

  // precache manifest (CA-57)
  const swFile = path.join(root, "public/sw.js");
  let precache = null;
  if (!existsSync(swFile)) fallas.push("sin public/sw.js: no se puede comprobar el precache");
  else {
    const urls = precacheUrls(readFileSync(swFile, "utf8"));
    if (urls.length === 0) fallas.push("el manifiesto de public/sw.js no tiene entradas legibles");
    const bad = urls.filter((u) => u.includes("/atlas/") || u.includes("/forge/books/"));
    for (const u of bad) fallas.push(`el precache tiene una entrada de datos del Atlas o de libros: ${u}`);
    precache = { entradas: urls.length, atlas_o_libros: bad.length };
  }

  // text scans of .next/static: a Forge book (CA-28) and the viewer's Atlas list
  const texts = statics.filter((f) => TEXT.test(f.rel));
  const scan = (needles) => {
    const hits = new Set();
    for (const f of texts) {
      const t = readFileSync(f.full, "utf8");
      for (const n of needles) if (!hits.has(n) && t.includes(n)) hits.add(n);
      if (hits.size === needles.length) break;
    }
    return hits;
  };
  const booksDir = path.join(root, "content/forge/books");
  const bookFiles = existsSync(booksDir) ? readdirSync(booksDir).filter((f) => f.endsWith(".md")).sort() : [];
  const markerBook = bookFiles.includes("p2-06.md") ? "p2-06.md" : bookFiles[0];
  let ca28 = "sin comprobar: no hay libros de Forge";
  if (markerBook) {
    const markers = bookMarkers(readFileSync(path.join(booksDir, markerBook), "utf8"));
    if (markers.length === 0) ca28 = `sin comprobar: ${markerBook} no tiene líneas marcadoras`;
    else {
      const hits = scan(markers);
      ca28 = `${markerBook}: ${markers.length} marcadores, ${hits.size} en .next/static`;
      if (hits.size) fallas.push(`un libro de Forge está en .next/static (${markerBook})`);
    }
  }
  if (markerBook !== "p2-06.md") avisos.push(`CA-28: sin libro P2-06; ${markerBook ? `se usó ${markerBook}` : "no se comprobó"}`);
  const atlasUrlsFile = path.join(root, "src/forge/data/atlas-docs-urls.json");
  let marcadorasAtlas = [];
  if (!existsSync(atlasUrlsFile)) avisos.push("sin src/forge/data/atlas-docs-urls.json (c0-atlas): no se comprobó que la lista del visor quede en el servidor");
  else {
    const all = urlsInOrder(JSON.parse(readFileSync(atlasUrlsFile, "utf8")));
    const corpus = [...walk(path.join(root, "src/forge/data")).filter((f) => f.rel !== "atlas-docs-urls.json"), ...walk(path.join(root, "content"))]
      .filter((f) => TEXT.test(f.rel))
      .map((f) => readFileSync(f.full, "utf8"))
      .join("\n");
    for (const u of all) {
      if (marcadorasAtlas.length === 3) break;
      if (!marcadorasAtlas.includes(u) && !corpus.includes(u)) marcadorasAtlas.push(u);
    }
    if (marcadorasAtlas.length < 3) avisos.push(`sólo ${marcadorasAtlas.length} URLs marcadoras del Atlas disponibles`);
    const hits = scan(marcadorasAtlas);
    if (hits.size) fallas.push(`la lista del visor llegó al cliente (${hits.size} de ${marcadorasAtlas.length} URLs marcadoras en .next/static)`);
  }

  Object.assign(report, {
    limites: LIMITS,
    pagina: { archivos: pageJs, bytes: paginaBytes, crecimiento: paginaCrecimiento },
    categorias: cat,
    css_global_crecimiento: base ? cssCrecimiento : null,
    forge_total: forgeTotal,
    fuentes: { atribuidas: fuentesAtribuidas, en_repo: fuentesN },
    medios_nuevos: mediosNuevos,
    bancos_md: { n: bancosMd.length, bytes: bancosMd.reduce((a, b) => a + b.bytes, 0) },
    libros: { n: libros.length, bytes: librosTotal },
    atlas: { n: atlas.length, bytes: atlas.reduce((a, b) => a + b.bytes, 0) },
    precache,
    ca28,
    marcadoras_atlas: marcadorasAtlas.map((u) => createHash("sha256").update(u).digest("hex").slice(0, 10)),
    marcadoras_atlas_urls: marcadorasAtlas,
    mapa: { chunks: Object.keys(chunks).length, medios: Object.keys(medios).length, archivos_forge: porArchivo.sort((a, b) => a.archivo.localeCompare(b.archivo)) },
  });

  if (project) {
    const bookSrc = bookFiles.map((f) => statSync(path.join(booksDir, f)).size);
    const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    const mb = mean(bancosMd.map((b) => b.bytes));
    const ml = mean(bookSrc);
    report.proyeccion = {
      bancos: { medidos: bancosMd.length, media: mb, proyectado: mb === null ? null : Math.round(mb * LIMITS.bancosProyectados), limite: LIMITS.bancos },
      libros: { medidos: bookSrc.length, media: ml, proyectado: ml === null ? null : Math.round(ml * LIMITS.librosProyectados) },
    };
    if (mb === null) avisos.push("proyección sin bancos medidos (faltan los pilotos)");
    else if (mb * LIMITS.bancosProyectados > LIMITS.bancos) fallas.push(`proyección de bancos ${Math.round(mb * LIMITS.bancosProyectados)} B > ${LIMITS.bancos} B: recortar bancos antes de escribir más`);
  }
  report.ok = fallas.length === 0;
  return report;
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(arg("--root") ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."));
  const nextDir = path.resolve(arg("--next") ?? path.join(root, ".next"));
  const tasks = process.env.ARCANUM_FORGE_TASKS ?? "D:\\projects\\auctorum-systems\\.agents\\tasks\\arcanum-forge";
  const out = arg("--out") ?? (existsSync(tasks) ? path.join(tasks, "budget-report.json") : path.join(nextDir, "budget-report.json"));
  const report = evaluate({ root, nextDir, project: process.argv.includes("--project") });
  writeFileSync(out, JSON.stringify(report, null, 1) + "\n");
  for (const a of report.avisos) console.log(`[budget-report] aviso: ${a}`);
  if (!report.ok) {
    for (const f of report.fallas) console.error(`[budget-report] ✕ ${f}`);
    console.error(`[budget-report] FALLA (${report.fallas.length}) · reporte en ${out}`);
    process.exit(1);
  }
  console.log(`[budget-report] OK · página ${report.pagina.bytes} B · Forge ${report.forge_total} B · reporte en ${out}`);
}
