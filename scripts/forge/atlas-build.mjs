#!/usr/bin/env node
// Datos del Atlas (RF-A1, RF-A9, CA-46, CA-47, CA-55; design §11.1-§11.2, §6.5).
//
//   node scripts/forge/derived-manifest.mjs --cache <caché>      (Paso 0, primero)
//   node scripts/forge/atlas-build.mjs --cache <caché> --maestro <programa.md>
//        [--out public/atlas/v1] [--data-out src/forge/data] [--max-bytes 2097152]
//
// La caché llega por --cache o ARCANUM_FORGE_CACHE y el maestro por --maestro o ARCANUM_FORGE_MAESTRO;
// ninguno de los dos entra al repo. Lee sólo lo que lista derived/manifest.json (particiones de docs,
// build-catalog.json, cells-index.json, docs-aliases.json) y del maestro sólo §20, §21 y las URLs de
// video y de learn que cita. Escribe public/atlas/v1/** (salvo videos/oembed.json y videos/canales.json,
// que se generan en el build), src/forge/data/atlas-docs-urls.json y src/forge/data/videos.json.
//
// Sólo metadatos (S3): cada salida se arma campo por campo, así que meta_description, subtítulos,
// descripciones, cuerpos, chain, source, status, sitemap_url, template e internal_links_out nunca
// salen. Rechaza con código 1 las entradas de learn, certification o listados de YouTube y un
// manifiesto que lista un archivo ausente o que ya no coincide. Dos corridas sobre la misma entrada
// dan bytes idénticos (nada de fechas de corrida ni rutas absolutas en la salida).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(SCRIPT), "..", "..");

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const IMAGE_PREFIXES = ["https://www.palantir.com/", "https://build.palantir.com/"];
const LANGS = ["en", "jp", "zh", "kr"];
const CJK = new Set(["jp", "zh", "kr"]);
const FORBIDDEN_FILE = /(^|[\\/._-])(learn|certification|certifications|youtube)([\\/._-]|$)/i;
const FORBIDDEN_HOST = /^(learn|certification)\.palantir\.com$/i;
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_SINGLE = /^https:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtube-nocookie\.com\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#][^\s]*)?$/;
const YT_LISTING = /^https?:\/\/(?:www\.|m\.)?youtube\.com\/(?:playlist|channel\/|c\/|user\/|@|feeds\/|youtubei\/)/i;
const VIMEO = /^https:\/\/player\.vimeo\.com\/video\/(\d{6,12})$/;
const GUIDED = [
  "getting-started",
  "use-case-examples",
  "code-examples",
  "architecture-center",
  "recipes",
  "walkthroughs",
  "use-case-life-cycle",
  "use-case-patterns",
  "guides-and-workflows",
];
export const CHANNELS = [
  { id: "UCQRc3PMlCsoodxbR4IsglKQ", url: "https://www.youtube.com/@palantirdevelopers", etiqueta: "Palantir Developers" },
  { id: "UCwed6_f0WcDIioXvMQfcP2Q", url: "https://www.youtube.com/@palantirtech", etiqueta: "Palantir" },
];

export class AtlasBuildError extends Error {}
const fail = (msg) => {
  throw new AtlasBuildError(msg);
};

// --- funciones puras compartidas con src/forge/atlas/types.ts (atlas-types-sync.test.ts las compara) ---

export function normalizeAtlasText(text, lang) {
  const base = text.normalize("NFKC").toLowerCase();
  return CJK.has(lang) ? base : base.normalize("NFD").replace(/\p{M}/gu, "");
}

export function atlasTokens(page) {
  const raw = [page.t, ...page.b, ...page.h.map((x) => x[1]), page.p, page.c, page.s].join(" ");
  const parts = normalizeAtlasText(raw, page.l).split(/\s+/).filter(Boolean);
  return " " + parts.join(" ") + " ";
}

export function canonicalDocsUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.hostname !== "www.palantir.com" && url.hostname !== "palantir.com") return null;
  const p = url.pathname.replace(/\/index\.html$/, "").replace(/\/+$/, "");
  if (p !== "/docs" && !p.startsWith("/docs/")) return null;
  return "https://www.palantir.com" + p;
}

// --- utilidades ---

const sha10 = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 10);
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const bytes = (s) => Buffer.byteLength(s, "utf8");
const str = (x) => (typeof x === "string" ? x : "");
const hostOf = (u) => {
  try {
    return new URL(u).hostname;
  } catch {
    return "";
  }
};
function argValue(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}
function inc(obj, key, by = 1) {
  obj[key] = (obj[key] ?? 0) + by;
}
function isoOrNull(httpDate) {
  if (typeof httpDate !== "string" || !httpDate) return null;
  const d = new Date(httpDate);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function rejectLearnUrl(u, where) {
  if (FORBIDDEN_HOST.test(hostOf(u))) fail(`atlas-build rechaza una entrada de learn o certification (${where}): ${u}`);
}

function videoRef(v, where) {
  const u = str(v?.url);
  if (YT_LISTING.test(u)) fail(`atlas-build rechaza un listado de YouTube (${where}): ${u}`);
  const m = u.match(YT_SINGLE);
  const id = m ? m[1] : str(v?.id);
  if (v?.kind !== "youtube" || !YT_ID.test(id) || (u && !m)) fail(`atlas-build: video no reconocido (${where}): ${u || id}`);
  return ["youtube", id];
}

// --- entrada ---

function readDerived(cache) {
  const derived = path.join(cache, "derived");
  const mPath = path.join(derived, "manifest.json");
  if (!fs.existsSync(mPath)) fail(`atlas-build: falta ${mPath}; corre derived-manifest primero`);
  const mText = fs.readFileSync(mPath);
  const manifest = JSON.parse(mText.toString("utf8"));
  if (!Array.isArray(manifest.files)) fail("atlas-build: derived/manifest.json no trae files[]");
  // Archivos prohibidos, listados o no (D1): learn, certification y listados de YouTube.
  const present = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else present.push(path.relative(derived, full).split(path.sep).join("/"));
    }
  })(derived);
  for (const f of [...manifest.files.map((x) => String(x.file)), ...present]) {
    if (FORBIDDEN_FILE.test(f)) fail(`atlas-build rechaza una entrada de learn, certification o listados de YouTube: ${f}`);
  }
  const listed = new Map();
  for (const e of manifest.files) {
    const f = String(e.file);
    const full = path.join(derived, f);
    if (!fs.existsSync(full)) fail(`atlas-build: el manifiesto lista un archivo ausente: ${f}`);
    const buf = fs.readFileSync(full);
    if (buf.length !== e.bytes || sha10(buf) !== e.sha256_10) {
      fail(`atlas-build: el manifiesto no coincide con ${f}; corre derived-manifest otra vez`);
    }
    listed.set(f, buf);
  }
  const need = (f) => listed.get(f) ?? fail(`atlas-build: el manifiesto no lista ${f}`);
  const docs = [...listed.keys()].filter((f) => f.startsWith("docs/") && f.endsWith(".json")).sort(cmp);
  if (!docs.length) fail("atlas-build: el manifiesto no lista particiones de docs");
  return {
    fuente: sha10(mText),
    docs: docs.map((f) => ({ id: f.slice("docs/".length, -".json".length), json: JSON.parse(listed.get(f).toString("utf8")) })),
    build: JSON.parse(need("build-catalog.json").toString("utf8")),
    cells: JSON.parse(need("cells-index.json").toString("utf8")),
    aliases: JSON.parse(need("docs-aliases.json").toString("utf8")),
  };
}

function sectionOf(lines, i) {
  for (let j = i; j >= 0; j--) {
    const m = lines[j].match(/^## (\d{2})\./);
    if (m) return "§" + m[1];
  }
  return "§00";
}

function readMaestro(file) {
  if (!file) fail("atlas-build: falta --maestro <programa.md> o ARCANUM_FORGE_MAESTRO");
  if (!fs.existsSync(file)) fail(`atlas-build: no existe el maestro ${file}`);
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const at = (prefix) => lines.findIndex((l) => l.startsWith(prefix));
  const s20 = at("## 20.");
  const s21 = at("## 21.");
  if (s20 < 0 || s21 < 0) fail("atlas-build: el maestro no tiene §20 y §21");
  let s21end = lines.findIndex((l, i) => i > s21 && /^#{1,2} /.test(l));
  if (s21end < 0) s21end = lines.length;

  // §20: claves [KEY] y cursos C-NN con sus URLs.
  const claves = new Map();
  const cursos = new Map();
  for (const l of lines.slice(s20 + 1, s21)) {
    const k = l.match(/^- \*\*(\[[A-Z0-9-]+\])\*\*/);
    const c = l.match(/^- \*\*(C-\d{2}):?\*\*/);
    const urls = [...l.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)].map((m) => m[1]);
    if (k) claves.set(k[1], [...(claves.get(k[1]) ?? []), ...urls]);
    else if (c) cursos.set(c[1], [...(cursos.get(c[1]) ?? []), ...urls]);
  }

  // §21: «N. [título](url) — Estado. Lote.»
  const inventario = [];
  const reInv = /^(\d+)\. \[(.*)\]\((\S+?)\)\s+—\s+(.*)$/;
  for (const l of lines.slice(s21 + 1, s21end)) {
    if (!/^\d+\. /.test(l)) continue;
    const m = l.match(reInv);
    if (!m) fail(`atlas-build: entrada del inventario sin formato: ${l.slice(0, 80)}`);
    const rest = m[4].trim().replace(/\.$/, "");
    const cut = rest.indexOf(". ");
    const estado = cut >= 0 ? rest.slice(0, cut) : rest;
    const lote = cut >= 0 ? rest.slice(cut + 2) : "";
    inventario.push([Number(m[1]), m[3], hostOf(m[3]), estado, lote, m[2].replace(/\s+/g, " ").trim()]);
  }

  // Videos y enlaces de learn que cita el maestro (fuentes permitidas, D1).
  const videos = new Map();
  const cuenta = new Set();
  lines.forEach((l, i) => {
    for (const m of l.matchAll(/https?:\/\/[^\s)\]>"']+/g)) {
      const u = m[0].replace(/[.,;:]+$/, "");
      const yt = u.match(YT_SINGLE);
      if (yt) {
        const sec = sectionOf(lines, i);
        const set = videos.get(yt[1]) ?? new Set();
        set.add(sec);
        videos.set(yt[1], set);
      }
      if (FORBIDDEN_HOST.test(hostOf(u))) cuenta.add(u);
    }
  });
  return { claves, cursos, inventario, videos, cuenta };
}

// --- armado ---

function splitRows(rows, header, key, maxBytes, what) {
  // Partes greedy por orden: cada parte ≤ maxBytes con su envoltura.
  const parts = [];
  let cur = [];
  let size = bytes(JSON.stringify({ ...header(0), [key]: [] }));
  for (const r of rows) {
    const rb = bytes(JSON.stringify(r)) + 1;
    if (cur.length && size + rb > maxBytes) {
      parts.push(cur);
      cur = [];
      size = bytes(JSON.stringify({ ...header(parts.length), [key]: [] }));
    }
    if (size + rb > maxBytes) fail(`atlas-build: una fila de ${what} no cabe en ${maxBytes} bytes`);
    cur.push(r);
    size += rb;
  }
  if (cur.length || !parts.length) parts.push(cur);
  return parts;
}

export function build({ cache, maestro, maxBytes = MAX_FILE_BYTES }) {
  const src = readDerived(cache);
  const mae = readMaestro(maestro);

  // 1. Filas de docs → páginas distintas, alias y rotos.
  const sitemapCanon = new Set();
  const rows = [];
  for (const part of src.docs) {
    if (!Array.isArray(part.json.pages)) fail(`atlas-build: la partición ${part.id} no trae pages[]`);
    part.json.pages.forEach((r, idx) => {
      const where = `${part.id}#${idx}`;
      rejectLearnUrl(str(r.url), where);
      if (r.sitemap_url) rejectLearnUrl(str(r.sitemap_url), where);
      const cu = canonicalDocsUrl(str(r.url));
      if (!cu) fail(`atlas-build: entrada fuera de palantir.com/docs (${where}): ${str(r.url)}`);
      if (!LANGS.includes(r.lang)) fail(`atlas-build: idioma desconocido (${where}): ${r.lang}`);
      const sitemap = str(r.source).startsWith("sitemap:");
      if (sitemap) sitemapCanon.add(cu);
      rows.push({ part: part.id, r, cu, sitemap, where });
    });
  }
  const pages = new Map(); // u → { page, part, sitemap }
  const aliasMap = new Map(); // alias → [canónica, origen]
  const urlsSitemapPorIdioma = Object.fromEntries(LANGS.map((l) => [l, 0]));
  const sitemapPorParticion = {};
  let urlsSitemap = 0;
  let nuevas = 0;
  let rotos = 0;
  let aliasFilas = 0;
  let imagenes = 0;
  let fuera = 0;
  let altLargos = 0;
  const imgUnicas = new Set();
  const fueraUnicas = new Set();
  for (const { part, r, cu, sitemap, where } of rows) {
    if (sitemap) {
      urlsSitemap++;
      inc(urlsSitemapPorIdioma, r.lang);
      inc(sitemapPorParticion, part);
      const su = canonicalDocsUrl(str(r.sitemap_url));
      if (su && su !== cu) aliasMap.set(su, [cu, "sitemap"]);
    } else if (r.soft_404 === true || /\/docs\/404$/.test(cu)) {
      rotos++;
      continue;
    } else if (sitemapCanon.has(cu)) {
      aliasFilas++;
      continue;
    }
    if (pages.has(cu)) continue; // gana la primera aparición (orden de archivo y fila)
    if (!sitemap) nuevas++;
    const images = [];
    const seenImg = new Set();
    for (const im of Array.isArray(r.images) ? r.images : []) {
      const s = str(im?.src);
      if (!IMAGE_PREFIXES.some((p) => s.startsWith(p))) {
        fuera++;
        fueraUnicas.add(s);
        continue;
      }
      let alt = typeof im.alt === "string" && im.alt.trim() ? im.alt.trim() : null;
      if (alt && alt.split(/\s+/).length > 30) {
        alt = null;
        altLargos++;
      }
      const key = s + "\u0000" + (alt ?? "");
      if (seenImg.has(key)) continue;
      seenImg.add(key);
      images.push([s, alt]);
      imagenes++;
      imgUnicas.add(s);
    }
    const vd = [];
    for (const v of Array.isArray(r.videos) ? r.videos : []) {
      const ref = videoRef(v, where);
      if (!vd.some((x) => x[1] === ref[1])) vd.push(ref);
    }
    const cells = [];
    for (const c of Array.isArray(r.cells) ? r.cells : []) {
      const code = str(c?.cell) || str(c?.group);
      const base = str(c?.basis);
      if (code && !cells.some((x) => x[0] === code && x[1] === base)) cells.push([code, base]);
    }
    const page = {
      k: cu === "https://www.palantir.com/docs" ? "" : cu.slice("https://www.palantir.com/docs/".length),
      u: cu,
      t: str(r.title),
      b: (Array.isArray(r.breadcrumb) ? r.breadcrumb : []).map(str).filter(Boolean),
      p: str(r.product),
      c: str(r.capability),
      s: str(r.section),
      l: r.lang,
      h: (Array.isArray(r.headings) ? r.headings : [])
        .filter((x) => typeof x?.t === "string" && x.t.trim())
        .map((x) => [Number(x.l) || 0, x.t, str(x.id)]),
      i: images,
      vd,
      lm: isoOrNull(r.http_last_modified),
      cells,
    };
    if (r.api_endpoint && typeof r.api_endpoint === "object") {
      const a = r.api_endpoint;
      page.api = { m: str(a.method), path: str(a.path), op: str(a.operationId), scopes: (Array.isArray(a.scopes) ? a.scopes : []).map(str) };
    }
    pages.set(cu, { page, part, sitemap, enRaw: typeof r.en_equivalent === "string" ? r.en_equivalent : null, lastmod: str(r.lastmod_sitemap) });
  }
  for (const [a] of aliasMap) if (pages.has(a)) aliasMap.delete(a); // un alias nunca tapa una página
  const aliasSitemap = aliasMap.size;

  // 2. Alias descubiertos (docs-aliases.json, del Paso 0).
  let aliasDescubiertos = 0;
  for (const [req, fin, soft] of Array.isArray(src.aliases.descubiertas) ? src.aliases.descubiertas : []) {
    rejectLearnUrl(str(req), "docs-aliases.json");
    const cf = canonicalDocsUrl(str(fin));
    if (soft === true || !cf || /\/docs\/404$/.test(cf) || !sitemapCanon.has(cf)) continue;
    aliasDescubiertos++;
    const ca = canonicalDocsUrl(str(req));
    if (ca && ca !== cf && !pages.has(ca) && !aliasMap.has(ca)) aliasMap.set(ca, [cf, "descubierta"]);
  }
  const resolve = (u) => {
    const c = canonicalDocsUrl(u);
    if (!c) return null;
    if (pages.has(c)) return c;
    const a = aliasMap.get(c);
    return a && pages.has(a[0]) ? a[0] : null;
  };

  // 3. Pares en inglés: sólo si la URL que publica la traducción es una página del Atlas tal cual
  //    (sin pasar por alias), igual que la comprobación del barrido.
  let pares = 0;
  let paresSitemap = 0;
  for (const v of pages.values()) {
    if (!v.enRaw || v.page.l === "en") continue;
    const e = canonicalDocsUrl(v.enRaw);
    if (e && pages.has(e) && pages.get(e).page.l === "en") {
      v.page.en = e;
      pares++;
      if (v.sitemap) paresSitemap++;
    }
  }

  // 4. Claves del catálogo (§20) como códigos de búsqueda.
  const codigosExtra = new Map();
  let paginasConClave = 0;
  for (const [key, urls] of [...mae.claves, ...mae.cursos]) {
    for (const u of urls) {
      const p = resolve(u);
      if (!p) continue;
      const set = codigosExtra.get(p) ?? new Set();
      set.add(key);
      codigosExtra.set(p, set);
    }
  }
  paginasConClave = codigosExtra.size;

  // 5. Particiones (orden por URL, partidas si pasan de maxBytes).
  const byPart = new Map();
  for (const v of pages.values()) {
    const list = byPart.get(v.part) ?? [];
    list.push(v.page);
    byPart.set(v.part, list);
  }
  const files = new Map(); // ruta relativa → contenido
  const particiones = [];
  const fileOfPage = new Map();
  for (const id of [...byPart.keys()].sort(cmp)) {
    const list = byPart.get(id).sort((a, b) => cmp(a.u, b.u));
    const whole = JSON.stringify({ v: 1, id, pages: list });
    const chunks = bytes(whole) <= maxBytes ? [list] : splitRows(list, (n) => ({ v: 1, id, part: n }), "pages", maxBytes, `la partición ${id}`);
    const out = [];
    chunks.forEach((chunk, n) => {
      const text = chunks.length === 1 ? whole : JSON.stringify({ v: 1, id, part: n, pages: chunk });
      const name = chunks.length === 1 ? `docs/${id}.${sha10(text)}.json` : `docs/${id}.${n}.${sha10(text)}.json`;
      files.set(name, text);
      out.push(name);
      for (const pg of chunk) fileOfPage.set(pg.u, name);
    });
    particiones.push({ id, files: out, bytes: out.reduce((s, f) => s + bytes(files.get(f)), 0), pages: list.length, sitemap: sitemapPorParticion[id] ?? 0 });
  }

  // 6. Índices por idioma.
  const indices = [];
  for (const lang of LANGS) {
    const list = [...pages.values()].map((v) => v.page).filter((p) => p.l === lang).sort((a, b) => cmp(a.u, b.u));
    const idxRows = list.map((p) => {
      const codes = new Set(p.cells.map((c) => c[0]));
      for (const k of codigosExtra.get(p.u) ?? []) codes.add(k);
      return [p.k, fileOfPage.get(p.u), p.t, p.b, atlasTokens(p), p.h.map((h) => [h[2], h[1]]), p.p, p.c, p.s, [...codes].sort(cmp)];
    });
    const chunks = splitRows(idxRows, (n) => ({ v: 1, lang, n }), "rows", maxBytes, `el índice ${lang}`);
    const out = [];
    chunks.forEach((chunk, n) => {
      const text = JSON.stringify({ v: 1, lang, n, rows: chunk });
      const name = `index/${lang}.${n}.${sha10(text)}.json`;
      files.set(name, text);
      out.push(name);
    });
    indices.push({ lang, files: out, bytes: out.reduce((s, f) => s + bytes(files.get(f)), 0), rows: idxRows.length });
  }

  // 7. Alias.
  const aliasRows = [...aliasMap.entries()].map(([a, [c, o]]) => [a, c, o]).sort((x, y) => cmp(x[0], y[0]));
  const aliasText = JSON.stringify({ v: 1, alias: aliasRows });
  const aliasName = `alias.${sha10(aliasText)}.json`;
  files.set(aliasName, aliasText);

  // 8. Build (sólo publicadas; las «Page not found», contadas).
  const entries = Array.isArray(src.build.entries) ? src.build.entries : fail("atlas-build: build-catalog.json no trae entries[]");
  const ejemplos = [];
  let noEncontradas = 0;
  let conVideo = 0;
  const vimeo = new Map();
  const ytBuild = new Map();
  for (const e of entries) {
    const u = str(e.url);
    rejectLearnUrl(u, "build-catalog.json");
    if (hostOf(u) !== "build.palantir.com") fail(`atlas-build: entrada de build fuera de build.palantir.com: ${u}`);
    const publicada = str(e.state) === "publicada";
    // Los recorridos en video vienen del bundle público de build aunque su página dé «Page not found»
    // (los 6 recorridos, 5 ids de Vimeo, están en entradas no publicadas): se conservan con su etiqueta.
    const vids = [];
    for (const v of Array.isArray(e.youtube) ? e.youtube : []) {
      const s = str(v);
      if (YT_LISTING.test(s)) fail(`atlas-build rechaza un listado de YouTube (build-catalog.json): ${s}`);
      const vm = s.match(VIMEO);
      const ym = s.match(YT_SINGLE);
      if (vm) {
        if (!vids.includes(vm[1])) vids.push(vm[1]);
        if (!vimeo.has(vm[1])) vimeo.set(vm[1], { id: vm[1], build: u, publicada, etiqueta: str(e.title) });
      } else if (ym) {
        ytBuild.set(ym[1], u);
      } else fail(`atlas-build: video de build no reconocido: ${s}`);
    }
    if (vids.length) conVideo++;
    if (!publicada) {
      noEncontradas++;
      continue;
    }
    const docsLinks = [];
    for (const d of Array.isArray(e.docs_links) ? e.docs_links : []) {
      if (FORBIDDEN_HOST.test(hostOf(str(d)))) {
        mae.cuenta.add(str(d));
        continue;
      }
      const p = resolve(str(d));
      if (p && !docsLinks.includes(p)) docsLinks.push(p);
    }
    const imgs = [];
    for (const im of Array.isArray(e.images) ? e.images : []) {
      const s = typeof im === "string" ? im : str(im?.src);
      if (s.startsWith("https://build.palantir.com/") && !imgs.includes(s)) imgs.push(s);
    }
    ejemplos.push({
      u,
      t: str(e.title),
      tipos: (Array.isArray(e.content_type) ? e.content_type : []).map(str).filter(Boolean),
      instalacion: (Array.isArray(e.install_mode) ? e.install_mode : []).map(str).filter(Boolean),
      portada: e.on_homepage === true,
      docs: docsLinks,
      vimeo: vids,
      i: imgs,
    });
  }
  ejemplos.sort((a, b) => cmp(a.u, b.u));
  const buildText = JSON.stringify({ v: 1, ejemplos });
  const buildName = `build.${sha10(buildText)}.json`;
  files.set(buildName, buildText);

  // 9. Videos: ids de docs, del maestro y de build; Vimeo de build; los dos canales como enlaces.
  const yt = new Map();
  const yget = (id) => {
    if (!yt.has(id)) yt.set(id, { id, fuentes: [], paginas: [], maestro: [] });
    return yt.get(id);
  };
  for (const v of pages.values()) {
    for (const [, id] of v.page.vd) {
      const e = yget(id);
      if (!e.fuentes.includes("docs")) e.fuentes.push("docs");
      e.paginas.push(v.page.u);
    }
  }
  for (const [id, secs] of mae.videos) {
    const e = yget(id);
    if (!e.fuentes.includes("maestro")) e.fuentes.push("maestro");
    e.maestro = [...secs].sort(cmp);
  }
  for (const [id] of ytBuild) {
    const e = yget(id);
    if (!e.fuentes.includes("build")) e.fuentes.push("build");
  }
  const youtube = [...yt.values()].map((e) => ({ ...e, fuentes: [...e.fuentes].sort(cmp), paginas: [...new Set(e.paginas)].sort(cmp) })).sort((a, b) => cmp(a.id, b.id));
  const catalog = { v: 1, youtube, vimeo: [...vimeo.values()].sort((a, b) => cmp(a.id, b.id)), canales: CHANNELS };
  const videosText = JSON.stringify(catalog);
  const videosName = `videos.${sha10(videosText)}.json`;
  files.set(videosName, videosText);

  // 10. Inventario (§21), sin las credenciales personales (RNF-6): sólo se cuentan.
  const credenciales = mae.inventario.filter((x) => x[2] === "certifications.ontologize.com");
  const publicadas = mae.inventario.filter((x) => x[2] !== "certifications.ontologize.com");
  const invText = JSON.stringify({ v: 1, entradas: publicadas });
  const invName = `inventario.${sha10(invText)}.json`;
  files.set(invName, invText);

  // 11. Celdas: las 124 fichas del mapeo del barrido + D1-D8, X01-X24 y SD-01 a SD-12.
  const celdas = [];
  for (const [codigo, c] of Object.entries(src.cells)) {
    celdas.push({
      codigo,
      ruta: str(c.group),
      directas: [...new Set((Array.isArray(c.direct_pages) ? c.direct_pages : []).map((u) => resolve(str(u))).filter(Boolean))].sort(cmp),
      por_base: Object.fromEntries(Object.entries(c.by_basis_en ?? {}).sort((a, b) => cmp(a[0], b[0]))),
    });
  }
  const extra = [
    ...Array.from({ length: 8 }, (_, i) => ["D" + (i + 1), "D"]),
    ...Array.from({ length: 24 }, (_, i) => ["X" + String(i + 1).padStart(2, "0"), "X"]),
    ...Array.from({ length: 12 }, (_, i) => ["SD-" + String(i + 1).padStart(2, "0"), "SD"]),
  ];
  for (const [codigo, ruta] of extra) if (!src.cells[codigo]) celdas.push({ codigo, ruta, directas: [], por_base: {} });
  celdas.sort((a, b) => cmp(a.codigo, b.codigo));
  const celdasText = JSON.stringify({ v: 1, celdas });
  const celdasName = `celdas.${sha10(celdasText)}.json`;
  files.set(celdasName, celdasText);

  // 12. Árbol, secciones guiadas, conteos y manifiesto.
  const arbol = {};
  const porIdioma = Object.fromEntries(LANGS.map((l) => [l, 0]));
  const guiadas = Object.fromEntries(GUIDED.map((g) => [g, 0]));
  let api = 0;
  let videosRefs = 0;
  const fechas = {};
  for (const v of pages.values()) {
    const p = v.page;
    inc(porIdioma, p.l);
    const a = ((arbol[p.l] ??= {})[p.p || "(raíz)"] ??= {});
    const c = (a[p.c || "(index)"] ??= {});
    inc(c, p.s || "(sin sección)");
    if (p.l === "en" && GUIDED.includes(p.s)) inc(guiadas, p.s);
    if (p.api) api++;
    videosRefs += p.vd.length;
    if (v.lastmod) inc(fechas, v.lastmod.slice(0, 10));
  }
  const sortDeep = (o) =>
    o && typeof o === "object" && !Array.isArray(o) ? Object.fromEntries(Object.keys(o).sort(cmp).map((k) => [k, sortDeep(o[k])])) : o;
  const capturado = Object.entries(fechas).sort((a, b) => b[1] - a[1] || cmp(a[0], b[0]))[0]?.[0] ?? "";
  const manifest = {
    v: 1,
    capturado,
    fuente_sha10: src.fuente,
    capas: {
      docs: {
        paginas: pages.size,
        por_idioma: porIdioma,
        urls_capturadas: urlsSitemap + nuevas,
        urls_sitemap: urlsSitemap,
        urls_sitemap_por_idioma: urlsSitemapPorIdioma,
        descubiertas_nuevas: nuevas,
        alias_sitemap: aliasSitemap,
        alias_descubiertos: aliasDescubiertos,
        alias: aliasRows.length,
        rotos,
        api,
        pares_en: pares,
        pares_en_sitemap: paresSitemap,
        imagenes,
        imagenes_unicas: imgUnicas.size,
        imagenes_fuera: fuera,
        imagenes_fuera_unicas: fueraUnicas.size,
        alt_largos: altLargos,
        videos: videosRefs,
        filas_alias_en_particiones: aliasFilas,
      },
      build: { publicadas: ejemplos.length, no_encontradas: noEncontradas, con_video: conVideo, archivo: buildName },
      videos: {
        youtube: youtube.length,
        youtube_docs: youtube.filter((e) => e.fuentes.includes("docs")).length,
        youtube_maestro: youtube.filter((e) => e.fuentes.includes("maestro")).length,
        vimeo: catalog.vimeo.length,
        canales: CHANNELS.length,
        archivo: videosName,
      },
      inventario: { entradas: mae.inventario.length, publicadas: publicadas.length, credenciales_contadas: credenciales.length, archivo: invName },
      catalogo: { claves: mae.claves.size, cursos: mae.cursos.size, paginas_con_clave: paginasConClave },
      celdas: { total: celdas.length, con_paginas: celdas.filter((c) => c.directas.length || Object.keys(c.por_base).length).length, archivo: celdasName },
    },
    arbol: sortDeep(arbol),
    particiones,
    indices,
    alias: aliasName,
    secciones_guiadas: guiadas,
    requiere_cuenta: [...mae.cuenta].sort(cmp),
  };
  const manifestText = JSON.stringify(manifest, null, 1) + "\n";
  for (const [name, text] of files) if (bytes(text) > maxBytes) fail(`atlas-build: ${name} pasa de ${maxBytes} bytes`);

  const docsUrls = [...new Set([...pages.keys(), ...aliasMap.keys()])].sort(cmp);
  return {
    files,
    manifestText,
    atlasDocsUrlsText: JSON.stringify(docsUrls, null, 0).replace(/","/g, '",\n"') + "\n",
    videosJsonText: JSON.stringify(catalog, null, 1) + "\n",
    manifest,
  };
}

/** Escribe la salida: borra la versión anterior de `out` salvo los dos archivos que genera el build. */
export function write(result, { out, dataOut }) {
  const keep = new Set(["videos/oembed.json", "videos/canales.json"]);
  if (fs.existsSync(out)) {
    (function clean(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        const rel = path.relative(out, full).split(path.sep).join("/");
        if (e.isDirectory()) {
          clean(full);
          if (!fs.readdirSync(full).length) fs.rmdirSync(full);
        } else if (!keep.has(rel)) fs.unlinkSync(full);
      }
    })(out);
  }
  for (const [name, text] of result.files) {
    const full = path.join(out, ...name.split("/"));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
  }
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "manifest.json"), result.manifestText);
  fs.mkdirSync(dataOut, { recursive: true });
  fs.writeFileSync(path.join(dataOut, "atlas-docs-urls.json"), result.atlasDocsUrlsText);
  fs.writeFileSync(path.join(dataOut, "videos.json"), result.videosJsonText);
}

export function run(argv, env = process.env) {
  try {
    const cache = argValue(argv, "--cache") ?? env.ARCANUM_FORGE_CACHE;
    if (!cache) fail("atlas-build: falta --cache <dir> o ARCANUM_FORGE_CACHE");
    const maestro = argValue(argv, "--maestro") ?? env.ARCANUM_FORGE_MAESTRO;
    const out = path.resolve(argValue(argv, "--out") ?? path.join(REPO, "public", "atlas", "v1"));
    const dataOut = path.resolve(argValue(argv, "--data-out") ?? path.join(REPO, "src", "forge", "data"));
    const maxBytes = Number(argValue(argv, "--max-bytes") ?? MAX_FILE_BYTES);
    if (!Number.isInteger(maxBytes) || maxBytes < 1024) fail("atlas-build: --max-bytes inválido");
    const result = build({ cache, maestro, maxBytes });
    write(result, { out, dataOut });
    const d = result.manifest.capas.docs;
    return {
      code: 0,
      out:
        `atlas-build: ${d.paginas} páginas (${d.urls_capturadas} URLs capturadas: ${d.urls_sitemap} del sitemap + ${d.descubiertas_nuevas} descubiertas; ` +
        `${d.alias_sitemap} del sitemap son alias), ${d.alias} alias, ${d.rotos} rotos, ${result.files.size + 1} archivos, ` +
        `manifest sha256[:10] ${sha10(result.manifestText)}`,
    };
  } catch (e) {
    if (e instanceof AtlasBuildError) return { code: 1, err: e.message };
    throw e;
  }
}

const same = (a, b) => (process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b);
if (process.argv[1] && same(path.resolve(process.argv[1]), SCRIPT)) {
  const r = run(process.argv.slice(2));
  if (r.out) console.log(r.out);
  if (r.err) console.error(r.err);
  process.exit(r.code);
}
