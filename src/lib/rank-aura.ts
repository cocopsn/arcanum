import { ARCANUM_CONFIG, type GradeName } from "@/core/config";

const COLOR_BY_GRADE = Object.fromEntries(
  ARCANUM_CONFIG.gradeThresholds.map((g) => [g.name, g.color]),
) as Record<GradeName, string>;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/**
 * CSS variables for a grade's aura (spec §9.3). Ascending a grade swaps these →
 * the whole app retints. Color is the grade's own ramp value (spark → source).
 */
export function rankAuraVars(grade: GradeName): Record<"--rank" | "--rank-soft" | "--rank-glow", string> {
  const hex = COLOR_BY_GRADE[grade] ?? "#9A93C8";
  const { r, g, b } = hexToRgb(hex);
  return {
    "--rank": hex,
    "--rank-soft": `rgba(${r}, ${g}, ${b}, 0.14)`,
    "--rank-glow": `rgba(${r}, ${g}, ${b}, 0.40)`,
  };
}
