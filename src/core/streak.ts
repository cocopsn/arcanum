import { ARCANUM_CONFIG } from "@/core/config";

export interface StreakState {
  current: number;
  longest: number;
  shields: number;
  /** qualified days in the live streak — drives shield grants, resets on break */
  qdCount: number;
  /** ordinal of the last qualified day, or null if none */
  lastQualifiedDay: number | null;
}

export interface StreakResult {
  /** ordinal → closed streak value on that qualified day (XP phase 2) */
  closedStreakByDay: Map<number, number>;
  /** ordinal → shields available right after that qualified day */
  shieldsByDay: Map<number, number>;
  /** sorted unique qualified-day ordinals */
  sortedDays: number[];
  state: StreakState;
}

/**
 * Deterministic streak + shields over the set of qualified-day ordinals
 * (spec §6.3). Each gap day consumes one shield; gap>shields breaks (current,
 * shields, qdCount → 0). Absorbed gaps do NOT increment the streak. A shield is
 * earned each time qdCount crosses a multiple of shieldEvery (capped, over-cap
 * dropped). qdCount resets only on break.
 */
export function streakTimeline(qualifiedDayOrdinals: number[]): StreakResult {
  const { shieldEvery, shieldMax } = ARCANUM_CONFIG.streak;
  const sortedDays = [...new Set(qualifiedDayOrdinals)].sort((a, b) => a - b);
  const closedStreakByDay = new Map<number, number>();
  const shieldsByDay = new Map<number, number>();

  let current = 0;
  let longest = 0;
  let shields = 0;
  let qdCount = 0;
  let prev: number | null = null;

  for (const day of sortedDays) {
    if (prev !== null) {
      const gap = day - prev - 1; // civil days strictly between
      if (gap > 0) {
        if (gap <= shields) {
          shields -= gap;
        } else {
          current = 0;
          shields = 0;
          qdCount = 0;
        }
      }
    }

    current += 1;
    qdCount += 1;
    if (qdCount % shieldEvery === 0 && shields < shieldMax) {
      shields += 1;
    }
    if (current > longest) longest = current;

    closedStreakByDay.set(day, current);
    shieldsByDay.set(day, shields);
    prev = day;
  }

  return {
    closedStreakByDay,
    shieldsByDay,
    sortedDays,
    state: { current, longest, shields, qdCount, lastQualifiedDay: prev },
  };
}

/**
 * Streak value as of the close of an arbitrary civil day (qualified or not).
 * For a qualified day → its closed streak. For a non-qualified day → the carried
 * streak from the latest qualified day ≤ `day`, broken to 0 if the gap exceeds
 * the shields held at that day. Drives the XP multiplier for EVERY event
 * (including non-qualifying events on a qualified day, which still see the day's
 * closed streak — the spec §6.1 same-day invariant).
 */
export function streakAsOfDay(result: StreakResult, day: number): number {
  const { sortedDays, closedStreakByDay, shieldsByDay } = result;
  let q: number | null = null;
  for (const d of sortedDays) {
    if (d <= day) q = d;
    else break;
  }
  if (q === null) return 0;
  // q is drawn from sortedDays, so both maps are guaranteed to hold it.
  if (q === day) return closedStreakByDay.get(q)!;
  const missed = day - q;
  return missed <= shieldsByDay.get(q)! ? closedStreakByDay.get(q)! : 0;
}
