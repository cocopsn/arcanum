import type { Sfx } from "@/lib/audio";

// THE REWARD SYSTEM — one cohesive feedback language, not scattered effects. Every meaningful gesture
// gets an immediate response scaled to what it earned (micro for a step, ceremony for an ascension), and
// the SAME tier does NOT always give the same flourish: the extra is VARIABLE — sometimes a glint, a
// mote, an unexpected Asuka line, a lore fragment, or NOTHING (absence makes presence matter). The
// variation is aesthetic + intellectual, never candy: no coins, no mascots, no leaderboards. Pure data
// (seeded) → the UI plays audio + a transform/opacity-only visual, and honours prefers-reduced-motion
// (the MOMENT still lands, just without motion). This file is engine-free: it only decides WHAT to show.

export type RewardTier = "micro" | "small" | "medium" | "large" | "ceremony";

export interface RewardExtraText {
  kind: "asuka" | "lore";
  text: string;
}
export interface RewardExtraGlow {
  kind: "glow";
}
export type RewardExtra = RewardExtraText | RewardExtraGlow;

export interface Reward {
  tier: RewardTier;
  sfx: Sfx;
  /** a diagonal light sweep across the earned surface */
  glint: boolean;
  /** rising motes (0 = none) */
  particles: number;
  /** an expanding ring pulse from the point of action */
  ring: boolean;
  /** the VARIABLE reward — aesthetic/intellectual, or null (nothing extra this time) */
  extra: RewardExtra | null;
}

// Asuka's voice — TERSE, exacting, never cute. It is the evaluator's flavour, never a factual claim, so
// it stays out of the "cero contenido inventado" rule (same footing as the epithets/taglines).
const ASUKA: readonly string[] = [
  "No estuvo mal. Otra vez, sin dudar.",
  "Eso ya lo tienes. Sube el estándar.",
  "Bien. No te enamores del acierto.",
  "Lo defendiste. Eso pesa más que acertar.",
  "Suficiente. Ahora hazlo cuando estés cansado.",
  "El muro cedió. Recuerda cómo se sintió.",
  "Correcto — y sabes por qué, no solo que sí.",
  "Otra grieta cerrada. Sigue.",
];
// Lore fragments — imperial / arcane one-liners. Atmosphere, not instruction.
const LORE: readonly string[] = [
  "Un ladrillo más en la sala del trono.",
  "El que persiste graba su nombre en piedra.",
  "Ex scintilla, imperium.",
  "Lo aprendido no se pierde: se sedimenta.",
  "Cada error resuelto es una cicatriz que ilumina.",
  "La constancia es la única magia que no falla.",
];

/** Seeded RNG (mulberry32). src/lib may use it; the UI seeds from the clock so the variation feels alive. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// tier → the existing synthesized sfx (Bloque A). No new assets.
const SFX: Record<RewardTier, Sfx> = {
  micro: "step",
  small: "xp",
  medium: "lessonwin",
  large: "gate",
  ceremony: "ascension",
};

const pick = <T,>(arr: readonly T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)]!;

/** Decide the flourish for a tier. Deterministic given the seed; the caller varies the seed per action. */
export function pickReward(tier: RewardTier, seed: number): Reward {
  const rng = mulberry32(seed);
  const r = rng();
  const base: Reward = { tier, sfx: SFX[tier], glint: false, particles: 0, ring: false, extra: null };
  switch (tier) {
    case "micro":
      // mostly clean — a step should feel light. A glint often, a mote rarely, never text.
      base.glint = r < 0.55;
      base.particles = r > 0.85 ? 1 : 0;
      break;
    case "small":
      base.glint = true;
      base.particles = r < 0.5 ? 2 : 3;
      base.extra = r > 0.9 ? { kind: "asuka", text: pick(ASUKA, rng) } : null;
      break;
    case "medium":
      base.glint = true;
      base.ring = true;
      base.particles = 4 + Math.floor(rng() * 4);
      base.extra = r < 0.34 ? { kind: "asuka", text: pick(ASUKA, rng) } : r < 0.54 ? { kind: "lore", text: pick(LORE, rng) } : r < 0.7 ? { kind: "glow" } : null; // ~30% nothing extra
      break;
    case "large":
      base.glint = true;
      base.ring = true;
      base.particles = 8 + Math.floor(rng() * 6);
      base.extra = r < 0.5 ? { kind: "asuka", text: pick(ASUKA, rng) } : r < 0.82 ? { kind: "lore", text: pick(LORE, rng) } : { kind: "glow" };
      break;
    case "ceremony":
      base.glint = true;
      base.ring = true;
      base.particles = 16;
      base.extra = { kind: "lore", text: pick(LORE, rng) };
      break;
  }
  return base;
}
