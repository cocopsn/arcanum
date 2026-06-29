import { ARCANUM_CONFIG } from "@/core/config";

const M = ARCANUM_CONFIG.mastery;

export interface MasteryState {
  /** stability in days */
  S: number;
  /** last reinforced, in epoch-days (ms / 86_400_000) */
  lastDays: number;
  /** clock-free time (epoch-days) when r crosses reviewThreshold */
  dueDays: number;
}

/** bonus = bonusBase + bonusQualityWeight * clamp(quality, 0..1) (spec §6.4). */
export function bonusFor(quality: number): number {
  const q = Math.min(Math.max(quality, 0), 1);
  return M.bonusBase + M.bonusQualityWeight * q;
}

/** due = last + (-S * ln(threshold)). Depends only on event data → clock-free. */
export function dueDaysFor(
  S: number,
  lastDays: number,
  threshold: number = M.reviewThreshold,
): number {
  return lastDays + -S * Math.log(threshold);
}

/** Mastery at module.started: S0, last = start (spec §6.4). */
export function initialMastery(startDays: number): MasteryState {
  return {
    S: M.S0,
    lastDays: startDays,
    dueDays: dueDaysFor(M.S0, startDays),
  };
}

/** Apply a reinforcing event: S grows by (1+bonus), last/due update. */
export function reinforce(
  state: { S: number; lastDays: number },
  quality: number,
  tsDays: number,
): MasteryState {
  const S = state.S * (1 + bonusFor(quality));
  return { S, lastDays: tsDays, dueDays: dueDaysFor(S, tsDays) };
}

/** Retrievability r(now) = exp(-(now-last)/S). Presentation-only (takes now). */
export function retrievability(S: number, lastDays: number, nowDays: number): number {
  return Math.exp(-(nowDays - lastDays) / S);
}
