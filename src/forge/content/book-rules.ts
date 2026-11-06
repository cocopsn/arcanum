import type { BookSection, ParsedBook } from "@/lib/book";

// BOOK RULES of Engineering Forge (design §6.2, §13.1, §18.2), as PURE functions. Every list (allowed URLs, video
// ids, Atlas images, existing book handles) arrives BY PARAMETER: this module imports no JSON of the Atlas, so none
// of that reaches the client. books.test.ts applies them to content/forge/books/*.md; the reader (p-plataforma)
// reuses the video and figure recognizers.

export const PRODUCT_NAMES = [
  "Foundry",
  "AIP",
  "Apollo",
  "Gotham",
  "Ontology",
  "OSDK",
  "Workshop",
  "Pipeline Builder",
  "AIP Logic",
  "Code Repositories",
  "Quiver",
  "Contour",
] as const;

/** The ## sections every Forge book has (normalized titles), besides ≥ 1 explanation section. */
export const MARKER_SECTIONS = ["ejemplo trabajado", "contraejemplo", "diagrama"] as const;

export const YOUTUBE_WATCH_RE = /^https:\/\/(?:www\.)?youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})$/;
export const YOUTUBE_SHORT_RE = /^https:\/\/youtu\.be\/([A-Za-z0-9_-]{11})$/;
export const LIBRO_LINK_RE = /^#libro:([A-Za-z0-9][A-Za-z0-9._-]*)$/;

const stripAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export const normTitle = (s: string) => stripAccents(s.toLowerCase()).trim().replace(/\s+/g, " ");

/** The 11-character YouTube id of a URL in one of the two accepted forms (no extra parameters), or null. */
export function youtubeIdOf(url: string): string | null {
  const m = url.match(YOUTUBE_WATCH_RE) ?? url.match(YOUTUBE_SHORT_RE);
  return m ? m[1]! : null;
}

/** https, host www.palantir.com, path under /docs/ (the client never loads the Atlas list). */
export function isDocsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "www.palantir.com" && u.pathname.startsWith("/docs/");
  } catch {
    return false;
  }
}

/** The handle of a `#libro:<handle>` link, or null. */
export function libroHandleOf(href: string): string | null {
  const m = href.match(LIBRO_LINK_RE);
  return m ? m[1]! : null;
}

export interface MdLink {
  text: string;
  url: string;
  title: string | null;
  image: boolean;
}

/** Markdown inline links and images outside code fences: [text](url "title") / ![alt](src "title"). */
export function markdownLinks(md: string): MdLink[] {
  const out: MdLink[] = [];
  let inFence = false;
  const re = /(!?)\[([^\]]*)\]\(\s*<?([^\s)>]+)>?(?:\s+"([^"]*)")?\s*\)/g;
  for (const line of md.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    for (const m of line.matchAll(re)) out.push({ image: m[1] === "!", text: m[2] ?? "", url: m[3] ?? "", title: m[4] ?? null });
  }
  return out;
}

/** Paragraphs (blank-line separated, outside fences) made of exactly one link or image and nothing else. */
function singleLinkParagraphs(md: string): MdLink[] {
  const paras: string[] = [];
  let cur: string[] = [];
  let inFence = false;
  for (const line of md.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence || /^\s*(```|~~~)/.test(line)) {
      if (cur.length) paras.push(cur.join(" "));
      cur = [];
      continue;
    }
    if (!line.trim()) {
      if (cur.length) paras.push(cur.join(" "));
      cur = [];
    } else cur.push(line.trim());
  }
  if (cur.length) paras.push(cur.join(" "));
  const out: MdLink[] = [];
  for (const p of paras) {
    const m = p.match(/^(!?)\[([^\]]*)\]\(\s*<?([^\s)>]+)>?(?:\s+"([^"]*)")?\s*\)$/);
    if (m) out.push({ image: m[1] === "!", text: m[2] ?? "", url: m[3] ?? "", title: m[4] ?? null });
  }
  return out;
}

/** Video paragraphs (§13.1): a paragraph with ONLY a link whose title is exactly "video". */
export function videoParagraphs(md: string): MdLink[] {
  return singleLinkParagraphs(md).filter((l) => !l.image && l.title === "video");
}

/** Figure paragraphs (§13.1): a paragraph with ONLY an image whose title is "figura <docs page URL>". */
export function figureParagraphs(md: string): (MdLink & { page: string })[] {
  return singleLinkParagraphs(md)
    .filter((l) => l.image && l.title !== null && l.title.startsWith("figura "))
    .map((l) => ({ ...l, page: l.title!.slice("figura ".length).trim() }));
}

/** Explanation sections: `core` sections whose title is none of the three marker sections (§18.2). */
export function explanationSections(book: ParsedBook): BookSection[] {
  return book.sections.filter((s) => s.kind === "core" && !(MARKER_SECTIONS as readonly string[]).includes(normTitle(s.title)));
}

/** Structure (§18.2): the three marker sections (Diagrama with a `text` fence), connections, questions, sources and
 *  at least one explanation section. Returns the problems (empty = ok). */
export function checkBookStructure(book: ParsedBook): string[] {
  const out: string[] = [];
  const titles = book.sections.map((s) => normTitle(s.title));
  for (const t of MARKER_SECTIONS) if (!titles.includes(t)) out.push(`falta la sección «${t}»`);
  const diagrama = book.sections.find((s) => normTitle(s.title) === "diagrama");
  if (diagrama && !/^\s*(```|~~~)\s*text\s*$/m.test(diagrama.markdown)) out.push("la sección «Diagrama» no trae una cerca text");
  for (const k of ["connections", "questions", "sources"] as const) if (!book.sections.some((s) => s.kind === k)) out.push(`falta la sección de tipo ${k}`);
  if (explanationSections(book).length === 0) out.push("falta al menos una sección de explicación");
  return out;
}

const withoutFragment = (url: string) => url.split("#")[0]!;

/** The allowed-link set (§18.2): maestro + catalog + Atlas URLs (minus broken), and both YouTube forms per id. */
export function allowedLinkSet(parts: { urls?: Iterable<string>; videoIds?: Iterable<string> }): Set<string> {
  const out = new Set<string>();
  for (const u of parts.urls ?? []) out.add(withoutFragment(u));
  for (const id of parts.videoIds ?? []) {
    out.add(`https://www.youtube.com/watch?v=${id}`);
    out.add(`https://youtu.be/${id}`);
  }
  return out;
}

const isAllowed = (url: string, allowed: ReadonlySet<string>) => allowed.has(withoutFragment(url));

/** Link rules (§18.2, CA-27, RF-L4): every explanation section has ≥ 1 allowed link, and every section that names a
 *  product of PRODUCT_NAMES has ≥ 1 allowed link. */
export function checkBookLinks(book: ParsedBook, allowed: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const explanation = new Set(explanationSections(book).map((s) => s.id));
  for (const s of book.sections) {
    const links = markdownLinks(s.markdown).filter((l) => !l.image && isAllowed(l.url, allowed));
    if (explanation.has(s.id) && links.length === 0) out.push(`la sección de explicación «${s.title}» no tiene ningún enlace de la lista permitida`);
    const product = PRODUCT_NAMES.find((p) => new RegExp(`\\b${p.replace(/ /g, "\\s+")}\\b`).test(s.markdown));
    if (product && links.length === 0 && !explanation.has(s.id)) out.push(`la sección «${s.title}» nombra ${product} sin un enlace de la lista permitida`);
  }
  return out;
}

/** Video rules (§13.1): the id must come from one of the two exact forms and be in the catalog of video ids. */
export function checkBookVideos(md: string, videoIds: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const v of videoParagraphs(md)) {
    const id = youtubeIdOf(v.url);
    if (!id) out.push(`el video «${v.text}» no usa youtube.com/watch?v=<id> ni youtu.be/<id> sin parámetros`);
    else if (!videoIds.has(id)) out.push(`el video «${v.text}» (${id}) no está en videos.json`);
  }
  return out;
}

/** Figure rules (§13.1): docs page, src among the Atlas images of that page (none invented), alt ≤ 30 words.
 *  `imagesOf(page)` returns the images of a page, or null when the page is not in the Atlas. */
export function checkBookFigures(md: string, imagesOf: (page: string) => readonly string[] | null): string[] {
  const out: string[] = [];
  for (const f of figureParagraphs(md)) {
    if (!isDocsUrl(f.page)) out.push(`la figura «${f.text}» no apunta a una página de palantir.com/docs`);
    const imgs = imagesOf(f.page);
    if (imgs === null) out.push(`la figura «${f.text}» cita una página que no está en el Atlas`);
    else if (!imgs.includes(f.url)) out.push(`la figura «${f.text}» usa una imagen que no está en esa página del Atlas`);
    if (f.text.trim().split(/\s+/).filter(Boolean).length > 30) out.push(`el alt de la figura «${f.text.slice(0, 40)}…» pasa de 30 palabras`);
  }
  return out;
}

/** `#libro:<handle>` links must resolve to an existing book handle. */
export function checkLibroLinks(md: string, handles: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const l of markdownLinks(md)) {
    const h = libroHandleOf(l.url);
    if (h && !handles.has(h)) out.push(`el enlace «${l.text}» apunta a #libro:${h}, que no existe`);
  }
  return out;
}

/** RF-L7: the book must not contain the text of any hidden fact of its interview. */
export function leakedHiddenFacts(md: string, hiddenTexts: readonly string[]): string[] {
  const body = md.toLowerCase();
  return hiddenTexts.filter((t) => t.trim().length > 0 && body.includes(t.toLowerCase()));
}
