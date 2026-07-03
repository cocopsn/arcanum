import type { CodeExercise, Lang, TestCase } from "@/lib/exercise";

// LAYER 2 — the HONEST infinite. Parameterized templates that produce UNLIMITED VARIANTS of mechanical
// patterns (reverse/sum/max/search over randomized data, structure syntax). The generator computes the
// expected output with a reference, so correctness is checked against a real answer — never faked. This
// is honestly bounded: infinite VARIANTS of a fixed set of patterns, NOT infinitely-new concepts. Pure
// given an RNG (seeded → deterministic tests; the UI seeds from the clock so a variant never repeats).

/** Deterministic seeded RNG (mulberry32) → reproducible variants for tests, endless ones in the app. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randInt = (rng: () => number, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const randArr = (rng: () => number, len: number, lo = 0, hi = 9): number[] => Array.from({ length: len }, () => randInt(rng, lo, hi));

interface LangBits {
  functionName: Record<Lang, string>;
  starter: Record<Lang, string>;
  solution: Record<Lang, string>;
}

function build(id: string, moduleId: string | null, lang: Lang, title: string, statement: string, pseudocode: string, cases: TestCase[], bits: LangBits): CodeExercise {
  return {
    id,
    kind: "code",
    moduleId,
    lang,
    title,
    statement,
    pseudocode,
    functionName: bits.functionName[lang],
    starter: bits.starter[lang],
    testCases: cases,
    referenceSolution: bits.solution[lang],
    hints: [],
    patterns: [],
    source: "procedural",
  };
}

export interface ProceduralTemplate {
  id: string;
  category: string;
  moduleId: string | null;
  label: string;
  generate: (rng: () => number, lang: Lang) => CodeExercise;
}

// each template's cases ALWAYS include the edge cases (empty, single) plus randomized ones (0.1% rigor)
export const PROCEDURAL_TEMPLATES: ProceduralTemplate[] = [
  {
    id: "reverse-array",
    category: "arrays",
    moduleId: null,
    label: "Invertir un arreglo",
    generate: (rng, lang) => {
      const arrs = [[], [randInt(rng, 0, 9)], randArr(rng, randInt(rng, 3, 6)), randArr(rng, randInt(rng, 5, 9))];
      const cases: TestCase[] = arrs.map((a) => ({ input: [a], expected: [...a].reverse() }));
      return build("proc-reverse", null, lang, "Invierte un arreglo", "Devuelve un NUEVO arreglo con los elementos en orden inverso. No mutes el original.", "reverse(a): recorre de atrás hacia adelante, o usa el método idiomático.", cases, {
        functionName: { js: "reverse", python: "reverse" },
        starter: { js: "function reverse(a) {\n  // tu código\n}", python: "def reverse(a):\n    # tu código\n    pass" },
        solution: { js: "function reverse(a) {\n  return [...a].reverse();\n}", python: "def reverse(a):\n    return a[::-1]" },
      });
    },
  },
  {
    id: "sum-array",
    category: "arrays",
    moduleId: null,
    label: "Sumar un arreglo",
    generate: (rng, lang) => {
      const arrs = [[], [randInt(rng, -5, 9)], randArr(rng, randInt(rng, 3, 6), -5, 9), randArr(rng, randInt(rng, 5, 9), -9, 9)];
      const cases: TestCase[] = arrs.map((a) => ({ input: [a], expected: a.reduce((s, x) => s + x, 0) }));
      return build("proc-sum", null, lang, "Suma un arreglo", "Devuelve la suma de todos los elementos. El arreglo vacío suma 0.", "sum(a): acumula; caso base vacío = 0.", cases, {
        functionName: { js: "sum", python: "sum_list" },
        starter: { js: "function sum(a) {\n  // tu código\n}", python: "def sum_list(a):\n    # tu código\n    pass" },
        solution: { js: "function sum(a) {\n  return a.reduce((s, x) => s + x, 0);\n}", python: "def sum_list(a):\n    return __import__('functools').reduce(lambda s, x: s + x, a, 0)" },
      });
    },
  },
  {
    id: "max-array",
    category: "arrays",
    moduleId: null,
    label: "Máximo de un arreglo",
    generate: (rng, lang) => {
      const arrs = [[randInt(rng, -9, 9)], randArr(rng, randInt(rng, 3, 6), -9, 9), randArr(rng, randInt(rng, 5, 9), -20, 20)];
      const cases: TestCase[] = arrs.map((a) => ({ input: [a], expected: Math.max(...a) }));
      return build("proc-max", null, lang, "Máximo de un arreglo", "Devuelve el elemento mayor. Asume al menos un elemento.", "max(a): lleva el mayor visto; compáralo con cada elemento.", cases, {
        functionName: { js: "maxOf", python: "max_of" },
        starter: { js: "function maxOf(a) {\n  // tu código\n}", python: "def max_of(a):\n    # tu código\n    pass" },
        solution: { js: "function maxOf(a) {\n  return Math.max(...a);\n}", python: "def max_of(a):\n    return max(a)" },
      });
    },
  },
  {
    id: "count-occurrences",
    category: "arrays",
    moduleId: null,
    label: "Contar ocurrencias",
    generate: (rng, lang) => {
      const target = randInt(rng, 0, 4);
      const arrs = [[], randArr(rng, randInt(rng, 4, 8), 0, 4), randArr(rng, randInt(rng, 5, 9), 0, 4)];
      const cases: TestCase[] = arrs.map((a) => ({ input: [a, target], expected: a.filter((x) => x === target).length }));
      return build("proc-count", null, lang, "Contar ocurrencias", `Cuenta cuántas veces aparece el valor objetivo en el arreglo.`, "count(a, t): recorre y cuenta los iguales a t.", cases, {
        functionName: { js: "countOf", python: "count_of" },
        starter: { js: "function countOf(a, t) {\n  // tu código\n}", python: "def count_of(a, t):\n    # tu código\n    pass" },
        solution: { js: "function countOf(a, t) {\n  return a.filter((x) => x === t).length;\n}", python: "def count_of(a, t):\n    return sum(1 for x in a if x == t)" },
      });
    },
  },
  {
    id: "is-sorted",
    category: "arrays",
    moduleId: null,
    label: "¿Está ordenado?",
    generate: (rng, lang) => {
      const sorted = randArr(rng, randInt(rng, 3, 6)).sort((x, y) => x - y);
      const unsorted = [...sorted].reverse().concat(randInt(rng, 0, 9));
      const cases: TestCase[] = [
        { input: [[]], expected: true },
        { input: [[randInt(rng, 0, 9)]], expected: true },
        { input: [sorted], expected: true },
        { input: [unsorted], expected: isNonDecreasing(unsorted) },
      ];
      return build("proc-sorted", null, lang, "¿Está ordenado ascendente?", "Devuelve true si el arreglo está en orden no-decreciente. Vacío y de un elemento están ordenados.", "isSorted(a): cada elemento <= el siguiente.", cases, {
        functionName: { js: "isSorted", python: "is_sorted" },
        starter: { js: "function isSorted(a) {\n  // tu código\n}", python: "def is_sorted(a):\n    # tu código\n    pass" },
        solution: { js: "function isSorted(a) {\n  for (let i = 1; i < a.length; i++) if (a[i] < a[i - 1]) return false;\n  return true;\n}", python: "def is_sorted(a):\n    return all(a[i] >= a[i-1] for i in range(1, len(a)))" },
      });
    },
  },
];

function isNonDecreasing(a: number[]): boolean {
  for (let i = 1; i < a.length; i++) if (a[i]! < a[i - 1]!) return false;
  return true;
}

/** Generate one variant of a template with a given seed (UI passes a clock-derived seed → endless). */
export function generateVariant(templateId: string, lang: Lang, seed: number): CodeExercise | null {
  const t = PROCEDURAL_TEMPLATES.find((x) => x.id === templateId);
  if (!t) return null;
  const ex = t.generate(mulberry32(seed), lang);
  // The base id (proc-reverse, …) is a TEMPLATE discriminator shared by every variant. Make the EMITTED id
  // unique per (lang, seed) so a consumer keyed by id (the React key in ExerciseMode) REMOUNTS on "otra
  // variante" — else a fresh, never-run variant would inherit the previous instance's passed state (a placebo).
  return { ...ex, id: `${ex.id}-${lang}-${(seed >>> 0).toString(36)}` };
}
