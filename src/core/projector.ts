import {
  compareEvents,
  type ArcanumEvent,
  type GoalUpsertedPayload,
  type ModuleUpsertedPayload,
  type EdgeUpsertedPayload,
  type NodeArchivedPayload,
  type SessionEndedPayload,
  type CheckpointPassedPayload,
} from "@/core/event";
import { ARCANUM_CONFIG } from "@/core/config";
import { civilDayOrdinal, msToDays } from "@/core/time";
import { xpBase, streakMultiplier } from "@/core/xp";
import { gradeForXp } from "@/core/grade";
import {
  streakTimeline,
  streakAsOfDay,
  type StreakState,
  type StreakResult,
} from "@/core/streak";
import { initialMastery, reinforce } from "@/core/mastery";
import type { ReadModel, Goal, ModuleRM, Edge, ReviewItem } from "@/core/read-model";

const TZ = ARCANUM_CONFIG.tz;
const M = ARCANUM_CONFIG.mastery;

function isQualifying(e: ArcanumEvent): boolean {
  if (e.type === "error.resolved" || e.type === "checkpoint.passed") return true;
  if (e.type === "session.ended") {
    return (
      (e.payload as unknown as SessionEndedPayload).duration_ms >=
      ARCANUM_CONFIG.xp.sessionMinMs
    );
  }
  return false;
}

function reinforcementQuality(e: ArcanumEvent): number | null {
  if (e.type === "checkpoint.passed") {
    const p = e.payload as unknown as CheckpointPassedPayload;
    const raw = p.kind === "project" ? p.quality ?? M.defaultQuality : p.score;
    // Malformed jsonb (missing/NaN score) must NOT poison S with sticky NaN.
    return Number.isFinite(raw) ? Number(raw) : M.defaultQuality;
  }
  if (e.type === "error.resolved") return M.defaultQuality;
  return null;
}

interface Acc {
  goals: Map<string, Goal>;
  modules: Map<string, ModuleRM>;
  edges: Edge[];
  edgeSet: Set<string>;
  totalXp: number;
}

function applyDomain(acc: Acc, e: ArcanumEvent): void {
  switch (e.type) {
    case "goal.upserted": {
      const id = e.goal_id;
      if (!id) return;
      const p = e.payload as unknown as GoalUpsertedPayload;
      const prev = acc.goals.get(id);
      acc.goals.set(id, {
        id,
        title: p.title,
        priority: p.priority,
        color: p.color,
        sigil: p.sigil,
        archived: prev?.archived ?? false,
      });
      return;
    }
    case "module.upserted": {
      const id = e.module_id;
      if (!id) return;
      const p = e.payload as unknown as ModuleUpsertedPayload;
      const prev = acc.modules.get(id);
      if (prev) {
        acc.modules.set(id, {
          ...prev,
          title: p.title,
          kind: p.kind,
          prereqs: p.prereqs ?? [],
          goalId: e.goal_id,
        });
      } else {
        const m = initialMastery(msToDays(e.ts));
        acc.modules.set(id, {
          id,
          goalId: e.goal_id,
          title: p.title,
          status: "idle",
          kind: p.kind,
          prereqs: p.prereqs ?? [],
          S: m.S,
          lastReinforcedDays: m.lastDays,
          dueDays: m.dueDays,
          startedDays: null,
          archived: false,
        });
      }
      return;
    }
    case "module.started": {
      const id = e.module_id;
      const prev = id ? acc.modules.get(id) : undefined;
      if (!id || !prev) return;
      const startDays = msToDays(e.ts);
      const m = initialMastery(startDays);
      acc.modules.set(id, {
        ...prev,
        status: "started",
        startedDays: startDays,
        S: m.S,
        lastReinforcedDays: m.lastDays,
        dueDays: m.dueDays,
      });
      return;
    }
    case "module.completed": {
      const id = e.module_id;
      const prev = id ? acc.modules.get(id) : undefined;
      if (!id || !prev) return;
      acc.modules.set(id, { ...prev, status: "completed" });
      return;
    }
    case "error.resolved":
    case "checkpoint.passed": {
      const id = e.module_id;
      const prev = id ? acc.modules.get(id) : undefined;
      const quality = reinforcementQuality(e);
      if (!id || !prev || quality === null) return;
      const m = reinforce(
        { S: prev.S, lastDays: prev.lastReinforcedDays },
        quality,
        msToDays(e.ts),
      );
      acc.modules.set(id, {
        ...prev,
        S: m.S,
        lastReinforcedDays: m.lastDays,
        dueDays: m.dueDays,
      });
      return;
    }
    case "roadmap.edge.upserted": {
      const p = e.payload as unknown as EdgeUpsertedPayload;
      const key = `${p.from}|${p.to}`;
      if (!acc.edgeSet.has(key)) {
        acc.edgeSet.add(key);
        acc.edges.push({ from: p.from, to: p.to });
      }
      return;
    }
    case "node.archived": {
      const ref = (e.payload as unknown as NodeArchivedPayload).ref;
      const g = acc.goals.get(ref);
      if (g) {
        acc.goals.set(ref, { ...g, archived: true });
        return;
      }
      const mod = acc.modules.get(ref);
      if (mod) acc.modules.set(ref, { ...mod, archived: true });
      return;
    }
    default:
      return;
  }
}

function emptyAcc(): Acc {
  return {
    goals: new Map(),
    modules: new Map(),
    edges: [],
    edgeSet: new Set(),
    totalXp: 0,
  };
}

function accFromModel(prev: ReadModel): Acc {
  return {
    goals: new Map(prev.goals.map((g) => [g.id, g])),
    modules: new Map(prev.modules.map((m) => [m.id, m])),
    edges: [...prev.edges],
    edgeSet: new Set(prev.edges.map((e) => `${e.from}|${e.to}`)),
    totalXp: prev.stats.totalXp,
  };
}

function assemble(
  acc: Acc,
  streakState: StreakState,
  qualifiedDays: number[],
  last: { ts: number; id: string } | null,
): ReadModel {
  const modules = [...acc.modules.values()];
  const grade = gradeForXp(acc.totalXp);
  const reviewDue: ReviewItem[] = modules
    .filter((m) => m.status === "completed" && !m.archived)
    .map((m) => ({ moduleId: m.id, dueDays: m.dueDays }));
  return {
    goals: [...acc.goals.values()],
    modules,
    edges: [...acc.edges],
    qualifiedDays,
    stats: {
      totalXp: acc.totalXp,
      grade: grade.name,
      gradeIndex: grade.index,
      currentStreak: streakState.current,
      longestStreak: streakState.longest,
      shields: streakState.shields,
      lastQualifiedDay: streakState.lastQualifiedDay,
    },
    reviewDue,
    cursor: last,
  };
}

/** Phase 2: fold events for domain + XP (each event uses its day's closed streak). */
function foldInto(acc: Acc, sortedEvents: ArcanumEvent[], tl: StreakResult): void {
  for (const e of sortedEvents) {
    applyDomain(acc, e);
    const base = xpBase(e);
    if (base !== 0) {
      const streak = streakAsOfDay(tl, civilDayOrdinal(e.ts, TZ));
      acc.totalXp += Math.round(base * streakMultiplier(streak));
    }
  }
}

function qualifiedDaysOf(events: ArcanumEvent[]): number[] {
  const out: number[] = [];
  for (const e of events) {
    if (isQualifying(e)) out.push(civilDayOrdinal(e.ts, TZ));
  }
  return out;
}

/** Full pure two-phase fold of the entire log into a ReadModel (spec §5, §6.1). */
export function project(events: ArcanumEvent[]): ReadModel {
  const sorted = [...events].sort(compareEvents);
  const tl = streakTimeline(qualifiedDaysOf(sorted));
  const acc = emptyAcc();
  foldInto(acc, sorted, tl);
  const last = sorted.length ? sorted[sorted.length - 1]! : null;
  return assemble(acc, tl.state, tl.sortedDays, last ? { ts: last.ts, id: last.id } : null);
}

/**
 * Incremental continuation. PRECONDITION (guaranteed by applyEvents): every event
 * in `sortedNew` lands on a civil day strictly newer than `prev`'s cursor day and
 * in order, so no already-closed day's streak/XP can shift. We recompute the
 * whole streak timeline (cheap — over qualified-day ordinals) so streak/shield
 * correctness can never drift, and carry totalXp/domain forward from `prev`.
 */
function incrementalProject(prev: ReadModel, sortedNew: ArcanumEvent[]): ReadModel {
  const tl = streakTimeline([...prev.qualifiedDays, ...qualifiedDaysOf(sortedNew)]);
  const acc = accFromModel(prev);
  foldInto(acc, sortedNew, tl);
  const last = sortedNew[sortedNew.length - 1]!;
  return assemble(acc, tl.state, tl.sortedDays, { ts: last.ts, id: last.id });
}

export interface ApplyResult {
  model: ReadModel;
  rebuilt: boolean;
}

export interface ApplyDeps {
  fullProject?: (events: ArcanumEvent[]) => ReadModel;
}

/**
 * Apply a batch of newly-arrived events on top of a prior read-model.
 * Fast-path (rebuilt=false): the batch lands entirely on civil days strictly
 * newer than the cursor's day, in order → continue the fold without touching old
 * events. Otherwise (out-of-order, or same-day-as-cursor) → full rebuild so that
 * `incremental == rebuild` always holds (spec §5).
 */
export function applyEvents(
  prev: ReadModel | null,
  newEvents: ArcanumEvent[],
  allEvents: ArcanumEvent[],
  deps: ApplyDeps = {},
): ApplyResult {
  const fullProject = deps.fullProject ?? project;
  if (!prev || prev.cursor === null) {
    return { model: fullProject(allEvents), rebuilt: true };
  }
  const sortedNew = [...newEvents].sort(compareEvents);
  if (sortedNew.length === 0) {
    return { model: prev, rebuilt: false };
  }
  const cursor = prev.cursor;
  const cursorDay = civilDayOrdinal(cursor.ts, TZ);
  const outOfOrder = sortedNew.some((e) => compareEvents(e, cursor) <= 0);
  const allNewerDay = sortedNew.every((e) => civilDayOrdinal(e.ts, TZ) > cursorDay);
  if (outOfOrder || !allNewerDay) {
    return { model: fullProject(allEvents), rebuilt: true };
  }
  return { model: incrementalProject(prev, sortedNew), rebuilt: false };
}
