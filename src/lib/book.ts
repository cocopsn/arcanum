// DEEP-READING books — ARCANUM ingests .md books generated EXTERNALLY (separate Sonnet instances),
// it does NOT generate them. This is the pure PARSER: YAML-frontmatter + markdown body → a structured
// book (meta + root question + sections + TOC). It is the CONTRACT: any .md that satisfies it can be
// read; anything that doesn't parses to null (honest "formato inválido", never faked). Pure, testable.

export interface BookMeta {
  /** module_id — anchors the book to a roadmap cell (null = a loose book, no cell) */
  moduleId: string | null;
  /** ITC | FrED | Competitiva | Aleman — drives the world tint (tolerant free string) */
  spine: string;
  title: string;
  subtitle: string;
  sourceCanonical: string;
  depth: string;
  structure: string;
  generatedBy: string;
  version: string;
  readingMinutes: number | null;
}

export type SectionKind = "prologue" | "core" | "connections" | "synthesis" | "questions" | "sources";

export interface BookSection {
  /** slug for the TOC anchor */
  id: string;
  /** the ## heading text */
  title: string;
  kind: SectionKind;
  /** the section body markdown (without its heading) */
  markdown: string;
}

export interface ParsedBook {
  meta: BookMeta;
  /** the leading > blockquote — the "pregunta raíz" */
  rootQuestion: string | null;
  /** prose before the first ## heading (minus the blockquote), or "" — NEVER dropped */
  lead: string;
  sections: BookSection[];
  toc: { id: string; title: string; kind: SectionKind }[];
  wordCount: number;
}

const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Deterministic FNV-1a hash → base36. Pure. Used as a stable fallback slug for non-Latin/degenerate
 *  titles so distinct titles never collide to the same id (which would silently overwrite a book). */
function hashStr(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function slugify(s: string): string {
  const base = stripAccents(s.toLowerCase()).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  // a heading with no Latin-alnum chars (CJK/Arabic/emoji) → a STABLE hash slug, not a shared "seccion"
  return base || "s-" + hashStr(s);
}

function kindOf(heading: string): SectionKind {
  const h = stripAccents(heading.toLowerCase());
  if (h.includes("prologo") || h.includes("prólogo")) return "prologue";
  if (h.includes("conexion")) return "connections";
  if (h.includes("sintesis")) return "synthesis";
  if (h.startsWith("preguntas") || h.includes("deberias poder responder")) return "questions";
  if (h.startsWith("fuentes") || h.includes("referencias")) return "sources";
  return "core";
}

/** Parse the flat YAML-ish frontmatter (key: value scalars). Tolerant: unknown keys ignored, missing
 *  keys default to "". Values may be quoted. */
function parseFrontmatter(fm: string): BookMeta {
  const get: Record<string, string> = {};
  for (const line of fm.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!m) continue;
    let v = m[2]!.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    get[m[1]!] = v;
  }
  const minutes = Number.parseInt(get.reading_minutes ?? "", 10);
  return {
    moduleId: get.module_id ? get.module_id : null,
    spine: get.spine ?? "",
    title: get.title ?? "",
    subtitle: get.subtitle ?? "",
    sourceCanonical: get.source_canonical ?? "",
    depth: get.depth ?? "",
    structure: get.structure ?? "",
    generatedBy: get.generated_by ?? "",
    version: get.version ?? "",
    readingMinutes: Number.isFinite(minutes) ? minutes : null,
  };
}

export function parseBook(md: string): ParsedBook | null {
  const fmMatch = md.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fmMatch) return null; // the contract requires frontmatter
  const meta = parseFrontmatter(fmMatch[1]!);
  if (!meta.title.trim()) return null; // a book must at least have a title
  const body = fmMatch[2] ?? "";

  const lines = body.split(/\r?\n/);
  let rootQuestion: string | null = null;
  const sections: BookSection[] = [];
  const seenIds = new Set<string>();
  let cur: { title: string; buf: string[] } | null = null;
  const preamble: string[] = [];
  let inFence = false; // ## / --- inside a code fence are NOT section boundaries

  const push = () => {
    if (!cur) return;
    let id = slugify(cur.title);
    for (let n = 2; seenIds.has(id); n++) id = `${slugify(cur.title)}-${n}`; // unique within the book
    seenIds.add(id);
    sections.push({ id, title: cur.title, kind: kindOf(cur.title), markdown: cur.buf.join("\n").trim() });
  };

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence; // toggle on a fence marker (the marker line is content)
    const h2 = !inFence ? line.match(/^##\s+(.*)$/) : null;
    if (h2) {
      push();
      cur = { title: h2[1]!.trim(), buf: [] };
    } else if (cur) {
      cur.buf.push(line);
    } else {
      preamble.push(line);
    }
  }
  push();

  // the root question = the leading blockquote before the first ##
  const bq = preamble.filter((l) => l.trim().startsWith(">")).map((l) => l.replace(/^\s*>\s?/, "")).join(" ").trim();
  if (bq) rootQuestion = bq;
  // any OTHER pre-## prose (or the whole body of a headingless book) is preserved as the lead — never dropped
  const lead = preamble.filter((l) => !l.trim().startsWith(">")).join("\n").trim();

  const wordCount = body.replace(/```[\s\S]*?```/g, " ").split(/\s+/).filter(Boolean).length;

  return {
    meta,
    rootQuestion,
    lead,
    sections,
    toc: sections.map((s) => ({ id: s.id, title: s.title, kind: s.kind })),
    wordCount,
  };
}
