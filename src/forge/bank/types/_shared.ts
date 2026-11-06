import type { Lang, TestCase } from "@/lib/exercise";

// Shared, PURE helpers for the schema parsers of the 16 Forge exercise types (design §9.2, §9.3). They only read
// the block's structure (sections, fences, JSON, lists); nothing here executes code. The parsers are eager and
// synchronous because parseExercisesMd is synchronous; the ingestion checks (which may run code) are lazy and
// live in src/forge/bank/check/*. This file does not import exercises-md.ts, so there is no import cycle.

export interface ForgeSection {
  heading: string;
  /** normalized heading: lowercase, no accents, single spaces */
  key: string;
  body: string[];
}

export interface ForgeBlock {
  title: string;
  /** recognized preamble lines of this type (normalized key → trimmed raw value) */
  lines: Record<string, string>;
  sections: ForgeSection[];
}

export type SchemaResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
export const okData = <T>(data: T): { ok: true; data: T } => ({ ok: true, data });

export const stripAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export const norm = (s: string) => stripAccents(s.toLowerCase()).trim().replace(/\s+/g, " ");

/** The `id:` line contract (§9.2): unique in the bank, stable between edits. */
export const ITEM_ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;

export const FENCE_RE = /^\s*(```|~~~)/;

export function getSection(block: ForgeBlock, ...keys: string[]): ForgeSection | null {
  return block.sections.find((s) => keys.includes(s.key)) ?? null;
}

/** All sections with that key (to detect duplicated sections). */
export function countSections(block: ForgeBlock, key: string): number {
  return block.sections.filter((s) => s.key === key).length;
}

/** The section's prose, trimmed (fences included verbatim). */
export function sectionText(sec: ForgeSection | null): string {
  return sec ? sec.body.join("\n").trim() : "";
}

/** Fenced code blocks of a body, in order, with their (lowercased) info string. */
export function fences(lines: string[]): { lang: string; code: string }[] {
  const out: { lang: string; code: string[] }[] = [];
  let cur: { lang: string; code: string[] } | null = null;
  for (const line of lines) {
    const m = line.match(/^\s*(?:```|~~~)\s*([A-Za-z0-9_+-]*)\s*$/);
    if (m) {
      if (cur) {
        out.push(cur);
        cur = null;
      } else {
        cur = { lang: (m[1] ?? "").toLowerCase(), code: [] };
      }
    } else if (cur) {
      cur.code.push(line);
    }
  }
  return out.map((f) => ({ lang: f.lang, code: f.code.join("\n") }));
}

export function normLang(tag: string): Lang | null {
  const t = norm(tag);
  if (t === "js" || t === "javascript" || t === "node") return "js";
  if (t === "py" || t === "python") return "python";
  return null;
}

/** The first fence whose language is one of `langs`; null if none or empty. */
export function codeFence(sec: ForgeSection | null, langs: string[]): string | null {
  if (!sec) return null;
  const f = fences(sec.body).find((x) => langs.includes(x.lang));
  return f && f.code.trim() ? f.code : null;
}

/** All fences of a section whose language is one of `langs`. */
export function codeFences(sec: ForgeSection | null, langs: string[]): string[] {
  if (!sec) return [];
  return fences(sec.body)
    .filter((x) => langs.includes(x.lang))
    .map((x) => x.code);
}

/** Fences keyed by runtime language (javascript/js → js, python/py → python); first one wins. */
export function fencesByLang(sec: ForgeSection | null): Partial<Record<Lang, string>> {
  const out: Partial<Record<Lang, string>> = {};
  if (!sec) return out;
  for (const f of fences(sec.body)) {
    const l = normLang(f.lang);
    if (l && out[l] === undefined && f.code.trim()) out[l] = f.code;
  }
  return out;
}

const NO_JSON = Symbol("no-json");
/** Parse the first ```json fence of a section. Returns NO_JSON_VALUE when it is missing or invalid. */
export function jsonFence(sec: ForgeSection | null): unknown {
  if (!sec) return NO_JSON;
  const f = fences(sec.body).find((x) => x.lang === "json");
  if (!f) return NO_JSON;
  try {
    return JSON.parse(f.code);
  } catch {
    return NO_JSON;
  }
}
export const isNoJson = (v: unknown): v is typeof NO_JSON => v === NO_JSON;

/** Bullet list items (`- `, `* `, `+ `). */
export function listItems(lines: string[]): string[] {
  return lines
    .map((l) => l.trim())
    .filter((l) => /^[-*+]\s+/.test(l))
    .map((l) => l.replace(/^[-*+]\s+/, "").trim())
    .filter(Boolean);
}

/** Numbered list items (`1. texto` or `1) texto`), in document order, with their number. */
export function numberedItems(lines: string[]): { n: number; text: string }[] {
  const out: { n: number; text: string }[] = [];
  for (const raw of lines) {
    const m = raw.trim().match(/^(\d+)[.)]\s+(.*)$/);
    if (m && m[2]!.trim()) out.push({ n: parseInt(m[1]!, 10), text: m[2]!.trim() });
  }
  return out;
}

/** A rubric: its bullet items, or the whole prose as one criterion. Empty → []. */
export function rubricOf(sec: ForgeSection | null): string[] {
  if (!sec) return [];
  const items = listItems(sec.body);
  if (items.length) return items;
  const t = sectionText(sec);
  return t ? [t] : [];
}

export function deriveFunctionName(code: string, lang: Lang): string | null {
  if (lang === "python") {
    const m = code.match(/def\s+([A-Za-z_]\w*)\s*\(/);
    return m ? m[1]! : null;
  }
  const fn = code.match(/function\s+([A-Za-z_$][\w$]*)\s*\(/);
  if (fn) return fn[1]!;
  const asgn = code.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/);
  return asgn ? asgn[1]! : null;
}

/** Test cases in the `code` contract: a JSON array of { input: [...], expected, name?, hint? }, ≥ 1. */
export function testCasesOf(sec: ForgeSection | null): TestCase[] | null {
  const arr = jsonFence(sec);
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const cases: TestCase[] = [];
  for (const raw of arr) {
    if (!isObj(raw)) return null;
    if (!Array.isArray(raw.input) || !("expected" in raw)) return null;
    const tc: TestCase = { input: raw.input as unknown[], expected: raw.expected };
    if (typeof raw.name === "string") tc.name = raw.name;
    if (raw.hint === true) tc.hint = true;
    cases.push(tc);
  }
  return cases;
}

export const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
export const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
export const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/** A fixed ISO instant (the `corte:` line). Never the clock. */
export function isIsoInstant(s: string | undefined): s is string {
  if (!s) return false;
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(s)) return false;
  return Number.isFinite(Date.parse(s));
}

/** Check every element of an array of objects with a field validator; returns the first error or null. */
export function eachObj(arr: unknown, what: string, fn: (o: Record<string, unknown>, i: number) => string | null): string | null {
  if (!Array.isArray(arr)) return `${what} debe ser una lista JSON`;
  for (let i = 0; i < arr.length; i++) {
    const o = arr[i];
    if (!isObj(o)) return `${what}[${i}] debe ser un objeto`;
    const e = fn(o, i);
    if (e) return `${what}[${i}]: ${e}`;
  }
  return null;
}

/** Ids of an array of objects are present and unique; returns an error or null. */
export function uniqueIds(arr: { id?: unknown }[], what: string): string | null {
  const seen = new Set<string>();
  for (const o of arr) {
    if (!isStr(o.id)) return `${what}: cada elemento necesita un id`;
    if (seen.has(o.id)) return `${what}: id repetido «${o.id}»`;
    seen.add(o.id);
  }
  return null;
}

/** True if a body has a `####` heading outside fences (only `### Mutantes` may have them, §9.2). */
export function hasH4OutsideFences(lines: string[]): boolean {
  let inFence = false;
  for (const line of lines) {
    if (FENCE_RE.test(line)) inFence = !inFence;
    else if (!inFence && /^####\s/.test(line)) return true;
  }
  return false;
}

/** Fence-aware split of a body at `####` headings (used by `### Mutantes`). */
export function splitH4(lines: string[]): { preamble: string[]; parts: { heading: string; body: string[] }[] } {
  const parts: { heading: string; body: string[] }[] = [];
  const preamble: string[] = [];
  let cur: { heading: string; body: string[] } | null = null;
  let inFence = false;
  for (const line of lines) {
    if (FENCE_RE.test(line)) inFence = !inFence;
    const m = !inFence ? line.match(/^####\s+(.*)$/) : null;
    if (m) {
      if (cur) parts.push(cur);
      cur = { heading: m[1]!.trim(), body: [] };
    } else if (cur) cur.body.push(line);
    else preamble.push(line);
  }
  if (cur) parts.push(cur);
  return { preamble, parts };
}

/** Parse the shared code-like trio (### Firma, ### Casos, ### Solución) used by `retencion` with forma codigo. */
export function codeTrio(block: ForgeBlock): SchemaResult<{
  firma: Partial<Record<Lang, string>>;
  casos: TestCase[];
  solucion: Partial<Record<Lang, string>>;
  functionName: Partial<Record<Lang, string>>;
}> {
  const firma = fencesByLang(getSection(block, "firma"));
  const langs = Object.keys(firma) as Lang[];
  if (langs.length === 0) return fail("falta ### Firma con una cerca javascript o python");
  const casos = testCasesOf(getSection(block, "casos"));
  if (!casos) return fail("falta ### Casos (cerca json con [{ input, expected }])");
  const solucion = fencesByLang(getSection(block, "solucion"));
  const functionName: Partial<Record<Lang, string>> = {};
  for (const l of langs) {
    if (!solucion[l]) return fail(`### Solución no trae la cerca de ${l}`);
    const fnName = deriveFunctionName(firma[l]!, l) ?? deriveFunctionName(solucion[l]!, l);
    if (!fnName) return fail(`### Firma (${l}) no declara una función`);
    functionName[l] = fnName;
  }
  return okData({ firma, casos, solucion, functionName });
}
