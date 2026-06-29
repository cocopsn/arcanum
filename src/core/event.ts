import { uuidv7 } from "uuidv7";

export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

export const EVENT_TYPES = [
  "goal.upserted",
  "module.upserted",
  "roadmap.edge.upserted",
  "node.archived",
  "module.started",
  "module.completed",
  "session.started",
  "session.ended",
  "error.logged",
  "error.resolved",
  "checkpoint.passed",
  "firetest.attempted",
  "note.created",
  "note.updated",
  "sleepcycle.generated",
  "roadmap.node.moved",
  "canvas.synced",
  "grade.celebrated",
  "module.evaluated",
  "gate.evaluated",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface ArcanumEvent {
  id: string;
  type: EventType;
  /** epoch ms, UTC */
  ts: number;
  device_id: string;
  goal_id: string | null;
  module_id: string | null;
  payload: Json;
  /** schema version of THIS event type */
  v: number;
}

// Per-type payload shapes (the envelope stores Json; consumers narrow to these).
export interface GoalUpsertedPayload {
  title: string;
  priority: number;
  color: string;
  sigil: string;
}
export interface ModuleUpsertedPayload {
  title: string;
  prereqs: string[];
  kind: string;
  /** set when a module was ASCENDED from a Canvas obligation (Fase 4) — links the
   *  learning module back to its compliance source so the agenda marks it promoted */
  sourceObligationId?: string;
}
export interface EdgeUpsertedPayload {
  from: string;
  to: string;
}
export interface NodeArchivedPayload {
  ref: string;
}
export interface NodeMovedPayload {
  /** module id */
  ref: string;
  x: number;
  y: number;
}
export type SessionKind = "error" | "project" | "review";
export interface SessionStartedPayload {
  kind: SessionKind;
}
export interface SessionEndedPayload {
  duration_ms: number;
  kind?: SessionKind;
}
export interface ErrorLoggedPayload {
  description: string;
}
export interface ErrorResolvedPayload {
  insight: string;
}
export interface CheckpointPassedPayload {
  score: number;
  kind?: "checkpoint" | "project";
  quality?: number;
}
export interface FiretestAttemptedPayload {
  reached: number;
  ceiling: number;
}
export interface NoteCreatedPayload {
  note_id: string;
  title: string;
  /** raw Obsidian-compatible markdown — the source of truth, lives in the log */
  markdown: string;
}
export interface NoteUpdatedPayload {
  note_id: string;
  title: string;
  markdown: string;
}
export interface SleepcycleGeneratedPayload {
  /** civil day (TZ) the rite folded over */
  day: string;
  /** local 24h fold summary (clock-free derivation) */
  digest: Json;
  /** actionable context handed to the model (review queue, stalled, at-risk) —
   *  Fase 4; optional for backward-compat with older sleepcycle events */
  context?: Json;
  /** AI enrichment, or null when no provider was available (honest degradation) */
  ai: { provider: string; patterns: string; axioms: string } | null;
}

/**
 * The ascension ceremony for a grade was acknowledged (Fase 4). In the LOG (not
 * device-local meta) so a grade is celebrated exactly ONCE across the whole
 * universe — once a device records it, every synced device sees it and never
 * re-fires. Idempotent under re-fold (celebratedGrade = max index).
 */
export interface GradeCelebratedPayload {
  index: number;
}

/**
 * An adversarial-but-fair evaluation of a module's mastery (Bloque 5). module_id is
 * in the envelope. Enters the LOG (auditable, reconstructible) — NOT mutable state.
 * Produced by the AI router (Asuka-style) or a local heuristic fallback (no IA).
 */
export interface ModuleEvaluatedPayload {
  summary: string;
  strengths: string[];
  gaps: string[];
  /** the adversarial push — a from-first-principles challenge on the weak spot */
  challenge: string;
  /** 0..1 mastery read, or null */
  score: number | null;
  source: "ai" | "heuristic";
  provider: string | null;
}

/**
 * An adversarial EXIT GATE verdict for a cell (WHITE ROOM). The gate has REAL power
 * over progression: only `passed:true` (granted by the rubric-anchored evaluator)
 * marks the cell mastered → unseals the next cell (fog-of-war). In the LOG —
 * auditable, reconstructible. The local heuristic NEVER auto-passes (honest: the
 * gate requires the evaluator); offline progression stays via firetest/completion.
 */
export interface GateEvaluatedPayload {
  passed: boolean;
  /** 0..1 rubric score, or null */
  score: number | null;
  /** one-line verdict */
  summary: string;
  /** the adversarial, actionable critique (why it (didn't) pass) */
  feedback: string;
  source: "ai" | "heuristic";
  provider: string | null;
}

/** One scraped Canvas obligation (compliance, NOT a mastery module). Fase 4. */
export interface ObligationInput {
  /** stable id from Canvas (e.g. `${courseId}:${assignmentId}`) */
  id: string;
  course: string;
  title: string;
  /** due date epoch ms, or null when Canvas has none */
  due_ts: number | null;
  /** Canvas status token, tolerant: pending|submitted|graded|late|missing|… */
  status: string;
  url?: string | null;
}

/**
 * Written by the n8n scraper (service-role insert) and pulled by the same sync.
 * Each event is a FULL snapshot of the current Canvas state. `ok:false` means the
 * scrape failed (cookie expired) — a NORMAL state: the projector keeps the last
 * good snapshot and flags the session stale, never an error.
 */
export interface CanvasSyncedPayload {
  /** when n8n scraped (epoch ms) — drives data-age/staleness in present() */
  fetched_ts: number;
  /** did this scrape succeed? false = cookie expired / Canvas unreachable */
  ok: boolean;
  /** the obligations snapshot (meaningful only when ok) */
  obligations: ObligationInput[];
}

export function newEventId(): string {
  return uuidv7();
}

/** Total order over the log: by ts, then by id (UUIDv7 → stable cross-device). */
export function compareEvents(
  a: Pick<ArcanumEvent, "ts" | "id">,
  b: Pick<ArcanumEvent, "ts" | "id">,
): number {
  if (a.ts !== b.ts) return a.ts - b.ts;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

export interface MakeEventOptions {
  ts: number;
  deviceId: string;
  goalId?: string | null;
  moduleId?: string | null;
  /** override for seed events (fixed UUIDs) */
  id?: string;
  v?: number;
}

export function makeEvent(
  type: EventType,
  payload: Json,
  opts: MakeEventOptions,
): ArcanumEvent {
  return {
    id: opts.id ?? newEventId(),
    type,
    ts: opts.ts,
    device_id: opts.deviceId,
    goal_id: opts.goalId ?? null,
    module_id: opts.moduleId ?? null,
    payload,
    v: opts.v ?? 1,
  };
}
