import type {
  ArcanumEvent,
  SessionEndedPayload,
  NoteCreatedPayload,
} from "@/core/event";
import type { ReadModel } from "@/core/read-model";
import { retrievability } from "@/core/mastery";
import { msToDays } from "@/core/time";
import { ARCANUM_CONFIG } from "@/core/config";

export interface DayDigest {
  fromMs: number;
  toMs: number;
  errorsResolved: number;
  checkpointsPassed: number;
  modulesCompleted: number;
  sessionMinutes: number;
  notesCreated: number;
  /** note titles created in the window — seed for AI axiom/connection proposals */
  noteTitles: string[];
}

/**
 * Pure fold over the last 24h (window ends at `nowMs`). Local derivation only —
 * the AI enrichment (patterns/axioms) is layered on top by the Sleep Cycle, and
 * the review_queue comes from present(readModel, now). `nowMs` is explicit.
 */
export function foldLast24h(events: ArcanumEvent[], nowMs: number): DayDigest {
  const fromMs = nowMs - 24 * 60 * 60 * 1000;
  let errorsResolved = 0;
  let checkpointsPassed = 0;
  let modulesCompleted = 0;
  let sessionMs = 0;
  let notesCreated = 0;
  const noteTitles: string[] = [];

  for (const e of events) {
    if (e.ts < fromMs || e.ts > nowMs) continue;
    switch (e.type) {
      case "error.resolved":
        errorsResolved++;
        break;
      case "checkpoint.passed":
        checkpointsPassed++;
        break;
      case "module.completed":
        modulesCompleted++;
        break;
      case "session.ended":
        sessionMs += Number((e.payload as unknown as SessionEndedPayload).duration_ms) || 0;
        break;
      case "note.created": {
        notesCreated++;
        const t = (e.payload as unknown as NoteCreatedPayload).title;
        if (t) noteTitles.push(t);
        break;
      }
      default:
        break;
    }
  }

  return {
    fromMs,
    toMs: nowMs,
    errorsResolved,
    checkpointsPassed,
    modulesCompleted,
    sessionMinutes: Math.round(sessionMs / 60000),
    notesCreated,
    noteTitles,
  };
}

export interface ReviewContextItem {
  moduleId: string;
  title: string;
  daysOverdue: number;
}
export interface StalledContextItem {
  moduleId: string;
  title: string;
  daysSinceReinforce: number;
}
export interface AtRiskContextItem {
  moduleId: string;
  title: string;
  /** r(now) ∈ [0,1] */
  retrievability: number;
  /** days until r crosses the review threshold (negative = already below) */
  daysToThreshold: number;
  /** titles of unfinished modules this one gates */
  blocks: string[];
}

/**
 * The actionable context the Sleep Cycle hands the model — NOT just the last 24h,
 * but what's decaying and what it blocks. Pure; `nowMs` explicit. Derived from the
 * read-model so it's reconstructible and testable.
 */
export interface SleepContext {
  digest: DayDigest;
  reviewQueue: ReviewContextItem[];
  stalled: StalledContextItem[];
  atRisk: AtRiskContextItem[];
}

export interface SleepSignals {
  reviewQueue: ReviewContextItem[];
  stalled: StalledContextItem[];
  atRisk: AtRiskContextItem[];
}

/** The decay/risk signals derived from the read-model (no 24h events needed) —
 *  usable live in the UI and composed into the full context for the rite. Pure. */
export function deriveSleepSignals(rm: ReadModel, nowMs: number): SleepSignals {
  const nowDays = msToDays(nowMs);
  const { stallDays, riskWindowDays } = ARCANUM_CONFIG.sleepCycle;

  const byId = new Map(rm.modules.map((m) => [m.id, m]));
  const title = (id: string) => byId.get(id)?.title ?? "(módulo)";

  // Overdue reviews (completed modules whose retention has lapsed), worst first.
  const reviewQueue: ReviewContextItem[] = rm.reviewDue
    .filter((r) => r.dueDays <= nowDays)
    .map((r) => ({ moduleId: r.moduleId, title: title(r.moduleId), daysOverdue: Math.round(nowDays - r.dueDays) }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  // Started but cold: in progress, no reinforcement in `stallDays`.
  const stalled: StalledContextItem[] = rm.modules
    .filter((m) => m.status === "started" && !m.archived && nowDays - m.lastReinforcedDays >= stallDays)
    .map((m) => ({ moduleId: m.id, title: m.title, daysSinceReinforce: Math.round(nowDays - m.lastReinforcedDays) }))
    .sort((a, b) => b.daysSinceReinforce - a.daysSinceReinforce);

  // Prereqs about to (or already) lapse below threshold that GATE unfinished work.
  const blocksOf = (id: string) =>
    rm.edges
      .filter((e) => e.from === id && byId.get(e.to) && byId.get(e.to)!.status !== "completed" && !byId.get(e.to)!.archived)
      .map((e) => title(e.to));

  const atRisk: AtRiskContextItem[] = rm.modules
    .filter((m) => !m.archived && (m.status === "completed" || m.status === "started"))
    .map((m) => ({ m, blocks: blocksOf(m.id) }))
    .filter(({ m, blocks }) => blocks.length > 0 && m.dueDays - nowDays <= riskWindowDays)
    .map(({ m, blocks }) => ({
      moduleId: m.id,
      title: m.title,
      retrievability: retrievability(m.S, m.lastReinforcedDays, nowDays),
      daysToThreshold: Math.round(m.dueDays - nowDays),
      blocks,
    }))
    .sort((a, b) => a.daysToThreshold - b.daysToThreshold);

  return { reviewQueue, stalled, atRisk };
}

/** Full context the rite hands the model: the 24h fold + the decay/risk signals. */
export function buildSleepContext(events: ArcanumEvent[], rm: ReadModel, nowMs: number): SleepContext {
  return { digest: foldLast24h(events, nowMs), ...deriveSleepSignals(rm, nowMs) };
}
