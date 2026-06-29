import { ARCANUM_CONFIG, type GradeName } from "@/core/config";

export interface GradeInfo {
  name: GradeName;
  index: number;
  floorXp: number;
  nextXp: number | null;
}

/** Hermetic grade = highest threshold ≤ totalXp (spec §6.2). */
export function gradeForXp(totalXp: number): GradeInfo {
  const g = ARCANUM_CONFIG.gradeThresholds;
  let idx = 0;
  for (let i = 0; i < g.length; i++) {
    if (totalXp >= g[i]!.xp) idx = i;
    else break;
  }
  const cur = g[idx]!;
  const next = g[idx + 1];
  return {
    name: cur.name,
    index: idx,
    floorXp: cur.xp,
    nextXp: next ? next.xp : null,
  };
}
