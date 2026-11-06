import { seededShuffle } from "@/forge/eval/prng";

// f · senal (design §9.3 f). PURE. The order comes from mulberry32(semilla). Per item the learner picks a pattern and
// marks a span of the statement (a character range). `correcto` when the pattern matches, the overlap with `senal`
// is ≥ 50 % of `senal` and the span measures ≤ 3 times `senal` (marking the whole statement does not pass).

export interface SenalItem {
  enunciado: string;
  patron: string;
  senal: string;
}

export interface SenalAnswer {
  patron: string;
  /** [start, end) in characters of the statement */
  start: number;
  end: number;
}

export function senalOrder<T>(items: readonly T[], semilla: number): T[] {
  return seededShuffle(items, semilla);
}

export function gradeSenal(item: SenalItem, a: SenalAnswer): boolean {
  if (a.patron !== item.patron) return false;
  const len = item.senal.length;
  const at = item.enunciado.indexOf(item.senal);
  if (len === 0 || at < 0) return false;
  if (!(Number.isInteger(a.start) && Number.isInteger(a.end)) || a.end <= a.start) return false;
  const span = a.end - a.start;
  if (span > 3 * len) return false;
  const overlap = Math.max(0, Math.min(a.end, at + len) - Math.max(a.start, at));
  return overlap >= 0.5 * len;
}

/** Words of a statement with their character ranges (what the learner taps). */
export function senalWords(text: string): { word: string; start: number; end: number }[] {
  const out: { word: string; start: number; end: number }[] = [];
  const re = /\S+/g;
  for (let m = re.exec(text); m; m = re.exec(text)) out.push({ word: m[0], start: m.index, end: m.index + m[0].length });
  return out;
}
