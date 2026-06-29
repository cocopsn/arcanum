// Single source of all tunable constants. Changing any of these = re-fold,
// zero data migration (spec §2 pp.5). The fold and presentation read ONLY here.

export interface GradeDef {
  name: string;
  /** cumulative XP threshold (record-based, never decreases) */
  xp: number;
  /** epithet shown beside the grade */
  epithet: string;
  /** Latin seal engraved on the sigil */
  seal: string;
  /** aura ramp color (luminous purple: spark → source) */
  color: string;
  /** ceremony phrase spoken on ascension into this grade */
  phrase: string;
}

export const ARCANUM_CONFIG = {
  tz: "America/Monterrey",

  // AUCTORUM ladder — from spark to source. Global grade is CUMULATIVE: derived
  // from total accumulated XP (which only ever grows), so it never decreases.
  // Module mastery-with-decay is SEPARATE (the per-module sigil). Spec §6.2.
  gradeThresholds: [
    { name: "Scintilla", xp: 0, epithet: "la chispa que se niega a apagarse", seal: "Ex scintilla", color: "#9A93C8", phrase: "Una chispa. Es todo lo que el fuego necesitó para empezar." },
    { name: "Faber", xp: 500, epithet: "el que forja a golpes", seal: "Per ictus", color: "#A79FD0", phrase: "El golpe que casi te rompe es el que te da forma." },
    { name: "Artifex", xp: 1500, epithet: "dueño del oficio", seal: "Manu certa", color: "#B3ABD8", phrase: "Ya no peleas con la herramienta. La herramienta es tu mano." },
    { name: "Dux", xp: 3500, epithet: "al que otros siguen", seal: "Sequuntur", color: "#BFB7DF", phrase: "Volteaste, y había gente siguiéndote sin que se lo pidieras." },
    { name: "Fundator", xp: 7000, epithet: "el que pone la primera piedra", seal: "Prima petra", color: "#CBC3E6", phrase: "Pusiste algo en el mundo que seguirá ahí cuando cierres los ojos." },
    { name: "Dominus", xp: 13000, epithet: "señor de lo que construyó", seal: "Dominium", color: "#D6CFEC", phrase: "Lo que construiste ya no te obedece por esfuerzo. Te obedece porque es tuyo." },
    { name: "Princeps", xp: 22000, epithet: "el primero entre los que mandan", seal: "Primus inter", color: "#DFD8F0", phrase: "Entre los que mandan, llegaste primero." },
    { name: "Auctor", xp: 36000, epithet: "del que otros derivan", seal: "Ex me", color: "#E6E0F4", phrase: "Otros empiezan donde tú ya estuviste." },
    { name: "Legenda", xp: 58000, epithet: "el nombre que se cita", seal: "Nomen dicitur", color: "#ECE7F8", phrase: "Dejaste de hacer el trabajo. Ahora se cuenta el trabajo que hiciste." },
    { name: "Aeternus", xp: 95000, epithet: "el que el tiempo no borra", seal: "Tempus non delet", color: "#F0E9FB", phrase: "El tiempo intentó borrarte. No pudo." },
    { name: "Origo", xp: 160000, epithet: "la fuente de la que todo partió", seal: "Origo omnium", color: "#F2E4FF", phrase: "No alcanzaste la cima. Te volviste el origen del que todo parte." },
  ] satisfies GradeDef[],

  // XP — reward friction, not time (spec §6.1).
  xp: {
    errorResolved: 25,
    sessionMin: 10,
    checkpoint: 50,
    moduleCompleted: 150,
    firetestMax: 300,
    note: 5,
    noteMinLen: 140,
    sessionMinMs: 1_500_000, // 25 min
    streakMultPerDay: 0.02,
    streakMultCap: 30,
  },

  // Mastery with decay / spaced repetition (spec §6.4) — per-module, SEPARATE
  // from the cumulative global grade.
  mastery: {
    S0: 1.0,
    reviewThreshold: 0.8,
    bonusBase: 0.5,
    bonusQualityWeight: 0.5,
    defaultQuality: 0.7,
  },

  // Streak shields (spec §6.3).
  streak: {
    shieldEvery: 7,
    shieldMax: 2,
  },

  // Roadmap canvas (Phase 3): a firetest at/above this reached/ceiling ratio
  // marks a module mastered → reveals downstream nodes, skipping the path.
  roadmap: {
    firetestRevealThreshold: 0.7,
  },

  // Sleep Cycle context (Fase 4) — thresholds for the actionable digest the rite
  // hands the model: a started module with no reinforcement in `stallDays` is
  // "stalled"; a prereq whose retrievability crosses the review threshold within
  // `riskWindowDays` and gates other work is "at risk".
  sleepCycle: {
    stallDays: 4,
    riskWindowDays: 3,
  },

  // Per-topic default accents (spec §9.2). Editable per goal.
  topicDefaults: {
    ITC: "#25B0C9",
    "FrED Factory": "#1F9E84",
    Alemán: "#C0455F",
    Ciberseguridad: "#7C4DE8",
  },
} as const;

export type ArcanumConfig = typeof ARCANUM_CONFIG;
export type GradeName = (typeof ARCANUM_CONFIG.gradeThresholds)[number]["name"];
