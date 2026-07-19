// PHASE 2 — offline coding exercises. The learner writes the implementation FROM SCRATCH (never given
// it); the system runs their code LOCALLY and reports Level 1 (does it parse?) with the REAL interpreter
// error, and Level 2 (does it pass the saved test cases?) with the EXACT failing case as evidence — the
// learner hunts the bug. Level 3 (design/elegance) is NOT judged offline (Phase 3, Asuka with AI). This
// file is the pure model + comparison helpers (no DOM, no worker) → fully testable.

export type Lang = "js" | "python";
export type ExerciseSource = "curated" | "procedural" | "book";

export interface TestCase {
  /** positional args passed to the learner's function */
  input: unknown[];
  /** the value the function must return */
  expected: unknown;
  name?: string;
  /** an extra, illuminating case revealed only as a progressive HINT */
  hint?: boolean;
}

export interface QualityPattern {
  /** a regex (source string) matched against the learner's code — a SAVED, specific pattern */
  test: string;
  /** the honest improvement note (idiomatic suggestion), never a fabricated quality score */
  message: string;
}

export interface CodeExercise {
  id: string;
  kind: "code";
  moduleId: string | null;
  lang: Lang;
  title: string;
  statement: string;
  /** the spec / pseudocode — the WHAT, never the implementation */
  pseudocode?: string;
  functionName: string;
  /** the starting stub the learner fills (signature + TODO, no implementation) */
  starter: string;
  testCases: TestCase[];
  /** shown ONLY at the end (last hint) or on the honest fallback — never up front */
  referenceSolution: string;
  /** progressive conceptual hints (marked, optional) */
  hints: string[];
  /** saved idiomatic patterns the local heuristic can flag (never invents a critique) */
  patterns: QualityPattern[];
  source: ExerciseSource;
}

export interface ChoiceExercise {
  id: string;
  kind: "choice";
  moduleId: string | null;
  title: string;
  statement: string;
  options: string[];
  /** index of the correct option */
  answer: number;
  /** the justification (why) — shown after answering */
  rationale: string;
  source: ExerciseSource;
}

/** PRODUCTION — a free-response exercise for PRODUCTION domains (e.g. German: build your own sentence,
 *  decline by function, correct the error). The learner produces from scratch; the app then reveals a MODEL
 *  answer, the RULE / the WHY (the point of the exercise), and an explicit self-check RUBRIC. It is NEVER
 *  auto-graded (grading free production offline would be a placebo) — the learner self-attests honestly
 *  against the rubric, exactly like the "fallback that shows the reference and advances". Self-attest fires
 *  reinforcement (checkpoint XP), NEVER mastery — mastery stays gate-only. */
export interface ProductionExercise {
  id: string;
  kind: "production";
  moduleId: string | null;
  title: string;
  statement: string;
  /** the model answer, revealed AFTER the learner produces — a thing to compare against, not a graded key */
  modelAnswer: string;
  /** the RULE the learner must be able to STATE — explaining the WHY is the whole point, not just producing */
  rule: string;
  /** explicit self-check criteria — what a correct production must satisfy */
  rubric: string[];
  source: ExerciseSource;
}

export type Exercise = CodeExercise | ChoiceExercise | ProductionExercise;

// ── pure comparison + formatting (used by the runner + the UI) ──────────────────────────────
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") return Number.isNaN(a) && Number.isNaN(b);
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => deepEqual(x, b[i]));
  }
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

export function formatValue(v: unknown): string {
  if (v === undefined) return "undefined";
  if (typeof v === "number" && Number.isNaN(v)) return "NaN";
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

// ── run result (produced by the JS/Python runners) ──────────────────────────────────────────
export interface CaseResult {
  input: unknown[];
  expected: unknown;
  /** the learner's actual return, when the case ran */
  output?: unknown;
  /** a runtime error for THIS case (e.g. threw), when it didn't return cleanly */
  error?: string;
  pass: boolean;
}
export interface RunResult {
  /** Level 1: the REAL interpreter parse/compile error (line + message), or null if it parsed */
  syntaxError: string | null;
  /** Level 2: one result per non-hint test case */
  cases: CaseResult[];
  /** the code ran too long (likely an infinite loop) and was terminated */
  timedOut?: boolean;
}

/** All non-hint cases passed AND there was no syntax error / timeout. Plus the first failing case
 *  (the exact evidence to show), or null. Pure. */
export function evaluateRun(r: RunResult): { allPass: boolean; firstFail: CaseResult | null } {
  if (r.syntaxError || r.timedOut) return { allPass: false, firstFail: null };
  const firstFail = r.cases.find((c) => !c.pass) ?? null;
  return { allPass: r.cases.length > 0 && !firstFail, firstFail };
}

/** The saved idiomatic patterns that MATCH the learner's code — honest: only pre-saved patterns, and
 *  an empty result means "the local heuristic has nothing to say" (→ show the reference, don't fake). */
export function matchedPatterns(code: string, patterns: QualityPattern[]): string[] {
  const out: string[] = [];
  for (const p of patterns) {
    try {
      if (new RegExp(p.test).test(code)) out.push(p.message);
    } catch {
      /* a malformed saved pattern is simply skipped */
    }
  }
  return out;
}
