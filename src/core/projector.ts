import {
  compareEvents,
  type ArcanumEvent,
  type GoalUpsertedPayload,
  type ModuleUpsertedPayload,
  type EdgeUpsertedPayload,
  type NodeArchivedPayload,
  type SessionEndedPayload,
  type CheckpointPassedPayload,
  type NoteCreatedPayload,
  type NoteUpdatedPayload,
  type SleepcycleGeneratedPayload,
  type FiretestAttemptedPayload,
  type NodeMovedPayload,
  type CanvasSyncedPayload,
  type ObligationInput,
  type GradeCelebratedPayload,
  type ModuleEvaluatedPayload,
  type GateEvaluatedPayload,
  type MissionSubmittedPayload,
} from "@/core/event";
import { parseWikilinks } from "@/core/wikilink";
import { wouldCreateCycle } from "@/core/roadmap";
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
import type {
  ReadModel,
  Goal,
  ModuleRM,
  Edge,
  ReviewItem,
  NoteRM,
  SleepCycleRM,
  ObligationRM,
  CanvasStatusRM,
  EvaluationRM,
  GateRM,
  MissionRM,
} from "@/core/read-model";

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

/**
 * Tolerant parse of one scraped obligation — degrade field-by-field, never throw.
 * A row missing a usable id or title is dropped (honest: we don't show junk).
 */
function sanitizeObligation(o: ObligationInput, fetchedTs: number): ObligationRM | null {
  if (!o || typeof o !== "object") return null;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const title = typeof o.title === "string" ? o.title.trim() : "";
  if (!id || !title) return null;
  // null/undefined/non-number/NaN → null (Number(null) is 0, NOT NaN — must guard
  // explicitly or a missing due date becomes 1970 and reads as "overdue").
  const dueTs = typeof o.due_ts === "number" && Number.isFinite(o.due_ts) ? o.due_ts : null;
  return {
    id,
    title,
    course: typeof o.course === "string" ? o.course : "",
    dueTs,
    status: typeof o.status === "string" && o.status ? o.status : "pending",
    source: "canvas",
    url: typeof o.url === "string" ? o.url : null,
    fetchedTs,
    promotedModuleId: null, // derived at assemble
  };
}

interface Acc {
  goals: Map<string, Goal>;
  modules: Map<string, ModuleRM>;
  edges: Edge[];
  edgeSet: Set<string>;
  notes: Map<string, NoteRM>;
  sleepCycles: SleepCycleRM[];
  totalXp: number;
  /** Canvas obligations from the last OK snapshot (Fase 4) */
  canvasObligations: ObligationRM[];
  canvasLastSyncTs: number | null;
  canvasLastOkTs: number | null;
  canvasCookieStale: boolean;
  /** highest acknowledged grade index from grade.celebrated events, or null (Fase 4) */
  celebratedGrade: number | null;
  /** latest evaluation per module (Bloque 5) */
  evaluations: Map<string, EvaluationRM>;
  /** latest exit-gate verdict per cell (WHITE ROOM) */
  gates: Map<string, GateRM>;
  /** latest mission evidence per heavy cell (kind:'mission') */
  missions: Map<string, MissionRM>;
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
          // A heavy MISSION cell can never be silently DEMOTED to a plain cell by a
          // later/stray/synced upsert — its block on the next node depends on kind, so
          // the designation is monotonic (fail-closed on EVERY fold, like the DAG guard).
          kind: prev.kind === "mission" && p.kind !== "mission" ? prev.kind : p.kind,
          prereqs: p.prereqs ?? [],
          // Preserve the prior goal when a rename-style re-upsert omits goal_id —
          // never silently detach the module from its lane (defensive, like notes).
          goalId: e.goal_id ?? prev.goalId,
          sourceObligationId: p.sourceObligationId ?? prev.sourceObligationId,
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
          firetestRatio: null,
          x: null,
          y: null,
          sourceObligationId: p.sourceObligationId ?? null,
          gatePassed: false,
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
      // Defense-in-depth: the DAG invariant is enforced on EVERY fold, not just by
      // the UI's onConnect guard — a cycle-creating edge (incl. self-loop) never
      // materializes in the read-model regardless of how it reached the log.
      if (!acc.edgeSet.has(key) && !wouldCreateCycle(acc.edges, p.from, p.to)) {
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
    case "note.created": {
      const p = e.payload as unknown as NoteCreatedPayload;
      const id = p.note_id;
      if (!id) return;
      const prev = acc.notes.get(id);
      acc.notes.set(id, {
        id,
        moduleId: prev?.moduleId ?? e.module_id,
        goalId: prev?.goalId ?? e.goal_id,
        title: p.title ?? "",
        markdown: p.markdown ?? "",
        links: [],
        backlinks: [],
        createdTs: prev?.createdTs ?? e.ts,
        updatedTs: e.ts,
      });
      return;
    }
    case "note.updated": {
      const p = e.payload as unknown as NoteUpdatedPayload;
      const prev = acc.notes.get(p.note_id);
      if (!prev) return;
      acc.notes.set(p.note_id, {
        ...prev,
        title: p.title ?? prev.title,
        markdown: p.markdown ?? prev.markdown,
        updatedTs: e.ts,
      });
      return;
    }
    case "firetest.attempted": {
      const id = e.module_id;
      const prev = id ? acc.modules.get(id) : undefined;
      if (!id || !prev) return;
      const p = e.payload as unknown as FiretestAttemptedPayload;
      const ceiling = Number(p.ceiling);
      const reached = Number(p.reached);
      if (!Number.isFinite(ceiling) || ceiling <= 0 || !Number.isFinite(reached)) return;
      const ratio = Math.min(1, Math.max(0, reached / ceiling));
      acc.modules.set(id, { ...prev, firetestRatio: Math.max(prev.firetestRatio ?? 0, ratio) });
      return;
    }
    case "roadmap.node.moved": {
      const p = e.payload as unknown as NodeMovedPayload;
      const prev = acc.modules.get(p.ref);
      if (!prev) return;
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
      acc.modules.set(p.ref, { ...prev, x: p.x, y: p.y });
      return;
    }
    case "canvas.synced": {
      // Full snapshot. Events fold in ts order → the LAST canvas.synced wins for
      // attempt status; the last OK one wins for the obligation set + data age.
      // A failed scrape (cookie expired) keeps the last good data and flags stale.
      const p = e.payload as unknown as CanvasSyncedPayload;
      const fetchedTs = Number(p.fetched_ts);
      if (!Number.isFinite(fetchedTs)) return;
      acc.canvasLastSyncTs = fetchedTs;
      acc.canvasCookieStale = !p.ok;
      if (p.ok && Array.isArray(p.obligations)) {
        acc.canvasObligations = p.obligations
          .map((o) => sanitizeObligation(o, fetchedTs))
          .filter((o): o is ObligationRM => o !== null);
        acc.canvasLastOkTs = fetchedTs;
      }
      return;
    }
    case "sleepcycle.generated": {
      const p = e.payload as unknown as SleepcycleGeneratedPayload;
      acc.sleepCycles.push({ id: e.id, day: p.day, ts: e.ts, digest: p.digest, context: p.context ?? null, ai: p.ai });
      return;
    }
    case "grade.celebrated": {
      const idx = Number((e.payload as unknown as GradeCelebratedPayload).index);
      if (!Number.isFinite(idx)) return;
      acc.celebratedGrade = Math.max(acc.celebratedGrade ?? -1, idx);
      return;
    }
    case "gate.evaluated": {
      const id = e.module_id;
      if (!id) return;
      const p = e.payload as unknown as GateEvaluatedPayload;
      const passed = p.passed === true;
      acc.gates.set(id, {
        moduleId: id,
        passed,
        score: typeof p.score === "number" && Number.isFinite(p.score) ? p.score : null,
        summary: typeof p.summary === "string" ? p.summary : "",
        feedback: typeof p.feedback === "string" ? p.feedback : "",
        source: p.source === "ai" ? "ai" : "heuristic",
        provider: typeof p.provider === "string" ? p.provider : null,
        questions: Array.isArray(p.questions) ? p.questions.map(String) : [],
        ts: e.ts,
      });
      // gatePassed is MONOTONIC — once the cell's gate is passed it stays open
      // (a later re-evaluation can't re-seal what was already demonstrated).
      const mod = acc.modules.get(id);
      if (mod && passed && !mod.gatePassed) acc.modules.set(id, { ...mod, gatePassed: true });
      return;
    }
    case "mission.submitted": {
      const id = e.module_id;
      if (!id) return;
      const p = e.payload as unknown as MissionSubmittedPayload;
      // latest evidence per cell wins (fold order = ts order) — durable proof of work
      acc.missions.set(id, {
        moduleId: id,
        notes: typeof p.notes === "string" ? p.notes : "",
        ts: e.ts,
      });
      return;
    }
    case "module.evaluated": {
      const id = e.module_id;
      if (!id) return;
      const p = e.payload as unknown as ModuleEvaluatedPayload;
      // last evaluation per module wins (fold order = ts order)
      acc.evaluations.set(id, {
        moduleId: id,
        summary: typeof p.summary === "string" ? p.summary : "",
        strengths: Array.isArray(p.strengths) ? p.strengths.map(String) : [],
        gaps: Array.isArray(p.gaps) ? p.gaps.map(String) : [],
        challenge: typeof p.challenge === "string" ? p.challenge : "",
        score: typeof p.score === "number" && Number.isFinite(p.score) ? p.score : null,
        source: p.source === "ai" ? "ai" : "heuristic",
        provider: typeof p.provider === "string" ? p.provider : null,
        ts: e.ts,
      });
      return;
    }
    default:
      return;
  }
}

/** Derive the note graph: links from markdown, then bidirectional backlinks. */
function finalizeNotes(notes: NoteRM[]): NoteRM[] {
  const withLinks = notes.map((n) => ({
    ...n,
    links: parseWikilinks(n.markdown),
    backlinks: [] as string[],
  }));
  const titleToId = new Map<string, string>();
  for (const n of withLinks) titleToId.set(n.title, n.id); // last wins on title clash
  const byId = new Map(withLinks.map((n) => [n.id, n]));
  for (const n of withLinks) {
    for (const target of n.links) {
      const targetId = titleToId.get(target);
      if (targetId && targetId !== n.id) {
        const t = byId.get(targetId)!;
        if (!t.backlinks.includes(n.id)) t.backlinks.push(n.id);
      }
    }
  }
  return withLinks;
}

function emptyAcc(): Acc {
  return {
    goals: new Map(),
    modules: new Map(),
    edges: [],
    edgeSet: new Set(),
    notes: new Map(),
    sleepCycles: [],
    totalXp: 0,
    canvasObligations: [],
    canvasLastSyncTs: null,
    canvasLastOkTs: null,
    canvasCookieStale: false,
    celebratedGrade: null,
    evaluations: new Map(),
    gates: new Map(),
    missions: new Map(),
  };
}

function accFromModel(prev: ReadModel): Acc {
  return {
    goals: new Map(prev.goals.map((g) => [g.id, g])),
    modules: new Map(prev.modules.map((m) => [m.id, m])),
    edges: [...prev.edges],
    edgeSet: new Set(prev.edges.map((e) => `${e.from}|${e.to}`)),
    notes: new Map(prev.notes.map((n) => [n.id, n])),
    sleepCycles: [...prev.sleepCycles],
    totalXp: prev.stats.totalXp,
    // promotedModuleId is DERIVED at assemble → carry the raw set forward.
    canvasObligations: prev.obligations.map((o) => ({ ...o, promotedModuleId: null })),
    canvasLastSyncTs: prev.canvas.lastSyncTs,
    canvasLastOkTs: prev.canvas.lastOkTs,
    canvasCookieStale: prev.canvas.cookieStale,
    celebratedGrade: prev.celebratedGrade,
    evaluations: new Map(prev.evaluations.map((ev) => [ev.moduleId, ev])),
    gates: new Map(prev.gates.map((g) => [g.moduleId, g])),
    missions: new Map(prev.missions.map((m) => [m.moduleId, m])),
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
  // Promotion is DERIVED: an obligation is "ascended" iff a live module links to it.
  const promotedByObligation = new Map<string, string>();
  for (const m of modules) {
    if (m.sourceObligationId && !m.archived) promotedByObligation.set(m.sourceObligationId, m.id);
  }
  const obligations: ObligationRM[] = acc.canvasObligations.map((o) => ({
    ...o,
    promotedModuleId: promotedByObligation.get(o.id) ?? null,
  }));
  const canvas: CanvasStatusRM = {
    lastSyncTs: acc.canvasLastSyncTs,
    lastOkTs: acc.canvasLastOkTs,
    cookieStale: acc.canvasCookieStale,
  };
  return {
    goals: [...acc.goals.values()],
    modules,
    edges: [...acc.edges],
    notes: finalizeNotes([...acc.notes.values()]),
    sleepCycles: [...acc.sleepCycles],
    obligations,
    canvas,
    celebratedGrade: acc.celebratedGrade,
    evaluations: [...acc.evaluations.values()],
    gates: [...acc.gates.values()],
    missions: [...acc.missions.values()],
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
