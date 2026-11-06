// CA-46, CA-47, la parte de datos de CA-49 y CA-53, y CA-55 sobre los datos versionados en
// public/atlas/v1 y src/forge/data (los escribió scripts/forge/atlas-build.mjs desde la caché del
// barrido del 2026-11-05). Conciliación de conteos (bitácora de c0-atlas): RF-A1 cuenta 12,025 URLs
// capturadas (12,011 del sitemap + 14 descubiertas); seis URLs del sitemap redirigen a otra página del
// sitemap, así que el Atlas trae 12,019 páginas con u única y esas seis quedan como alias.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  ATLAS_IMAGE_PREFIXES,
  ATLAS_MAX_FILE_BYTES,
  canonicalDocsUrl,
  type AtlasAliasFile,
  type AtlasBuildFile,
  type AtlasCellsFile,
  type AtlasIndexFile,
  type AtlasInventoryFile,
  type AtlasManifest,
  type AtlasPage,
  type AtlasPartitionFile,
  type AtlasVideoCatalog,
} from "../atlas/types";

const ROOT = path.resolve(__dirname, "..", "..", "..");
const ATLAS = path.join(ROOT, "public", "atlas", "v1");
const DATA = path.join(ROOT, "src", "forge", "data");
const read = <T>(f: string): T => JSON.parse(fs.readFileSync(f, "utf8")) as T;
const manifest = read<AtlasManifest>(path.join(ATLAS, "manifest.json"));
const pages: AtlasPage[] = [];
for (const p of manifest.particiones) for (const f of p.files) pages.push(...read<AtlasPartitionFile>(path.join(ATLAS, f)).pages);
const byU = new Map(pages.map((p) => [p.u, p]));
const sum = (o: unknown): number => (typeof o === "number" ? o : Object.values(o as Record<string, unknown>).reduce<number>((s, x) => s + sum(x), 0));
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out.sort();
}
const rel = (f: string) => path.relative(ATLAS, f).split(path.sep).join("/");
const FORBIDDEN_KEYS = ["meta_description", "subtitle", "description", "body", "text", "content", "markdown", "html", "chain", "source", "status", "soft_404", "sitemap_url", "template", "internal_links_out", "alt_words", "title", "author_name"];

describe("Atlas · capa docs (CA-46)", () => {
  it("12,025 URLs capturadas = 12,019 páginas con u única + 6 URLs del sitemap que son alias", () => {
    const d = manifest.capas.docs;
    expect(d.urls_sitemap).toBe(12011);
    expect(d.descubiertas_nuevas).toBe(14);
    expect(d.urls_capturadas).toBe(12025);
    expect(d.urls_sitemap_por_idioma).toEqual({ en: 5466, jp: 3400, zh: 2385, kr: 760 });
    expect(d.alias_sitemap).toBe(6);
    expect(d.paginas).toBe(12019);
    expect(d.paginas + d.alias_sitemap, "la conciliación 12,025 = páginas + alias del sitemap no cuadra").toBe(d.urls_capturadas);
    expect(d.por_idioma).toEqual({ en: 5460, jp: 3406, zh: 2386, kr: 767 });
    expect(pages).toHaveLength(12019);
    expect(byU.size, "u repetida en el Atlas").toBe(pages.length);
    const porIdioma = { en: 0, jp: 0, zh: 0, kr: 0 };
    for (const p of pages) porIdioma[p.l]++;
    expect(porIdioma).toEqual(d.por_idioma);
  });

  it("117 alias descubiertos + 6 del sitemap y 91 enlaces rotos contados fuera", () => {
    const d = manifest.capas.docs;
    expect(d.alias_descubiertos).toBe(117);
    expect(d.alias).toBe(123);
    expect(d.rotos).toBe(91);
    const alias = read<AtlasAliasFile>(path.join(ATLAS, manifest.alias)).alias;
    expect(alias).toHaveLength(123);
    expect(alias.filter((a) => a[2] === "sitemap")).toHaveLength(6);
    for (const [a, c] of alias) {
      expect(byU.has(c), `alias a una página que no está: ${a}`).toBe(true);
      expect(byU.has(a), `un alias tapa una página: ${a}`).toBe(false);
      expect(canonicalDocsUrl(a)).toBe(a);
    }
    expect(pages.some((p) => /\/docs\/404$/.test(p.u)), "un enlace roto quedó como página").toBe(false);
  });

  it("build: 97 ejemplos publicados y 36 «Page not found» contados fuera", () => {
    expect(manifest.capas.build).toMatchObject({ publicadas: 97, no_encontradas: 36 });
    const b = read<AtlasBuildFile>(path.join(ATLAS, manifest.capas.build.archivo));
    expect(b.ejemplos).toHaveLength(97);
    for (const e of b.ejemplos) {
      expect(e.u.startsWith("https://build.palantir.com/")).toBe(true);
      for (const d of e.docs) expect(byU.has(d), `build enlaza una página que no está: ${d}`).toBe(true);
      for (const i of e.i) expect(i.startsWith("https://build.palantir.com/"), `imagen de build fuera de build.palantir.com: ${i}`).toBe(true);
    }
  });

  it("videos: 20 ids de YouTube (18 de docs + 2 del maestro), 5 de Vimeo y 2 canales", () => {
    const v = read<AtlasVideoCatalog>(path.join(DATA, "videos.json"));
    expect(manifest.capas.videos).toMatchObject({ youtube: 20, youtube_docs: 18, youtube_maestro: 2, vimeo: 5, canales: 2 });
    expect(v.youtube).toHaveLength(20);
    expect(v.youtube.filter((y) => y.fuentes.includes("docs"))).toHaveLength(18);
    expect(v.youtube.filter((y) => y.fuentes.includes("maestro")).map((y) => y.id).sort()).toEqual(["TOsgyjJuQVc", "vSJ5H00V7Es"]);
    expect(v.vimeo).toHaveLength(5);
    expect(v.canales).toEqual([
      { id: "UCQRc3PMlCsoodxbR4IsglKQ", url: "https://www.youtube.com/@palantirdevelopers", etiqueta: "Palantir Developers" },
      { id: "UCwed6_f0WcDIioXvMQfcP2Q", url: "https://www.youtube.com/@palantirtech", etiqueta: "Palantir" },
    ]);
    expect(fs.readFileSync(path.join(ATLAS, manifest.capas.videos.archivo), "utf8")).toBe(JSON.stringify(v));
  });

  it("inventario: 613 entradas, 603 publicadas; las 10 credenciales sólo contadas", () => {
    expect(manifest.capas.inventario).toMatchObject({ entradas: 613, publicadas: 603, credenciales_contadas: 10 });
    const inv = read<AtlasInventoryFile>(path.join(ATLAS, manifest.capas.inventario.archivo));
    expect(inv.entradas).toHaveLength(603);
    expect(inv.entradas.some((e) => e[2] === "certifications.ontologize.com"), "una credencial personal del §21 se publicó").toBe(false);
  });

  it("celdas: las 168, con su ruta", () => {
    const c = read<AtlasCellsFile>(path.join(ATLAS, manifest.capas.celdas.archivo));
    expect(c.celdas).toHaveLength(168);
    expect(manifest.capas.celdas.total).toBe(168);
    expect(new Set(c.celdas.map((x) => x.codigo)).size).toBe(168);
    for (const x of c.celdas) for (const d of x.directas) expect(byU.has(d), `celda ${x.codigo} cita una página que no está`).toBe(true);
  });
});

describe("Atlas · árbol, traducciones y API (CA-47)", () => {
  it("los conteos del árbol coinciden con la tabla de particiones del barrido", () => {
    const part = (id: string) => manifest.particiones.find((p) => p.id === id)!;
    // Entradas del sitemap por partición, como la tabla del barrido.
    expect(part("en/foundry/data-integration").sitemap).toBe(1215);
    expect(part("en/foundry/api").sitemap).toBe(1308);
    expect(part("en/gotham/api").sitemap).toBe(241);
    // Páginas distintas (data-integration tiene 3 URLs del sitemap que son alias).
    expect(sum(manifest.arbol.en!.foundry!["data-integration"])).toBe(1212);
    expect(sum(manifest.arbol.en!.foundry!.api)).toBe(1308);
    expect(sum(manifest.arbol.en!.gotham!.api)).toBe(241);
    expect(sum(manifest.arbol)).toBe(12019);
    expect(manifest.particiones.reduce((s, p) => s + p.sitemap, 0)).toBe(12011);
    for (const p of manifest.particiones) {
      const lang = p.id.split("/")[0];
      const inPart = pages.filter((pg) => p.files.includes(fileOf(pg)));
      expect(inPart.length, `partición ${p.id}`).toBe(p.pages);
      expect(inPart.every((pg) => pg.l === lang)).toBe(true);
    }
  });

  it("6,281 traducciones enlazadas a su par en inglés (6,267 del sitemap + 14 descubiertas)", () => {
    const pares = pages.filter((p) => p.en);
    expect(pares).toHaveLength(6281);
    expect(manifest.capas.docs.pares_en).toBe(6281);
    expect(manifest.capas.docs.pares_en_sitemap).toBe(6267);
    for (const p of pares) {
      expect(p.l).not.toBe("en");
      expect(byU.get(p.en!)?.l, `par en inglés ausente: ${p.u}`).toBe("en");
    }
  });

  it("918 páginas de API con firma de endpoint", () => {
    const api = pages.filter((p) => p.api);
    expect(api).toHaveLength(918);
    expect(manifest.capas.docs.api).toBe(918);
    for (const p of api) {
      expect(p.api!.m).toMatch(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/);
      expect(p.api!.path.startsWith("/")).toBe(true);
      expect(p.api!.op.length).toBeGreaterThan(0);
    }
  });
});

const fileOfCache = new Map<string, string>();
for (const p of manifest.particiones) for (const f of p.files) for (const pg of read<AtlasPartitionFile>(path.join(ATLAS, f)).pages) fileOfCache.set(pg.u, f);
function fileOf(p: AtlasPage): string {
  return fileOfCache.get(p.u)!;
}

describe("Atlas · imágenes (datos de CA-49)", () => {
  it("toda imagen es de www.palantir.com o build.palantir.com y los 5 marcadores no están", () => {
    let n = 0;
    for (const p of pages) {
      for (const [src, alt] of p.i) {
        n++;
        expect(ATLAS_IMAGE_PREFIXES.some((x) => src.startsWith(x)), `imagen fuera de palantir.com: ${src}`).toBe(true);
        if (alt !== null) expect(alt.split(/\s+/).length).toBeLessThanOrEqual(30);
      }
    }
    expect(n).toBe(manifest.capas.docs.imagenes);
    expect(manifest.capas.docs.imagenes_fuera).toBe(5);
    for (const f of walk(ATLAS)) {
      const t = fs.readFileSync(f, "utf8");
      expect(t.includes("<FOUNDRY_URL>") || t.includes("mydomain.palantir.com"), `un marcador de ejemplo está en ${rel(f)}`).toBe(false);
    }
  });
});

describe("Atlas · videos (datos de CA-53)", () => {
  it("todo video de las páginas está en el catálogo y el catálogo no versiona metadatos de YouTube", () => {
    const v = read<AtlasVideoCatalog>(path.join(DATA, "videos.json"));
    const ids = new Set(v.youtube.map((y) => y.id));
    for (const p of pages) {
      for (const [tipo, id] of p.vd) {
        expect(tipo).toBe("youtube");
        expect(ids.has(id), `video ${id} de ${p.u} fuera del catálogo`).toBe(true);
        expect(v.youtube.find((y) => y.id === id)!.paginas).toContain(p.u);
      }
    }
    for (const y of v.youtube) {
      expect(Object.keys(y).sort()).toEqual(["fuentes", "id", "maestro", "paginas"]);
      expect(y.id).toMatch(/^[A-Za-z0-9_-]{11}$/);
    }
    for (const m of v.vimeo) expect(m.id).toMatch(/^\d{6,12}$/);
  });
});

describe("Atlas · esquema y tamaños (CA-55 sobre los datos versionados)", () => {
  it("ningún archivo pasa de 2 MiB y ninguno trae prosa", () => {
    for (const f of walk(ATLAS)) {
      expect(fs.statSync(f).size, `${rel(f)} pasa de 2 MiB`).toBeLessThanOrEqual(ATLAS_MAX_FILE_BYTES);
    }
    for (const f of walk(ATLAS)) {
      const keys = new Set<string>();
      const visit = (x: unknown) => {
        if (Array.isArray(x)) x.forEach(visit);
        else if (x && typeof x === "object") for (const [k, y] of Object.entries(x)) (keys.add(k), visit(y));
      };
      visit(JSON.parse(fs.readFileSync(f, "utf8")));
      for (const k of FORBIDDEN_KEYS) expect(keys.has(k), `el Atlas contiene prosa: la clave ${k} en ${rel(f)}`).toBe(false);
    }
  });

  it("cada archivo listado existe, su nombre lleva su sha256[:10] y no hay huérfanos", () => {
    const listed = new Set<string>([
      ...manifest.particiones.flatMap((p) => p.files),
      ...manifest.indices.flatMap((i) => i.files),
      manifest.alias,
      manifest.capas.build.archivo,
      manifest.capas.videos.archivo,
      manifest.capas.inventario.archivo,
      manifest.capas.celdas.archivo,
    ]);
    for (const f of listed) {
      const buf = fs.readFileSync(path.join(ATLAS, f));
      const sha = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 10);
      expect(f.endsWith(`.${sha}.json`), `el nombre de ${f} no lleva su sha256[:10] (${sha})`).toBe(true);
    }
    const present = walk(ATLAS).map(rel).filter((f) => f !== "manifest.json" && !f.startsWith("videos/"));
    expect(present.filter((f) => !listed.has(f)), "archivo del Atlas que el manifiesto no lista").toEqual([]);
  });

  it("el índice de cada idioma cubre sus páginas y apunta al archivo que las contiene", () => {
    for (const idx of manifest.indices) {
      let rows = 0;
      for (const f of idx.files) {
        const file = read<AtlasIndexFile>(path.join(ATLAS, f));
        expect(file.lang).toBe(idx.lang);
        for (const row of file.rows) {
          rows++;
          const u = row[0] === "" ? "https://www.palantir.com/docs" : `https://www.palantir.com/docs/${row[0]}`;
          expect(byU.has(u), `fila del índice sin página: ${u}`).toBe(true);
          expect(fileOf(byU.get(u)!)).toBe(row[1]);
          expect(row[4].startsWith(" ") && row[4].endsWith(" ")).toBe(true);
        }
      }
      expect(rows).toBe(manifest.capas.docs.por_idioma[idx.lang]);
    }
  });

  it("la lista del visor trae las 12,019 canónicas y los 123 alias, sin learn ni certification", () => {
    const urls = read<string[]>(path.join(DATA, "atlas-docs-urls.json"));
    expect(urls).toHaveLength(12019 + 123);
    expect(new Set(urls).size).toBe(urls.length);
    expect([...urls].sort()).toEqual(urls);
    for (const u of urls) {
      expect(canonicalDocsUrl(u), `URL no canónica en la lista del visor: ${u}`).toBe(u);
      expect(/learn\.palantir\.com|certification\.palantir\.com/.test(u)).toBe(false);
    }
    const set = new Set(urls);
    expect(pages.filter((p) => !set.has(p.u)).map((p) => p.u), "página del Atlas fuera de la lista del visor").toEqual([]);
  });
});
