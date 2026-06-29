// Single source of all tunable constants. Changing any of these = re-fold,
// zero data migration (spec §2 pp.5). The fold and presentation read ONLY here.

export const ARCANUM_CONFIG = {
  tz: "America/Monterrey",

  // Hermetic grade ladder (Golden Dawn) by accumulated XP (spec §6.2).
  gradeThresholds: [
    { name: "Neophyte", xp: 0 },
    { name: "Zelator", xp: 500 },
    { name: "Theoricus", xp: 1500 },
    { name: "Practicus", xp: 3500 },
    { name: "Philosophus", xp: 7000 },
    { name: "Adeptus Minor", xp: 13000 },
    { name: "Adeptus Major", xp: 22000 },
    { name: "Adeptus Exemptus", xp: 36000 },
    { name: "Magister Templi", xp: 58000 },
    { name: "Magus", xp: 95000 },
    { name: "Ipsissimus", xp: 160000 },
  ],

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

  // Mastery with decay / spaced repetition (spec §6.4).
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

  // Grade → aura hex (spec §9.3): arcane-purple luminosity ramp. Ascending =
  // brighter, richer violet (dim cool → vivid amethyst → near-white iridescent).
  // Re-tunable alongside tokens.css.
  rankAura: {
    Neophyte: "#9A93C8",
    Zelator: "#8E86DA",
    Theoricus: "#837CE6",
    Practicus: "#8A6FEE",
    Philosophus: "#9562F0",
    "Adeptus Minor": "#A452F2",
    "Adeptus Major": "#B566F4",
    "Adeptus Exemptus": "#C783F6",
    "Magister Templi": "#D6A0F8",
    Magus: "#E6C4FC",
    Ipsissimus: "#F2E4FF",
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
