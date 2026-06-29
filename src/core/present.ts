import { retrievability } from "@/core/mastery";
import { msToDays, civilDayOrdinal } from "@/core/time";
import { ARCANUM_CONFIG } from "@/core/config";
import type { ReadModel, ReviewItem, CanvasStatusRM } from "@/core/read-model";

const TZ = ARCANUM_CONFIG.tz;
const HOUR = 3_600_000;
const DAY = 86_400_000;

export type Freshness = "none" | "fresh" | "recent" | "stale";

export interface CanvasFreshness {
  /** ms since the last SUCCESSFUL scrape, or null if never connected */
  ageMs: number | null;
  freshness: Freshness;
  /** the latest attempt failed (session expired) → showing last good data */
  cookieStale: boolean;
  lastOkTs: number | null;
}

/** Canvas data age derived from the fold + now (Fase 4). Pure; now explicit. */
export function canvasFreshness(c: CanvasStatusRM, nowMs: number): CanvasFreshness {
  const ageMs = c.lastOkTs === null ? null : Math.max(0, nowMs - c.lastOkTs);
  let freshness: Freshness = "none";
  if (ageMs !== null) freshness = ageMs < 6 * HOUR ? "fresh" : ageMs < DAY ? "recent" : "stale";
  return { ageMs, freshness, cookieStale: c.cookieStale, lastOkTs: c.lastOkTs };
}

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
  /** Canvas data freshness (Fase 4) — failure is a normal "stale" state */
  canvas: CanvasFreshness;
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
    canvas: canvasFreshness(rm.canvas, nowMs),
  };
}

function streakAlive(rm: ReadModel, todayOrdinal: number): boolean {
  const last = rm.stats.lastQualifiedDay;
  if (last === null || rm.stats.currentStreak === 0) return false;
  const missed = todayOrdinal - last;
  if (missed <= 0) return true;
  return missed <= rm.stats.shields;
}
