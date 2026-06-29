import { ARCANUM_CONFIG, type GradeName } from "@/core/config";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/**
 * CSS variables for a grade's aura (spec §9.3). Ascending a grade swaps these
 * on a wrapper → the whole app retints. Derived soft/glow shades keep the hex
 * as the single source.
 */
export function rankAuraVars(grade: GradeName): Record<"--rank" | "--rank-soft" | "--rank-glow", string> {
  const hex = ARCANUM_CONFIG.rankAura[grade];
  const { r, g, b } = hexToRgb(hex);
  return {
    "--rank": hex,
    "--rank-soft": `rgba(${r}, ${g}, ${b}, 0.14)`,
    "--rank-glow": `rgba(${r}, ${g}, ${b}, 0.40)`,
  };
}
