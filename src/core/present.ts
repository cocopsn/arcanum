import { retrievability } from "@/core/mastery";
import { msToDays, civilDayOrdinal } from "@/core/time";
import { ARCANUM_CONFIG } from "@/core/config";
import type { ReadModel, ReviewItem } from "@/core/read-model";

const TZ = ARCANUM_CONFIG.tz;

export interface ModuleView {
  id: string;
  /** r(now) ∈ (0,1] — sigil charge */
  retrievability: number;
}

export interface ViewModel {
  modules: ModuleView[];
  /** completed modules whose dueDays ≤ now, soonest first */
  reviewQueue: ReviewItem[];
  /** is the streak from the fold still alive given now? */
  streakAlive: boolean;
  /** has today's qualifying act NOT happened yet? */
  ritoPending: boolean;
  todayQualified: boolean;
}

/**
 * Pure presentation: everything the atemporal fold deliberately does NOT
 * compute (spec §6.5). `now` is an EXPLICIT parameter — never Date.now() here.
 */
export function present(rm: ReadModel, nowMs: number): ViewModel {
  const nowDays = msToDays(nowMs);
  const todayOrdinal = civilDayOrdinal(nowMs, TZ);

  const modules: ModuleView[] = rm.modules
    .filter((m) => !m.archived)
    .map((m) => ({
      id: m.id,
      retrievability: retrievability(m.S, m.lastReinforcedDays, nowDays),
    }));

  const reviewQueue: ReviewItem[] = rm.reviewDue
    .filter((r) => r.dueDays <= nowDays)
    .sort((a, b) => a.dueDays - b.dueDays);

  const todayQualified = rm.qualifiedDays.includes(todayOrdinal);

  return {
    modules,
    reviewQueue,
    streakAlive: streakAlive(rm, todayOrdinal),
    ritoPending: !todayQualified,
    todayQualified,
  };
}

function streakAlive(rm: ReadModel, todayOrdinal: number): boolean {
  const last = rm.stats.lastQualifiedDay;
  if (last === null || rm.stats.currentStreak === 0) return false;
  const missed = todayOrdinal - last;
  if (missed <= 0) return true;
  return missed <= rm.stats.shields;
}
