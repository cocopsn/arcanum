// Per-subject VISUAL IDENTITY for the living topic map (Bloque 4). Pure data —
// the map renders these as SVG motifs + accent ramps, ZERO image-API cost. Authorable:
// add a subject by adding a theme keyed by a slug, and map it from the goal title.

export type MotifId = "lattice" | "circuit" | "runes" | "cipher" | "default";

export interface SubjectTheme {
  slug: string;
  /** primary accent (mirrors core/config topicDefaults) */
  accent: string;
  /** faint background SVG motif painted behind the path */
  motif: MotifId;
  /** subject glyph stamped on the start cap of the path */
  glyph: string;
  /** one-line identity used as the map subtitle */
  tagline: string;
}

// Designed identities — distinct palette + motif per domain (not a generic template).
export const SUBJECT_THEMES: Record<string, SubjectTheme> = {
  itc: {
    slug: "itc",
    accent: "#25B0C9",
    motif: "lattice", // estructuras / grafos → retícula
    glyph: "∴",
    tagline: "estructuras, algoritmos y la forma de los datos",
  },
  fred: {
    slug: "fred",
    accent: "#1F9E84",
    motif: "circuit", // manufactura / electrónica → trazos de circuito y campo
    glyph: "⎓",
    tagline: "prototipo, manufactura y el pulso de la máquina",
  },
  aleman: {
    slug: "aleman",
    accent: "#C0455F",
    motif: "runes", // idioma germánico → glifos
    glyph: "ᚦ",
    tagline: "la lengua que ordena el pensamiento",
  },
  ciber: {
    slug: "ciber",
    accent: "#7C4DE8",
    motif: "cipher", // seguridad → cifra
    glyph: "⊗",
    tagline: "ofensa, defensa y el arte de la cifra",
  },
};

const DEFAULT_THEME: SubjectTheme = {
  slug: "default",
  accent: "#2ec0d6",
  motif: "default",
  glyph: "✦",
  tagline: "el camino de tópicos",
};

/** Resolve a subject theme from a goal title (tolerant: substring match). */
export function themeForGoal(title: string): SubjectTheme {
  const t = title.toLowerCase();
  if (t.includes("itc") || t.includes("dato") || t.includes("algorit")) return SUBJECT_THEMES.itc!;
  if (t.includes("fred") || t.includes("manufact") || t.includes("robot")) return SUBJECT_THEMES.fred!;
  if (t.includes("alem") || t.includes("german") || t.includes("deutsch")) return SUBJECT_THEMES.aleman!;
  if (t.includes("ciber") || t.includes("cyber") || t.includes("segur")) return SUBJECT_THEMES.ciber!;
  return DEFAULT_THEME;
}
