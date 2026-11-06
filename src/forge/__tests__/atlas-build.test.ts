// CA-55 (y la parte de guion de CA-46, CA-49 y CA-53): derived-manifest y atlas-build sobre una caché
// de prueba (`fixtures/cache`), cuya meta_description y cuya descripción de build traen palabras que no
// están en ningún metadato («CANARIOPROSA zebra quantum nebula»).
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { atlasTokens, canonicalDocsUrl, normalizeAtlasText, type AtlasIndexFile, type AtlasManifest, type AtlasPage, type AtlasPartitionFile } from "../atlas/types";
// @ts-ignore: guion .mjs sin tipos
import * as atlasBuild from "../../../scripts/forge/atlas-build.mjs";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const FIXTURE = path.join(ROOT, "src", "forge", "__tests__", "fixtures", "cache");
const MAESTRO = path.join(ROOT, "src", "forge", "__tests__", "fixtures", "maestro-mini.md");
const DERIVED_MANIFEST = path.join(ROOT, "scripts", "forge", "derived-manifest.mjs");
const ATLAS_BUILD = path.join(ROOT, "scripts", "forge", "atlas-build.mjs");
const FORBIDDEN_KEYS = [
  "meta_description",
  "subtitle",
  "description",
  "body",
  "text",
  "content",
  "markdown",
  "html",
  "chain",
  "source",
  "status",
  "soft_404",
  "sitemap_url",
  "template",
  "internal_links_out",
  "alt_words",
];

function tmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
function copyFixture(): string {
  const dir = tmp("atlas-cache-");
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}
function node(script: string, args: string[]) {
  const r = spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env: { ...process.env, ARCANUM_FORGE_CACHE: "", ARCANUM_FORGE_MAESTRO: "" } });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}
function paso0(cache: string) {
  return node(DERIVED_MANIFEST, ["--cache", cache]);
}
function atlas(cache: string, extra: string[] = []) {
  const out = tmp("atlas-out-");
  const r = node(ATLAS_BUILD, ["--cache", cache, "--maestro", MAESTRO, "--out", path.join(out, "atlas"), "--data-out", path.join(out, "data"), ...extra]);
  return { ...r, atlasDir: path.join(out, "atlas"), dataDir: path.join(out, "data") };
}
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out.sort();
}
function rel(base: string, f: string) {
  return path.relative(base, f).split(path.sep).join("/");
}
function deepKeys(v: unknown, acc: Set<string>) {
  if (Array.isArray(v)) for (const x of v) deepKeys(x, acc);
  else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      acc.add(k);
      deepKeys(x, acc);
    }
  }
  return acc;
}
function readJson<T>(f: string): T {
  return JSON.parse(fs.readFileSync(f, "utf8")) as T;
}
function okBuild(extra: string[] = [], mutate?: (cache: string) => void) {
  const cache = copyFixture();
  mutate?.(cache);
  const p0 = paso0(cache);
  expect(p0.status, p0.stderr).toBe(0);
  const r = atlas(cache, extra);
  expect(r.status, r.stderr).toBe(0);
  const manifest = readJson<AtlasManifest>(path.join(r.atlasDir, "manifest.json"));
  const pages: AtlasPage[] = [];
  for (const p of manifest.particiones) for (const f of p.files) pages.push(...readJson<AtlasPartitionFile>(path.join(r.atlasDir, f)).pages);
  return { cache, ...r, manifest, pages };
}

describe("Atlas · derived-manifest (Paso 0, RF-A9)", () => {
  it("regenera el manifiesto sin learn ni YouTube y sólo con archivos que existen", () => {
    const cache = copyFixture();
    const before = readJson<{ files: { file: string }[] }>(path.join(cache, "derived", "manifest.json"));
    expect(before.files.map((f) => f.file)).toContain("learn-catalog.json"); // la caché vieja (H14)
    const r = paso0(cache);
    expect(r.status, r.stderr).toBe(0);
    const m = readJson<{ files: { file: string; bytes: number; sha256_10: string }[] }>(path.join(cache, "derived", "manifest.json"));
    const names = m.files.map((f) => f.file);
    expect(names.filter((f) => /learn|certification|youtube/i.test(f)), "el manifiesto regenerado lista learn o YouTube").toEqual([]);
    for (const f of m.files) {
      const buf = fs.readFileSync(path.join(cache, "derived", f.file));
      expect(f.bytes).toBe(buf.length);
      expect(f.sha256_10).toBe(crypto.createHash("sha256").update(buf).digest("hex").slice(0, 10));
    }
    expect(names).toContain("docs-aliases.json");
    const text1 = fs.readFileSync(path.join(cache, "derived", "manifest.json"), "utf8");
    expect(paso0(cache).status).toBe(0);
    expect(fs.readFileSync(path.join(cache, "derived", "manifest.json"), "utf8"), "derived-manifest no es determinista").toBe(text1);
  });

  it("falla si derived contiene un archivo de learn, certification o listados de YouTube", () => {
    for (const name of ["learn-catalog.json", "youtube-catalog.json", "certification-pages.json"]) {
      const cache = copyFixture();
      fs.writeFileSync(path.join(cache, "derived", name), "{}");
      const r = paso0(cache);
      expect(r.status, `derived-manifest aceptó ${name}`).toBe(1);
      expect(r.stderr).toMatch(/learn, certification o listados de YouTube/);
    }
  });
});

describe("Atlas · atlas-build (CA-55)", () => {
  it("dos corridas sobre la misma entrada dan el mismo manifiesto y los mismos bytes", () => {
    const cache = copyFixture();
    expect(paso0(cache).status).toBe(0);
    const a = atlas(cache);
    const b = atlas(cache);
    expect(a.status, a.stderr).toBe(0);
    expect(b.status, b.stderr).toBe(0);
    const hash = (f: string) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
    expect(hash(path.join(a.atlasDir, "manifest.json")), "atlas-build no es determinista").toBe(hash(path.join(b.atlasDir, "manifest.json")));
    const listA = walk(a.atlasDir).map((f) => `${rel(a.atlasDir, f)} ${hash(f)}`);
    const listB = walk(b.atlasDir).map((f) => `${rel(b.atlasDir, f)} ${hash(f)}`);
    expect(listA).toEqual(listB);
    for (const f of ["atlas-docs-urls.json", "videos.json"]) expect(hash(path.join(a.dataDir, f))).toBe(hash(path.join(b.dataDir, f)));
  });

  it("ninguna salida trae meta_description, subtítulos, descripciones ni cuerpos", () => {
    const r = okBuild();
    const files = [...walk(r.atlasDir), ...walk(r.dataDir)];
    for (const f of files) {
      const text = fs.readFileSync(f, "utf8");
      expect(text.includes("CANARIOPROSA"), `el Atlas contiene prosa: ${rel(r.atlasDir, f)}`).toBe(false);
      const keys = deepKeys(JSON.parse(text), new Set());
      for (const k of FORBIDDEN_KEYS) expect(keys.has(k), `el Atlas contiene prosa: la clave ${k} en ${path.basename(f)}`).toBe(false);
    }
  });

  it("cada token del índice sale de los metadatos de su página", () => {
    const r = okBuild();
    const byK = new Map(r.pages.map((p) => [p.u, p]));
    let rows = 0;
    for (const idx of r.manifest.indices) {
      for (const f of idx.files) {
        for (const row of readJson<AtlasIndexFile>(path.join(r.atlasDir, f)).rows) {
          rows++;
          const page = byK.get(row[0] === "" ? "https://www.palantir.com/docs" : `https://www.palantir.com/docs/${row[0]}`);
          expect(page, `fila del índice sin página: ${row[0]}`).toBeTruthy();
          const meta = [page!.t, ...page!.b, ...page!.h.map((h) => h[1]), page!.p, page!.c, page!.s].join(" ");
          const allowed = new Set(normalizeAtlasText(meta, page!.l).split(/\s+/).filter(Boolean));
          const extra = row[4].split(" ").filter(Boolean).filter((t) => !allowed.has(t));
          expect(extra, "el índice contiene palabras que no salen de los metadatos").toEqual([]);
          expect(row[4]).toBe(atlasTokens(page!));
          const part = readJson<AtlasPartitionFile>(path.join(r.atlasDir, row[1]));
          expect(part.pages.some((p) => p.u === page!.u), `la fila de ${page!.u} apunta a un archivo que no la contiene`).toBe(true);
        }
      }
    }
    expect(rows).toBe(r.pages.length);
  });

  it("cuenta y deduplica como el barrido: u única, alias, rotos, pares e imágenes", () => {
    const r = okBuild();
    const d = r.manifest.capas.docs;
    const us = r.pages.map((p) => p.u);
    expect(new Set(us).size, "u repetida en el Atlas").toBe(us.length);
    expect(d.paginas).toBe(6);
    expect(d.urls_sitemap).toBe(6);
    expect(d.descubiertas_nuevas).toBe(1);
    expect(d.urls_capturadas).toBe(7);
    expect(d.alias_sitemap, "una URL del sitemap que redirige a otra página no quedó como alias").toBe(1);
    expect(d.paginas + d.alias_sitemap).toBe(d.urls_capturadas);
    expect(d.alias_descubiertos).toBe(1);
    expect(d.rotos).toBe(1);
    expect(d.api).toBe(1);
    expect(d.pares_en).toBe(1);
    expect(d.por_idioma).toEqual({ en: 4, jp: 2, zh: 0, kr: 0 });
    const alias = readJson<{ alias: [string, string, string][] }>(path.join(r.atlasDir, r.manifest.alias)).alias;
    expect(alias).toEqual([
      ["https://www.palantir.com/docs/foundry/ontology/old-overview", "https://www.palantir.com/docs/foundry/ontology/overview", "sitemap"],
      ["https://www.palantir.com/docs/foundry/ontology/semantic-old", "https://www.palantir.com/docs/foundry/action-types/consistency-guarantees", "descubierta"],
    ]);
    for (const p of r.pages) for (const [src] of p.i) expect(src.startsWith("https://www.palantir.com/") || src.startsWith("https://build.palantir.com/"), `un marcador de ejemplo entró al Atlas: ${src}`).toBe(true);
    const overview = r.pages.find((p) => p.u === "https://www.palantir.com/docs/foundry/ontology/overview")!;
    expect(overview.s).toBe("ontology");
    expect(overview.i).toEqual([
      ["https://www.palantir.com/docs/resources/foundry/ontology/graph.png", "Ontology graph"],
      ["https://www.palantir.com/docs/resources/foundry/ontology/long.png", null],
    ]);
    expect(d.imagenes_fuera, "un marcador de ejemplo entró al Atlas").toBe(2);
    expect(d.alt_largos).toBe(1);
    expect(overview.vd).toEqual([["youtube", "7rRLOTXe60Q"]]);
    expect(overview.cells).toEqual([["P2-01", "cita_directa"], ["P2", "grupo_tematico"]]);
    expect(overview.lm).toBe("2026-11-05T19:40:00Z");
    expect(r.pages.find((p) => p.l === "jp" && p.k === "jp/foundry/ontology/overview")!.en).toBe(overview.u);
    expect(r.pages.find((p) => p.k === "jp/foundry/ontology/discovered-page")!.en).toBeUndefined();
    const api = r.pages.find((p) => p.api)!;
    expect(api.api).toEqual({ m: "POST", path: "/api/v2/ontologies/{ontology}/actions/{action}/apply", op: "v2.applyAction", scopes: ["api:ontologies-write"] });
    expect(r.manifest.capturado).toBe("2026-11-05");
  });

  it("build, videos, inventario, catálogo y celdas salen sólo de fuentes permitidas", () => {
    const r = okBuild();
    const c = r.manifest.capas;
    expect(c.build).toMatchObject({ publicadas: 1, no_encontradas: 1, con_video: 1 });
    const build = readJson<{ ejemplos: { u: string; docs: string[]; i: string[]; vimeo: string[] }[] }>(path.join(r.atlasDir, c.build.archivo));
    expect(build.ejemplos[0]!.docs).toEqual([
      "https://www.palantir.com/docs/foundry/action-types/consistency-guarantees",
      "https://www.palantir.com/docs/foundry/ontology/overview",
    ]);
    expect(build.ejemplos[0]!.i).toEqual(["https://build.palantir.com/images/one.png"]);
    const videos = readJson<{ youtube: { id: string; fuentes: string[]; paginas: string[]; maestro: string[] }[]; vimeo: { id: string; etiqueta: string; publicada: boolean }[]; canales: { id: string }[] }>(path.join(r.dataDir, "videos.json"));
    expect(videos.youtube.map((y) => [y.id, y.fuentes])).toEqual([
      ["7rRLOTXe60Q", ["docs"]],
      ["vSJ5H00V7Es", ["maestro"]],
    ]);
    expect(videos.youtube[0]!.paginas).toHaveLength(2);
    expect(videos.youtube[1]!.maestro).toEqual(["§12"]);
    expect(videos.vimeo).toEqual([{ id: "804003285", build: "https://build.palantir.com/platform/00000000-0000-4000-8000-000000000002", publicada: false, etiqueta: "Fixture tour" }]);
    expect(videos.canales.map((x) => x.id)).toEqual(["UCQRc3PMlCsoodxbR4IsglKQ", "UCwed6_f0WcDIioXvMQfcP2Q"]);
    expect(fs.readFileSync(path.join(r.atlasDir, c.videos.archivo), "utf8")).toBe(JSON.stringify(videos));
    expect(c.inventario, "una credencial personal del §21 se publicó").toMatchObject({ entradas: 3, publicadas: 2, credenciales_contadas: 1 });
    const inv = fs.readFileSync(path.join(r.atlasDir, c.inventario.archivo), "utf8");
    expect(inv.includes("ontologize"), "una credencial personal del §21 se publicó").toBe(false);
    expect(c.catalogo).toEqual({ claves: 3, cursos: 1, paginas_con_clave: 2 });
    expect(r.manifest.requiere_cuenta).toEqual(["https://learn.palantir.com/", "https://learn.palantir.com/speedrun-your-e2e-aip-workflow"]);
    expect(c.celdas.total).toBe(2 + 8 + 24 + 12);
    const urls = readJson<string[]>(path.join(r.dataDir, "atlas-docs-urls.json"));
    expect(urls).toEqual([...new Set([...r.pages.map((p) => p.u), "https://www.palantir.com/docs/foundry/ontology/old-overview", "https://www.palantir.com/docs/foundry/ontology/semantic-old"])].sort());
  });

  it("parte particiones e índices que pasan del límite y ningún archivo lo excede", () => {
    const limit = 4096;
    // Ocho páginas más con veinte encabezados cada una hacen que la partición y el índice en inglés pasen del límite.
    const grow = (cache: string) => {
      const f = path.join(cache, "derived", "docs", "en", "foundry", "ontology.json");
      const part = readJson<{ pages: Record<string, unknown>[] }>(f);
      for (let n = 0; n < 8; n++) {
        part.pages.push({
          ...part.pages[2],
          url: `https://www.palantir.com/docs/foundry/ontology/grown-${n}`,
          sitemap_url: `https://palantir.com/docs/foundry/ontology/grown-${n}/`,
          headings: Array.from({ length: 20 }, (_, i) => ({ l: 2, t: `Heading number ${i} of grown page ${n}`, id: `heading-${i}` })),
        });
      }
      fs.writeFileSync(f, JSON.stringify(part));
    };
    const r = okBuild(["--max-bytes", String(limit)], grow);
    const split = r.manifest.particiones.filter((p) => p.files.length > 1);
    expect(split.length, "ninguna partición se partió con el límite de prueba").toBeGreaterThan(0);
    expect(r.manifest.indices.find((i) => i.lang === "en")!.files.length, "el índice en inglés no se partió").toBeGreaterThan(1);
    for (const f of walk(r.atlasDir)) {
      if (path.basename(f) === "manifest.json") continue;
      expect(fs.statSync(f).size, `un archivo del Atlas pasa del límite: ${rel(r.atlasDir, f)}`).toBeLessThanOrEqual(limit);
    }
    expect(r.pages).toHaveLength(14);
    for (const p of split) {
      const parts = p.files.map((f) => readJson<AtlasPartitionFile>(path.join(r.atlasDir, f)));
      expect(parts.map((x) => x.part)).toEqual(parts.map((_, i) => i));
      const us = parts.flatMap((x) => x.pages.map((pg) => pg.u));
      expect(us).toEqual([...us].sort());
    }
  });

  it("no genera oembed.json ni canales.json, los conserva y borra la versión anterior", () => {
    const fresh = okBuild();
    expect(walk(fresh.atlasDir).map((f) => rel(fresh.atlasDir, f)).filter((f) => f.startsWith("videos/")), "atlas-build escribió un archivo de videos/ que es del build").toEqual([]);
    const cache = copyFixture();
    expect(paso0(cache).status).toBe(0);
    const out = tmp("atlas-keep-");
    const atlasDir = path.join(out, "atlas");
    fs.mkdirSync(path.join(atlasDir, "videos"), { recursive: true });
    fs.mkdirSync(path.join(atlasDir, "docs", "en"), { recursive: true });
    fs.writeFileSync(path.join(atlasDir, "videos", "oembed.json"), "{\"v\":1}");
    fs.writeFileSync(path.join(atlasDir, "videos", "canales.json"), "{\"v\":1}");
    fs.writeFileSync(path.join(atlasDir, "docs", "en", "vieja.0123456789.json"), "{}");
    const r = node(ATLAS_BUILD, ["--cache", cache, "--maestro", MAESTRO, "--out", atlasDir, "--data-out", path.join(out, "data")]);
    expect(r.status, r.stderr).toBe(0);
    expect(fs.readFileSync(path.join(atlasDir, "videos", "oembed.json"), "utf8")).toBe("{\"v\":1}");
    expect(fs.readFileSync(path.join(atlasDir, "videos", "canales.json"), "utf8")).toBe("{\"v\":1}");
    expect(fs.existsSync(path.join(atlasDir, "docs", "en", "vieja.0123456789.json")), "quedó un archivo de la versión anterior").toBe(false);
  });

  it("falla si el manifiesto lista un archivo ausente o que ya no coincide", () => {
    const cache = copyFixture();
    expect(paso0(cache).status).toBe(0);
    fs.unlinkSync(path.join(cache, "derived", "cells-index.json"));
    const r = atlas(cache);
    expect(r.status, "atlas-build aceptó un manifiesto con un archivo ausente").toBe(1);
    expect(r.stderr).toMatch(/el manifiesto lista un archivo ausente: cells-index\.json/);

    const cache2 = copyFixture();
    expect(paso0(cache2).status).toBe(0);
    fs.appendFileSync(path.join(cache2, "derived", "cells-index.json"), " ");
    const r2 = atlas(cache2);
    expect(r2.status, "atlas-build aceptó un manifiesto que ya no coincide").toBe(1);
    expect(r2.stderr).toMatch(/no coincide con cells-index\.json/);
  });

  it("rechaza entradas de learn, certification y listados de YouTube", () => {
    // Una entrada de learn dentro de una partición.
    const cacheRow = copyFixture();
    const partFile = path.join(cacheRow, "derived", "docs", "en", "foundry", "api.json");
    const part = readJson<{ pages: Record<string, unknown>[] }>(partFile);
    part.pages.push({ ...part.pages[0], url: "https://learn.palantir.com/speedrun-your-e2e-aip-workflow", sitemap_url: null, source: "discovered:content-link" });
    fs.writeFileSync(partFile, JSON.stringify(part));
    expect(paso0(cacheRow).status).toBe(0);
    const r2 = atlas(cacheRow);
    expect(r2.status, "atlas-build aceptó una entrada de learn").toBe(1);
    expect(r2.stderr).toMatch(/rechaza una entrada de learn o certification/);

    // Un archivo de learn presente aunque el manifiesto no lo liste.
    const cacheFile = copyFixture();
    expect(paso0(cacheFile).status).toBe(0);
    fs.writeFileSync(path.join(cacheFile, "derived", "learn-catalog.json"), "{}");
    const r1 = atlas(cacheFile);
    expect(r1.status, "atlas-build aceptó una entrada de learn").toBe(1);
    expect(r1.stderr).toMatch(/rechaza una entrada de learn/);

    // La caché vieja (manifiesto con learn-catalog.json) sin el Paso 0.
    const stale = atlas(copyFixture());
    expect(stale.status, "atlas-build aceptó una entrada de learn").toBe(1);
    expect(stale.stderr).toMatch(/rechaza una entrada de learn/);

    // Un listado de YouTube citado como video de una página.
    const cacheYt = copyFixture();
    const ytFile = path.join(cacheYt, "derived", "docs", "en", "foundry", "api.json");
    const yt = readJson<{ pages: Record<string, unknown>[] }>(ytFile);
    yt.pages[0]!.videos = [{ kind: "youtube", id: "PLx", url: "https://www.youtube.com/playlist?list=PLxxxxxxxx" }];
    fs.writeFileSync(ytFile, JSON.stringify(yt));
    expect(paso0(cacheYt).status).toBe(0);
    const r3 = atlas(cacheYt);
    expect(r3.status, "atlas-build aceptó un listado de YouTube").toBe(1);
    expect(r3.stderr).toMatch(/rechaza un listado de YouTube/);
  });

  it("las funciones de normalización de types.ts y del guion son las mismas", () => {
    const samples: [string, string][] = [
      ["Ontología • Átomo ÉXITO", "en"],
      ["がぎぐ ガギグ ＡＢＣ", "jp"],
      ["数据 集成", "zh"],
      ["온톨로지 개요", "kr"],
      ["Ｆｕｌｌｗｉｄｔｈ Café", "en"],
    ];
    for (const [t, l] of samples) expect(atlasBuild.normalizeAtlasText(t, l)).toBe(normalizeAtlasText(t, l));
    expect(normalizeAtlasText("Ontología", "en")).toBe("ontologia");
    expect(normalizeAtlasText("が", "jp")).toBe("が");
    for (const u of [
      "https://palantir.com/docs/foundry/ontology/overview/",
      "https://www.palantir.com/docs/foundry/action-types/overview/index.html?trk=x#y",
      "https://www.palantir.com/docs",
      "http://www.palantir.com/docs/foundry",
      "https://www.palantir.com.evil.example/docs/x",
      "https://learn.palantir.com/",
      "not a url",
    ]) {
      expect(atlasBuild.canonicalDocsUrl(u)).toBe(canonicalDocsUrl(u));
    }
    expect(canonicalDocsUrl("https://palantir.com/docs/foundry/ontology/overview/")).toBe("https://www.palantir.com/docs/foundry/ontology/overview");
    expect(canonicalDocsUrl("https://www.palantir.com.evil.example/docs/x")).toBeNull();
  });
});
