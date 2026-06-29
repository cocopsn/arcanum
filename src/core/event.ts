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
}
export interface EdgeUpsertedPayload {
  from: string;
  to: string;
}
export interface NodeArchivedPayload {
  ref: string;
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
  /** AI enrichment, or null when no provider was available (honest degradation) */
  ai: { provider: string; patterns: string; axioms: string } | null;
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
