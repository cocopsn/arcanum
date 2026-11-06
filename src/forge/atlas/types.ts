// Esquema v1 de los datos del Atlas en `public/atlas/v1/` (design §11.2). Contrato congelado de la
// Fase 0: lo escribe `scripts/forge/atlas-build.mjs` y lo consumen el árbol, la búsqueda, la entrada y
// el visor. Sólo metadatos bibliográficos (S3): ningún archivo trae cuerpos, `meta_description`,
// subtítulos ni descripciones. Este módulo no importa ningún JSON del Atlas, así que puede entrar al
// chunk de página sin arrastrar datos.

export const ATLAS_VERSION = 1 as const;
/** Ruta pública de los datos (todos los archivos llevan `sha256[:10]` en el nombre salvo `manifest.json`). */
export const ATLAS_BASE = "/atlas/v1" as const;
export const ATLAS_MANIFEST_PATH = "/atlas/v1/manifest.json" as const;
/** Archivos con reglas propias de caché (§6.5, §6.6); se generan en el build y no se versionan. */
export const ATLAS_FIXED_PATHS = [
  "/atlas/v1/manifest.json",
  "/atlas/v1/videos/oembed.json",
  "/atlas/v1/videos/canales.json",
] as const;
/** Ningún archivo del Atlas pasa de 2 MiB (RD-6). */
export const ATLAS_MAX_FILE_BYTES = 2 * 1024 * 1024;
/** Orígenes exactos de las imágenes que el Atlas conserva (§11.2, §11.5). */
export const ATLAS_IMAGE_PREFIXES = ["https://www.palantir.com/", "https://build.palantir.com/"] as const;

export type AtlasLang = "en" | "jp" | "zh" | "kr";
export const ATLAS_LANGS: readonly AtlasLang[] = ["en", "jp", "zh", "kr"];

/** `[nivel, texto, ancla]`; el ancla es el `id` del encabezado en la página fuente. */
export type AtlasHeading = [nivel: number, texto: string, ancla: string];
/** `[src, alt | null]`: `alt` es `null` si la fuente no lo publica o pasa de 30 palabras. */
export type AtlasImage = [src: string, alt: string | null, w?: number, h?: number];
/** Video citado por la página: sólo ids de YouTube (docs) o de Vimeo (build). */
export type AtlasVideoRef = [tipo: "youtube" | "vimeo", id: string];
/** Firma de endpoint de las páginas de API (918). */
export interface AtlasApiSignature {
  m: string;
  path: string;
  op: string;
  scopes: string[];
}
/**
 * `[código, base]` del mapeo tentativo del barrido. `código` es una celda (`P2-06`) o una ruta
 * (`P4`) cuando la base es de grupo. Sólo `cita_directa` es «asignada por la ficha»; el resto es
 * «relacionada, sin revisar» (RF-A4).
 */
export type AtlasCellLink = [codigo: string, base: string];

export interface AtlasPage {
  /** Ruta canónica: la ruta de `u` sin el prefijo `/docs/` (`foundry/ontology/overview`). */
  k: string;
  /** URL canónica, única en todo el Atlas: `https://www.palantir.com/docs/...`, sin barra final. */
  u: string;
  /** Título publicado. */
  t: string;
  /** Migas de pan. */
  b: string[];
  /** Producto, capacidad y sección. */
  p: string;
  c: string;
  s: string;
  l: AtlasLang;
  h: AtlasHeading[];
  i: AtlasImage[];
  vd: AtlasVideoRef[];
  api?: AtlasApiSignature;
  /** URL canónica del par en inglés, si está en el Atlas. */
  en?: string;
  /** `Last-Modified` HTTP en ISO 8601 (el `lastmod` del sitemap no es la fecha de la página). */
  lm: string | null;
  cells: AtlasCellLink[];
}

export interface AtlasPartitionFile {
  v: 1;
  /** `<idioma>/<producto>/<capacidad>`; la capacidad «(index)» va como `_index_`. */
  id: string;
  /** Parte (desde 0) cuando la partición se partió por pasar de 2 MiB; ausente si no se partió. */
  part?: number;
  pages: AtlasPage[];
}

/**
 * Fila del índice de búsqueda por idioma:
 * `[k, archivo de partición, título, migas, tokens, encabezados [ancla, texto], p, c, s, códigos]`.
 * `tokens` es `" " + normalizeAtlasText([título, ...migas, ...textos de encabezado, p, c, s].join(" "))
 * partido por espacios + " "`: nunca sale del cuerpo ni de `meta_description` (CA-55).
 * `archivo de partición` es la ruta relativa a `/atlas/v1/` del archivo que contiene la página.
 */
export type AtlasIndexRow = [
  k: string,
  archivo: string,
  titulo: string,
  migas: string[],
  tokens: string,
  encabezados: [ancla: string, texto: string][],
  p: string,
  c: string,
  s: string,
  codigos: string[],
];

export interface AtlasIndexFile {
  v: 1;
  lang: AtlasLang;
  /** Parte (desde 0). */
  n: number;
  rows: AtlasIndexRow[];
}

/** `[alias, canónica, origen]`. `origen` dice si el alias salió de un enlace descubierto o del sitemap. */
export type AtlasAlias = [alias: string, canonica: string, origen: "descubierta" | "sitemap"];
export interface AtlasAliasFile {
  v: 1;
  alias: AtlasAlias[];
}

export interface AtlasBuildExample {
  /** URL del ejemplo publicado en build.palantir.com. */
  u: string;
  t: string;
  /** `CONTENT_TYPE` publicado (puede venir vacío). */
  tipos: string[];
  /** Modo de instalación publicado (`bootstrap`, `production`). */
  instalacion: string[];
  portada: boolean;
  /** Páginas del Atlas que el ejemplo enlaza, ya canónicas. */
  docs: string[];
  /** Ids de Vimeo del recorrido en video. */
  vimeo: string[];
  /** Imágenes de `https://build.palantir.com/`, sin repetir. */
  i: string[];
}
export interface AtlasBuildFile {
  v: 1;
  ejemplos: AtlasBuildExample[];
}

export interface AtlasYoutubeEntry {
  id: string;
  /** Dónde se citó (fuentes permitidas, D1): páginas de docs, el maestro o build. */
  fuentes: ("build" | "docs" | "maestro")[];
  /** URLs canónicas del Atlas que citan el video. */
  paginas: string[];
  /** Secciones del maestro que lo citan (`§12`). */
  maestro: string[];
}
export interface AtlasVimeoEntry {
  id: string;
  /** Entrada de build (bundle público) que trae el recorrido; su título es la etiqueta del video. */
  build: string;
  /** `false` si la página de esa entrada responde «Page not found» (los 6 recorridos están así). */
  publicada: boolean;
  etiqueta: string;
}
export interface AtlasChannel {
  id: string;
  url: string;
  etiqueta: string;
}
/**
 * Catálogo de videos sin metadatos de terceros (`src/forge/data/videos.json` y `videos.<sha>.json`):
 * título y canal de YouTube sólo llegan por oEmbed en el build (`videos/oembed.json`, §11.6).
 */
export interface AtlasVideoCatalog {
  v: 1;
  youtube: AtlasYoutubeEntry[];
  vimeo: AtlasVimeoEntry[];
  canales: AtlasChannel[];
}

/** `[número, url, host, estado, lote, título]` del §21 del maestro (sin las credenciales personales). */
export type AtlasInventoryEntry = [n: number, url: string, host: string, estado: string, lote: string, titulo: string];
export interface AtlasInventoryFile {
  v: 1;
  entradas: AtlasInventoryEntry[];
}

export interface AtlasCellEntry {
  codigo: string;
  /** Código de la ruta (`P2`, `D`, `X`, `SD`). */
  ruta: string;
  /** Páginas citadas por la ficha (`cita_directa`), canónicas. */
  directas: string[];
  /** Páginas en inglés por base del mapeo (vacío si la celda no está en el mapeo del barrido). */
  por_base: Record<string, number>;
}
export interface AtlasCellsFile {
  v: 1;
  celdas: AtlasCellEntry[];
}

export interface AtlasPartitionRef {
  id: string;
  /** Archivos relativos a `/atlas/v1/`; más de uno si la partición se partió. */
  files: string[];
  bytes: number;
  /** Páginas distintas (con `u` única). */
  pages: number;
  /** Entradas del sitemap en la partición (la tabla de particiones del barrido cuenta éstas). */
  sitemap: number;
}

export interface AtlasDocsLayer {
  /** Páginas distintas, con `u` única. */
  paginas: number;
  por_idioma: Record<AtlasLang, number>;
  /** URLs del sitemap + páginas descubiertas que el sitemap no lista. */
  urls_capturadas: number;
  urls_sitemap: number;
  urls_sitemap_por_idioma: Record<AtlasLang, number>;
  descubiertas_nuevas: number;
  /** URLs del sitemap que redirigen a otra página del sitemap: quedan como alias, no como páginas. */
  alias_sitemap: number;
  alias_descubiertos: number;
  alias: number;
  /** Enlaces descubiertos que terminan en `/docs/404`: fuera, sólo contados. */
  rotos: number;
  api: number;
  /** Traducciones enlazadas a su par en inglés (la URL publicada es una página del Atlas tal cual). */
  pares_en: number;
  /** De esas, las que son entradas del sitemap (las demás son páginas descubiertas). */
  pares_en_sitemap: number;
  imagenes: number;
  imagenes_unicas: number;
  /** Imágenes quitadas por no ser de `www.palantir.com` ni `build.palantir.com` (marcadores de ejemplo). */
  imagenes_fuera: number;
  imagenes_fuera_unicas: number;
  /** Textos alternativos de más de 30 palabras que quedaron en `null`. */
  alt_largos: number;
  /** Referencias a video en las páginas. */
  videos: number;
  /** Filas descubiertas de las particiones de la caché que redirigen a una página del sitemap. */
  filas_alias_en_particiones: number;
}

export interface AtlasManifest {
  v: 1;
  capturado: string;
  /** `sha256[:10]` del manifiesto de `derived/` del que salió esta versión. */
  fuente_sha10: string;
  capas: {
    docs: AtlasDocsLayer;
    build: { publicadas: number; no_encontradas: number; con_video: number; archivo: string };
    videos: { youtube: number; youtube_docs: number; youtube_maestro: number; vimeo: number; canales: number; archivo: string };
    inventario: { entradas: number; publicadas: number; credenciales_contadas: number; archivo: string };
    catalogo: { claves: number; cursos: number; paginas_con_clave: number };
    celdas: { total: number; con_paginas: number; archivo: string };
  };
  /** idioma → producto → capacidad → sección → páginas distintas. */
  arbol: Record<string, Record<string, Record<string, Record<string, number>>>>;
  particiones: AtlasPartitionRef[];
  indices: { lang: AtlasLang; files: string[]; bytes: number; rows: number }[];
  alias: string;
  /** Páginas distintas en inglés por sección guiada (campo `section`, C6). */
  secciones_guiadas: Record<string, number>;
  /** Enlaces de learn y certification que aparecen en el maestro o en build: «Requiere cuenta» (RD-9). */
  requiere_cuenta: string[];
}

const CJK: ReadonlySet<string> = new Set(["jp", "zh", "kr"]);

/**
 * Normalización de búsqueda por idioma (§11.3): en `en` (y códigos), NFKC + minúsculas + NFD sin
 * marcas diacríticas; en `jp`, `zh` y `kr`, sólo NFKC + minúsculas (quitar marcas rompería kana con
 * dakuten). `atlas-build.mjs` aplica la misma función a los tokens; la búsqueda la aplica a la consulta.
 */
export function normalizeAtlasText(text: string, lang: string): string {
  const base = text.normalize("NFKC").toLowerCase();
  return CJK.has(lang) ? base : base.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Tokens de una página, exactamente como los guarda el índice (con espacio al inicio y al final). */
export function atlasTokens(page: Pick<AtlasPage, "t" | "b" | "h" | "p" | "c" | "s" | "l">): string {
  const raw = [page.t, ...page.b, ...page.h.map((x) => x[1]), page.p, page.c, page.s].join(" ");
  const parts = normalizeAtlasText(raw, page.l).split(/\s+/).filter(Boolean);
  return " " + parts.join(" ") + " ";
}

/**
 * Forma canónica de una URL de docs: `https://www.palantir.com/docs/...`, sin consulta, sin fragmento,
 * sin `/index.html` y sin barra final. `null` si no es https, no es `www.palantir.com` ni
 * `palantir.com` o su ruta no empieza con `/docs`. Las listas del Atlas guardan esta forma.
 */
export function canonicalDocsUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.hostname !== "www.palantir.com" && url.hostname !== "palantir.com") return null;
  let p = url.pathname.replace(/\/index\.html$/, "").replace(/\/+$/, "");
  if (p !== "/docs" && !p.startsWith("/docs/")) return null;
  return "https://www.palantir.com" + p;
}
