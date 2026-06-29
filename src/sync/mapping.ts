import type { ArcanumEvent, EventType, Json } from "@/core/event";

/** The Supabase `events` row shape. Server-only fields appear on read. */
export interface EventRow {
  id: string;
  type: string;
  ts: number;
  device_id: string;
  goal_id: string | null;
  module_id: string | null;
  payload: Json;
  v: number;
  // server-assigned, present only on pull:
  seq?: number;
  user_id?: string;
  created_at?: string;
}

/**
 * Envelope → push row. MUST omit `user_id` entirely so Postgres applies the
 * column default `auth.uid()` (an explicit null would violate NOT NULL). Spec §7.1.
 */
export function toRow(e: ArcanumEvent): EventRow {
  return {
    id: e.id,
    type: e.type,
    ts: e.ts,
    device_id: e.device_id,
    goal_id: e.goal_id,
    module_id: e.module_id,
    payload: e.payload,
    v: e.v,
  };
}

/** Pull row → clean envelope. Drops server-only user_id / seq / created_at. */
export function fromRow(r: EventRow): ArcanumEvent {
  return {
    id: r.id,
    type: r.type as EventType,
    ts: r.ts,
    device_id: r.device_id,
    goal_id: r.goal_id,
    module_id: r.module_id,
    payload: r.payload,
    v: r.v,
  };
}
