import { slugify } from "@/lib/book";
import type { CodeExercise, ChoiceExercise, Exercise, Lang, QualityPattern, TestCase } from "@/lib/exercise";

// CONTRACT + PURE PARSER for CURATED EXERCISE BANKS as .md — the parallel to lib/book.ts. Arcanum INGESTS
// exercise banks generated externally (Sonnet 5), it does NOT generate them. A bank .md = YAML frontmatter
// (kind: exercises) + a body of exercises, each a `## <title>` block with a `type:` line and `### <field>`
// subsections. The parser is FENCE-AWARE from the start (a `##`/`###` inside a ``` code fence is NEVER a
// boundary — the book parser learned this the hard way) and ALL-OR-NOTHING: any malformed exercise → the
// whole bank parses to null (honest rejection, never a partial/faked ingest). It emits the SAME runtime
// model the app already runs (CodeExercise per language + ChoiceExercise) so the execution engine, the
// exercise UI, and the log wiring are untouched — this file only makes Layer-1 curated content ingestible.

export interface ExerciseBankMeta {
  /** module_id — anchors the bank to a roadmap cell (same id as the sibling book). null = loose. */
  moduleId: string | null;
  spine: string;
  title: string;
  /** kind MUST be "exercises" or the .md is not a bank */
  kind: string;
  /** the languages the bank declares (informational; per-exercise langs derive from the signatures) */
  languages: Lang[];
  generatedBy: string;
  version: string;
}

export interface ParsedExerciseBank {
  meta: ExerciseBankMeta;
  /** the SAME Exercise model the runtime uses (a code exercise → one CodeExercise per language) */
  exercises: Exercise[];
}

const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (s: string) => stripAccents(s.toLowerCase()).trim();

/** map a fence info-string / frontmatter language token to our Lang, or null if unrecognized. */
function normLang(tag: string): Lang | null {
  const t = norm(tag);
  if (t === "js" || t === "javascript" || t === "node") return "js";
  if (t === "py" || t === "python") return "python";
  return null;
}

/** Fence-aware split of lines at a heading level → the preamble (before the first heading) + the sections.
 *  A heading marker inside a ``` / ~~~ code fence is NOT a boundary. */
function splitByHeading(lines: string[], level: 2 | 3): { preamble: string[]; sections: { heading: string; body: string[] }[] } {
  const re = new RegExp(`^#{${level}}\\s+(.*)$`);
  const sections: { heading: string; body: string[] }[] = [];
  const preamble: string[] = [];
  let cur: { heading: string; body: string[] } | null = null;
  let inFence = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const m = !inFence ? line.match(re) : null;
    if (m) {
      if (cur) sections.push(cur);
      cur = { heading: m[1]!.trim(), body: [] };
    } else if (cur) {
      cur.body.push(line);
    } else {
      preamble.push(line);
    }
  }
  if (cur) sections.push(cur);
  return { preamble, sections };
}

/** Pull the fenced code blocks out of a subsection body → [{lang, code}] in order (multiple langs OK). */
function extractFences(lines: string[]): { lang: string; code: string }[] {
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

function parseFrontmatter(fm: string): ExerciseBankMeta {
  const get: Record<string, string> = {};
  for (const line of fm.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!m) continue;
    let v = m[2]!.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    get[m[1]!] = v;
  }
  const langsRaw = (get.languages ?? "").replace(/^\[|\]$/g, "");
  const languages = langsRaw
    .split(",")
    .map((s) => normLang(s.trim()))
    .filter((l): l is Lang => l !== null);
  return {
    moduleId: get.module_id ? get.module_id : null,
    spine: get.spine ?? "",
    title: get.title ?? "",
    kind: norm(get.kind ?? ""),
    languages,
    generatedBy: get.generated_by ?? "",
    version: get.version ?? "",
  };
}

/** heading → which field, tolerant of accents/aliases */
function fieldMatches(heading: string, roots: string[]): boolean {
  const h = norm(heading);
  return roots.some((r) => h === r || h.startsWith(r));
}
function findSection(sections: { heading: string; body: string[] }[], roots: string[]): string[] | null {
  const s = sections.find((sec) => fieldMatches(sec.heading, roots));
  return s ? s.body : null;
}

function deriveFunctionName(code: string, lang: Lang): string | null {
  if (lang === "python") {
    const m = code.match(/def\s+([A-Za-z_]\w*)\s*\(/);
    return m ? m[1]! : null;
  }
  const fn = code.match(/function\s+([A-Za-z_$][\w$]*)\s*\(/);
  if (fn) return fn[1]!;
  const asgn = code.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/);
  return asgn ? asgn[1]! : null;
}

function parseListItems(body: string[] | null): string[] {
  if (!body) return [];
  return body
    .map((l) => l.trim())
    .filter((l) => /^[-*+]\s+/.test(l))
    .map((l) => l.replace(/^[-*+]\s+/, "").trim())
    .filter(Boolean);
}

function parsePatterns(body: string[] | null): QualityPattern[] {
  const out: QualityPattern[] = [];
  for (const item of parseListItems(body)) {
    // format: `<regex>` — <message>   (backticks protect regex metachars; em-dash or " - " separates)
    const m = item.match(/^`(.+?)`\s*(?:—|-)\s*(.*)$/);
    if (m && m[1] && m[2]) out.push({ test: m[1], message: m[2].trim() });
  }
  return out;
}

function parseTestCases(body: string[] | null): TestCase[] | null {
  if (!body) return null;
  const fences = extractFences(body);
  const block = fences.find((f) => f.lang === "json") ?? fences[0];
  if (!block) return null;
  let arr: unknown;
  try {
    arr = JSON.parse(block.code);
  } catch {
    return null;
  }
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const cases: TestCase[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") return null;
    const c = raw as Record<string, unknown>;
    if (!Array.isArray(c.input) || !("expected" in c)) return null;
    const tc: TestCase = { input: c.input as unknown[], expected: c.expected };
    if (typeof c.name === "string") tc.name = c.name;
    if (c.hint === true) tc.hint = true;
    cases.push(tc);
  }
  return cases;
}

const F = {
  spec: ["spec", "especificacion", "pseudocodigo", "pseudocodigo"],
  firma: ["firma", "signature"],
  casos: ["casos", "test cases", "casos de prueba", "cases"],
  solucion: ["solucion", "solution", "referencia", "reference"],
  pistas: ["pistas", "hints"],
  patrones: ["patrones", "patterns"],
  opciones: ["opciones", "options"],
  justificacion: ["justificacion", "justification", "por que"],
};

const CHOICE_TYPES = new Set(["multiple_choice", "choice", "complexity", "complejidad", "trace", "trazar"]);

/** Parse ONE exercise block → the CodeExercise(s) (one per language) or a single ChoiceExercise, or null
 *  if the block is malformed (which invalidates the WHOLE bank — no partial ingest). */
function parseExerciseBlock(idBase: string, index: number, title: string, body: string[]): Exercise[] | null {
  const { preamble, sections } = splitByHeading(body, 3);
  const typeLine = preamble.find((l) => /^\s*type\s*:/i.test(l));
  if (!typeLine) return null;
  const type = norm(typeLine.replace(/^\s*type\s*:/i, ""));
  const prompt = preamble.filter((l) => l !== typeLine).join("\n").trim();
  if (!prompt) return null;
  const uid = `${idBase}:${index}-${slugify(title)}`;

  if (type === "code") {
    const specBody = findSection(sections, F.spec);
    const firmaBody = findSection(sections, F.firma);
    const casosBody = findSection(sections, F.casos);
    const solBody = findSection(sections, F.solucion);
    if (!firmaBody || !casosBody || !solBody) return null; // code requires signature + cases + solution
    const testCases = parseTestCases(casosBody);
    if (!testCases) return null;
    const pseudocode = specBody ? specBody.join("\n").trim() : undefined;
    const hints = parseListItems(findSection(sections, F.pistas));
    const patterns = parsePatterns(findSection(sections, F.patrones));

    const sigs = new Map<Lang, string>();
    for (const f of extractFences(firmaBody)) {
      const l = normLang(f.lang);
      if (l && !sigs.has(l)) sigs.set(l, f.code);
    }
    const sols = new Map<Lang, string>();
    for (const f of extractFences(solBody)) {
      const l = normLang(f.lang);
      if (l && !sols.has(l)) sols.set(l, f.code);
    }
    if (sigs.size === 0) return null;
    const out: CodeExercise[] = [];
    for (const [lang, starter] of sigs) {
      const solution = sols.get(lang);
      if (!solution) return null; // a signed language MUST have a reference solution
      const functionName = deriveFunctionName(starter, lang) ?? deriveFunctionName(solution, lang);
      if (!functionName) return null; // can't run without a function name
      out.push({
        id: `${uid}:${lang}`,
        kind: "code",
        moduleId: null, // filled by the caller (bank meta)
        lang,
        title,
        statement: prompt,
        pseudocode,
        functionName,
        starter,
        testCases,
        referenceSolution: solution,
        hints,
        patterns,
        source: "curated",
      });
    }
    return out.length ? out : null;
  }

  if (CHOICE_TYPES.has(type)) {
    const rawOptions = parseListItems(findSection(sections, F.opciones));
    if (rawOptions.length < 2) return null;
    let answer = -1;
    const options = rawOptions.map((o, i) => {
      const m = o.match(/^\[\s*[xX]\s*\]\s*(.*)$/);
      if (m) {
        if (answer !== -1) answer = -2; // more than one marked → invalid sentinel
        else answer = i;
        return m[1]!.trim();
      }
      return o;
    });
    if (answer < 0) return null; // exactly one option must be marked [x]
    if (options.some((o) => o.trim() === "")) return null; // no empty option (a blank [x] would render a placebo "correct" button)
    const rationaleBody = findSection(sections, F.justificacion);
    const rationale = rationaleBody ? rationaleBody.join("\n").trim() : "";
    if (!rationale) return null; // justification is required (opción + justificación)
    const choice: ChoiceExercise = {
      id: uid,
      kind: "choice",
      moduleId: null,
      title,
      statement: prompt,
      options,
      answer,
      rationale,
      source: "curated",
    };
    return [choice];
  }

  return null; // unknown type → invalid
}

/** Parse a full exercise-bank .md → the bank, or null if it does NOT satisfy the contract (honest — the
 *  caller shows "formato inválido", never fabricates exercises). ALL-OR-NOTHING: a single malformed
 *  exercise rejects the whole bank so a broken AI-generated file never ingests partially. */
export function parseExercisesMd(md: string): ParsedExerciseBank | null {
  const fmMatch = md.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fmMatch) return null;
  const meta = parseFrontmatter(fmMatch[1]!);
  if (meta.kind !== "exercises") return null; // not an exercise bank
  if (!meta.title.trim()) return null;
  const body = fmMatch[2] ?? "";

  // FAIL-CLOSED fence balance: every fenced block is exactly two marker lines, so a well-formed bank has an
  // EVEN number of fence markers. An ODD count means an unterminated / stray fence — which would desync the
  // fence-aware split and SILENTLY drop or truncate an exercise. Reject the whole bank instead (ALL-OR-NOTHING).
  const bodyLines = body.split(/\r?\n/);
  const fenceCount = bodyLines.filter((l) => /^\s*(```|~~~)/.test(l)).length;
  if (fenceCount % 2 !== 0) return null;

  const idBase = meta.moduleId ?? slugify(meta.title);
  const { sections } = splitByHeading(bodyLines, 2);
  if (sections.length === 0) return null; // a bank with no exercises is not a valid bank

  const exercises: Exercise[] = [];
  const seen = new Set<string>();
  let index = 0;
  for (const sec of sections) {
    const parsed = parseExerciseBlock(idBase, index, sec.heading.replace(/^ejercicio\s*:\s*/i, "").trim(), sec.body);
    if (!parsed) return null; // one malformed exercise → reject the whole bank
    for (const ex of parsed) {
      if (seen.has(ex.id)) return null; // id collision (shouldn't happen — index-prefixed) → reject
      seen.add(ex.id);
      exercises.push({ ...ex, moduleId: meta.moduleId });
    }
    index++;
  }
  if (exercises.length === 0) return null;
  return { meta, exercises };
}
