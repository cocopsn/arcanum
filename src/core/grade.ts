import { ARCANUM_CONFIG, type GradeName } from "@/core/config";

export interface GradeInfo {
  name: GradeName;
  index: number;
  floorXp: number;
  nextXp: number | null;
  epithet: string;
  seal: string;
  color: string;
  phrase: string;
}

export const GRADES = ARCANUM_CONFIG.gradeThresholds;

function info(index: number): GradeInfo {
  const cur = GRADES[index]!;
  const next = GRADES[index + 1];
  return {
    name: cur.name,
    index,
    floorXp: cur.xp,
    nextXp: next ? next.xp : null,
    epithet: cur.epithet,
    seal: cur.seal,
    color: cur.color,
    phrase: cur.phrase,
  };
}

/**
 * AUCTORUM grade = highest threshold ≤ totalXp (spec §6.2). Since totalXp is the
 * cumulative record (XP only ever accumulates over the append-only log), the
 * grade is monotonic and never decreases.
 */
export function gradeForXp(totalXp: number): GradeInfo {
  let idx = 0;
  for (let i = 0; i < GRADES.length; i++) {
    if (totalXp >= GRADES[i]!.xp) idx = i;
    else break;
  }
  return info(idx);
}

export function gradeByIndex(index: number): GradeInfo {
  return info(Math.max(0, Math.min(GRADES.length - 1, index)));
}

/** Grades strictly above fromIndex up to toIndex — the ascensions to celebrate. */
export function gradesBetween(fromIndex: number, toIndex: number): GradeInfo[] {
  const out: GradeInfo[] = [];
  for (let i = fromIndex + 1; i <= toIndex && i < GRADES.length; i++) out.push(info(i));
  return out;
}
