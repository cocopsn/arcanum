// FOUR WORLDS, ONE GRAMMAR (visual redesign). Each spine is a REALM with its own
// temperature — the colour anchors the mental mode before a word is read. Pure data: the
// map renders these as a layered atmosphere + SVG motif + sigil nodes (zero image-API cost).
// The world is DERIVED from the goal (which lives in the log) via themeForGoal — not stored,
// not hardcoded per universe. Shared grammar (grid, type, mechanics); variety in colour/atmosphere.

import type { CSSProperties } from "react";

export type MotifId = "lattice" | "circuit" | "runes" | "cipher" | "default";

export interface WorldTheme {
  slug: string;
  /** the flame / primary accent (available nodes, paths, the world's pulse) */
  accent: string;
  /** the metal / secondary (gold, steel, stone) — mastery + ornament */
  accent2: string;
  /** rgba glow of the accent */
  glow: string;
  /** deep base of the atmosphere */
  bg: string;
  /** gradient partner (the realm's horizon) */
  bg2: string;
  /** fog-of-war colour for sealed territory */
  fog: string;
  /** faint background SVG motif painted behind the path */
  motif: MotifId;
  /** the realm's crest mark */
  glyph: string;
  /** one-line identity (map subtitle) */
  tagline: string;
  /** the realm's name — the temperature in one phrase */
  temper: string;
}

// Designed realms — the user's direction, not a generic template.
export const SUBJECT_THEMES: Record<string, WorldTheme> = {
  // ITC — the throne room. Depth, construction, the empire raised with rigour. Royal blue + gold.
  itc: {
    slug: "itc",
    accent: "#3f74e8",
    accent2: "#e8c36a",
    glow: "rgba(63, 116, 232, 0.55)",
    bg: "#080d20",
    bg2: "#0d1733",
    fog: "#161d34",
    motif: "lattice",
    glyph: "✶",
    tagline: "estructuras, algoritmos y la forma de los datos",
    temper: "La sala del trono",
  },
  // FrED — the forge. The lab where the real thing is made. Cold industrial + amber heat.
  fred: {
    slug: "fred",
    accent: "#f0a23c",
    accent2: "#86a2b2",
    glow: "rgba(240, 162, 60, 0.5)",
    bg: "#0a0e12",
    bg2: "#10181e",
    fog: "#1a232a",
    motif: "circuit",
    glyph: "⎓",
    tagline: "del sensor a la decisión — la forja del proceso real",
    temper: "La forja",
  },
  // Competitiva — the arena. Reflex under the clock. Eva-red punk-cyber, asphyxiating, urgent.
  competitiva: {
    slug: "competitiva",
    accent: "#ff2e48",
    accent2: "#ff8a1e",
    glow: "rgba(255, 46, 72, 0.55)",
    bg: "#130408",
    bg2: "#230910",
    fog: "#2a1117",
    motif: "cipher",
    glyph: "✺",
    tagline: "reconocer el patrón bajo el reloj — la pelea",
    temper: "La arena",
  },
  // Alemán — the cloister. Sober European, Gründlichkeit. Forest green + stone.
  aleman: {
    slug: "aleman",
    accent: "#4f9d7a",
    accent2: "#b8b2a0",
    glow: "rgba(79, 157, 122, 0.45)",
    bg: "#0a110d",
    bg2: "#0f1a14",
    fog: "#19211b",
    motif: "runes",
    glyph: "ᚦ",
    tagline: "la lengua que ordena el pensamiento",
    temper: "El claustro",
  },
  // OA Amazon — the coliseum. The assault on a real, dated exam: smile-orange heat over warm
  // near-black, business rules hiding patterns, the clock as the judge.
  oa: {
    slug: "oa",
    accent: "#ff9900",
    accent2: "#7fa3c0",
    glow: "rgba(255, 153, 0, 0.5)",
    bg: "#120c04",
    bg2: "#1d1408",
    fog: "#241c11",
    motif: "cipher",
    glyph: "⌖",
    tagline: "reglas de negocio que esconden un patrón — bajo el reloj",
    temper: "El coliseo",
  },
};

const DEFAULT_THEME: WorldTheme = {
  slug: "default",
  accent: "#7c8db0",
  accent2: "#cbb486",
  glow: "rgba(124, 141, 176, 0.4)",
  bg: "#0a0c12",
  bg2: "#11141d",
  fog: "#1a1e29",
  motif: "default",
  glyph: "✦",
  tagline: "el camino de tópicos",
  temper: "El umbral",
};

/** Resolve a realm from a goal title (tolerant substring match — derived from log state). */
export function themeForGoal(title: string): WorldTheme {
  const t = title.toLowerCase();
  if (t.includes("itc") || t.includes("dato") || t.includes("algorit")) return SUBJECT_THEMES.itc!;
  if (t.includes("fred") || t.includes("manufact") || t.includes("robot")) return SUBJECT_THEMES.fred!;
  if (t.includes("competit") || t.includes("icpc") || t.includes("cp")) return SUBJECT_THEMES.competitiva!;
  if (t.includes("alem") || t.includes("german") || t.includes("deutsch")) return SUBJECT_THEMES.aleman!;
  if (t.includes("amazon") || t.includes("oa ") || t.startsWith("oa")) return SUBJECT_THEMES.oa!;
  return DEFAULT_THEME;
}

/** Emit the realm's CSS custom properties onto an element — the whole subtree retints. */
export function worldVars(theme: WorldTheme): CSSProperties {
  return {
    ["--accent" as string]: theme.accent,
    ["--accent-2" as string]: theme.accent2,
    ["--world-glow" as string]: theme.glow,
    ["--world-bg" as string]: theme.bg,
    ["--world-bg-2" as string]: theme.bg2,
    ["--world-fog" as string]: theme.fog,
  } as CSSProperties;
}
