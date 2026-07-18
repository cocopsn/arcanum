import type { ParsedBook } from "@/lib/book";

// AUDIOBOOK PREPROCESSING (pure) — turn a parsed mini-book into an ORDERED list of SPEAKABLE items for the
// Web Speech API. Reading technical markdown LITERALLY is useless: a code block read character by character,
// or "asterisk asterisk", is torture. So this layer: (1) NEVER reads a code block literally — it announces
// it briefly ("bloque de código en Python, N líneas") or skips it silently, per config; (2) strips markdown
// syntax and reads the words, not the symbols; (3) normalizes inline notation to something pronounceable
// (O(n log n) → "O de n log n"); (4) collapses tables to a short mention. Each item is tied to its section id
// so the player can highlight + scroll to what it's reading. PURE + deterministic — no clock, no I/O, no DOM.

export type SpeechCodeMode = "announce" | "skip";
export const INTRO_SECTION = "__intro__";

export interface SpeechItem {
  /** stable index-based id */
  id: string;
  /** the DOM section id to highlight/scroll to while this speaks (INTRO_SECTION = the header block) */
  sectionId: string;
  /** title = a heading (intoned higher), body = prose, note = the brief code/table announce */
  kind: "title" | "body" | "note";
  /** the FINAL speakable text — already preprocessed (no markdown, no literal code) */
  text: string;
}

// ── inline notation → pronounceable Spanish ───────────────────────────────────────────────────────
export function normalizeNotation(s: string): string {
  return s
    .replace(/\bO\s*\(([^)]+)\)/g, (_m, inner: string) => `O de ${inner}`) // big-O
    .replace(/\bΘ\s*\(([^)]+)\)/g, (_m, inner: string) => `Theta de ${inner}`)
    .replace(/\bΩ\s*\(([^)]+)\)/g, (_m, inner: string) => `Omega de ${inner}`)
    .replace(/([A-Za-z0-9])²/g, "$1 al cuadrado")
    .replace(/([A-Za-z0-9])³/g, "$1 al cubo")
    .replace(/([A-Za-z0-9])\s*\^\s*(\d+)/g, "$1 a la $2")
    .replace(/log₂/g, "logaritmo base 2")
    .replace(/→/g, " lleva a ")
    .replace(/≈/g, " aproximadamente ")
    .replace(/≤/g, " menor o igual que ")
    .replace(/≥/g, " mayor o igual que ")
    .replace(/≠/g, " distinto de ")
    .replace(/×/g, " por ")
    .replace(/·/g, " ")
    .replace(/&/g, " y ");
}

// ── strip markdown, keep the words ────────────────────────────────────────────────────────────────
export function stripMarkdown(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images → nothing
    .replace(/\[\[(?:[^\]|]+\|)?([^\]|]+)\]\]/g, "$1") // [[wikilink]] → wikilink, [[target|alias]] → alias (visible text)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // [text](url) → text
    .replace(/`([^`]+)`/g, "$1") // `inline code` → its content (normalized downstream)
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // heading markers
    .replace(/^\s{0,3}>\s?/gm, "") // blockquote
    .replace(/^\s{0,3}[-*+]\s+/gm, "") // unordered list bullet
    .replace(/^\s{0,3}\d+[.)]\s+/gm, "") // ordered list marker
    .replace(/(\*\*|__)(.+?)\1/g, "$2") // bold
    .replace(/(\*|_)(.+?)\1/g, "$2") // italic
    .replace(/~~(.+?)~~/g, "$2") // strikethrough
    .replace(/\|/g, " "); // stray table pipes
}

function clean(raw: string): string {
  return normalizeNotation(stripMarkdown(raw)).replace(/\s+/g, " ").trim();
}

function announceCode(lang: string, lines: number): string {
  const names: Record<string, string> = {
    js: "JavaScript", javascript: "JavaScript", ts: "TypeScript", typescript: "TypeScript",
    py: "Python", python: "Python", bash: "shell", sh: "shell", toml: "configuración",
    json: "JSON", yaml: "YAML", c: "C", cpp: "C++", rust: "Rust", go: "Go", sql: "SQL",
  };
  const name = names[lang.trim().toLowerCase()] ?? lang.trim();
  const which = name ? ` en ${name}` : "";
  return `Bloque de código${which}, ${lines} línea${lines === 1 ? "" : "s"}. Se omite en el audio.`;
}

type Chunk =
  | { type: "prose"; text: string }
  | { type: "code"; lang: string; lines: number }
  | { type: "table"; rows: number };

/** fence-aware split of a section body into prose / code-fence / table chunks (a ```/~~~ fence is atomic). */
function chunkBody(md: string): Chunk[] {
  const lines = md.split(/\r?\n/);
  const out: Chunk[] = [];
  let prose: string[] = [];
  const flushProse = () => {
    if (prose.join("\n").trim()) out.push(...splitTables(prose.join("\n")));
    prose = [];
  };
  let i = 0;
  while (i < lines.length) {
    const l = lines[i]!;
    const fence = l.match(/^\s*(```|~~~)\s*([A-Za-z0-9_+-]*)/);
    if (fence) {
      flushProse();
      const marker = fence[1]!;
      const lang = fence[2] ?? "";
      let n = 0;
      i++;
      const close = new RegExp(`^\\s*${marker}`);
      while (i < lines.length && !close.test(lines[i]!)) {
        n++;
        i++;
      }
      i++; // consume the closing fence
      out.push({ type: "code", lang, lines: n });
      continue;
    }
    prose.push(l);
    i++;
  }
  flushProse();
  return out;
}

/** pull markdown tables out of a prose run → a "tabla de N filas" mention; the rest stays prose. */
function splitTables(prose: string): Chunk[] {
  const lines = prose.split(/\r?\n/);
  const out: Chunk[] = [];
  let buf: string[] = [];
  let tbl: string[] = [];
  const isRow = (l: string) => l.trim().startsWith("|") && (l.match(/\|/g) ?? []).length >= 2;
  const isSep = (l: string) => /^\s*\|?[\s:|-]+\|?\s*$/.test(l) && l.includes("-");
  const flushBuf = () => {
    if (buf.join("\n").trim()) out.push({ type: "prose", text: buf.join("\n") });
    buf = [];
  };
  const flushTbl = () => {
    // a real table = ≥2 rows with a separator; data rows = rows minus the header minus the separator
    if (tbl.length >= 2 && tbl.some(isSep)) {
      const rows = Math.max(0, tbl.filter((l) => !isSep(l)).length - 1);
      out.push({ type: "table", rows });
    } else {
      buf.push(...tbl); // not really a table → keep as prose
    }
    tbl = [];
  };
  for (const l of lines) {
    if (isRow(l)) {
      if (buf.length) flushBuf();
      tbl.push(l);
    } else {
      if (tbl.length) flushTbl();
      buf.push(l);
    }
  }
  if (tbl.length) flushTbl();
  flushBuf();
  return out;
}

export interface SpeechOpts {
  codeMode: SpeechCodeMode;
}

/** The whole book as an ordered, preprocessed, section-tagged speech script. */
export function bookToSpeech(parsed: ParsedBook, opts: SpeechOpts): SpeechItem[] {
  const items: SpeechItem[] = [];
  let n = 0;
  const push = (sectionId: string, kind: SpeechItem["kind"], raw: string) => {
    const text = kind === "note" ? raw.replace(/\s+/g, " ").trim() : clean(raw);
    if (text) items.push({ id: `u${n++}`, sectionId, kind, text });
  };
  const pushBody = (sectionId: string, md: string) => {
    for (const c of chunkBody(md)) {
      if (c.type === "code") {
        if (opts.codeMode === "announce") push(sectionId, "note", announceCode(c.lang, c.lines));
        // "skip" → say nothing (never literal)
      } else if (c.type === "table") {
        push(sectionId, "note", `Tabla de ${c.rows} fila${c.rows === 1 ? "" : "s"}. Se omite en el audio.`);
      } else {
        for (const para of c.text.split(/\n{2,}/)) push(sectionId, "body", para);
      }
    }
  };

  // intro (the reader's header block): title + subtitle, then the root question, then any lead prose
  push(INTRO_SECTION, "title", `${parsed.meta.title}.${parsed.meta.subtitle ? " " + parsed.meta.subtitle + "." : ""}`);
  if (parsed.rootQuestion) push(INTRO_SECTION, "body", `Pregunta raíz. ${parsed.rootQuestion}`);
  if (parsed.lead) pushBody(INTRO_SECTION, parsed.lead);

  // each section: its title (intoned) then its preprocessed body
  for (const s of parsed.sections) {
    push(s.id, "title", s.title);
    pushBody(s.id, s.markdown);
  }
  return items;
}
