import { timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { ACCESS_EMAIL } from "@/lib/access";
import { fromRow, type EventRow } from "@/sync/mapping";
import { retrievability } from "@/core/mastery";
import { isMastered, nodeStatus } from "@/core/roadmap";
import { civilDayOrdinal, msToDays } from "@/core/time";
import { ARCANUM_CONFIG } from "@/core/config";
import type { ArcanumEvent } from "@/core/event";
import type { ReadModel, ModuleRM } from "@/core/read-model";

// SERVER-ONLY. A READ-ONLY status surface for Kee Mission Control (the "Vigía") to intercommunicate with
// Arcanum. Everything stays server-side: the token is validated here (never shipped to a client), the
// events are read with the service_role (never exposed), and only DERIVED progress is returned — never raw
// events, never a secret. The read-model is folded from the log by the SAME pure `project()` the app uses,
// so the numbers are identical to what the learner sees. Import ONLY from route handlers.

export const MC_API_VERSION = 1;

/** The MC status token, or null when not configured / trivially short (→ the endpoints stay disabled). */
export function mcToken(): string | null {
  const t = process.env.MC_STATUS_TOKEN;
  return t && t.length >= 16 ? t : null;
}

/** Constant-time check of the X-MC-Token header against the configured token. */
export function mcAuthorized(header: string | null | undefined): boolean {
  const t = mcToken();
  if (!t || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(t);
  if (a.length !== b.length) return false; // timingSafeEqual needs equal length
  return timingSafeEqual(a, b);
}

/** True when the token AND the Supabase service_role are configured (a live status feed is possible). */
export function mcConfigured(): boolean {
  return !!(mcToken() && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Load the single user's full event log from the Supabase mirror via the service_role, scoped by user_id.
 *  null → the backend isn't configured (honest: the caller returns 503). [] → configured but no user/events. */
export async function loadUserEvents(): Promise<ArcanumEvent[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  // Resolve the single user by email. listUsers is PAGINATED — page through it so the owner is never
  // missed behind orphan/test users (a missed user would return a FALSE empty snapshot).
  const USERS_PER_PAGE = 200;
  let userId: string | null = null;
  for (let page = 1; page <= 50 && !userId; page++) {
    const { data: list, error } = await admin.auth.admin.listUsers({ page, perPage: USERS_PER_PAGE });
    if (error) return null;
    const found = list?.users.find((u) => u.email?.toLowerCase() === ACCESS_EMAIL);
    if (found) userId = found.id;
    if (!list || list.users.length < USERS_PER_PAGE) break; // last page
  }
  if (!userId) return []; // configured but the user hasn't been provisioned yet → honest empty snapshot

  // Page the whole event log. Advance by the ACTUAL rows returned and stop only on an empty page — never
  // on "short page", so a server-side row cap (PostgREST db-max-rows) can't silently truncate → under-count.
  const events: ArcanumEvent[] = [];
  const PAGE = 1000;
  for (let from = 0; ; ) {
    const { data, error } = await admin
      .from("events")
      .select("id,type,ts,device_id,goal_id,module_id,payload,v,seq")
      .eq("user_id", userId)
      .order("seq", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return null;
    if (!data || data.length === 0) break;
    for (const r of data) events.push(fromRow(r as unknown as EventRow));
    from += data.length;
  }
  return events;
}

export interface McSnapshot {
  ok: true;
  service: "arcanum";
  ts: number;
  apiVersion: number;
  stats: {
    totalXp: number;
    grade: string;
    gradeIndex: number;
    currentStreak: number;
    longestStreak: number;
    shields: number;
    /** the streak is alive TODAY (today's civil day is a qualified day) */
    todayQualified: boolean;
  };
  counts: {
    goals: number;
    modules: number;
    mastered: number;
    active: number;
    sealed: number;
    reviewDue: number;
    notes: number;
    pendingAi: number;
  };
  /** modules in progress (started, not yet mastered) */
  active: Array<{ id: string; title: string; goalId: string | null; status: string; retrievability: number; dueInDays: number }>;
  /** what the decay queue says is due, most-overdue first */
  reviewDue: Array<{ id: string; title: string; retrievability: number; dueInDays: number; overdue: boolean }>;
  /** the last few notable events (activity feed) */
  recent: Array<{ type: string; ts: number; module: string | null }>;
  lastEventTs: number | null;
}

const NOTABLE = new Set(["checkpoint.passed", "error.resolved", "module.started", "module.completed", "gate.evaluated", "firetest.attempted", "mission.submitted", "grade.celebrated", "sleepcycle.generated"]);

const round = (n: number, d = 2): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

/** PURE — shape the derived snapshot from a folded read-model + the raw events (for the activity feed).
 *  No I/O, no secrets → fully unit-testable. The numbers match the app because it's the same read-model. */
export function buildSnapshot(rm: ReadModel, events: ArcanumEvent[], nowMs: number): McSnapshot {
  const nowDays = msToDays(nowMs);
  const todayOrd = civilDayOrdinal(nowMs, ARCANUM_CONFIG.tz);
  const byId = new Map(rm.modules.map((m) => [m.id, m]));
  const titleOf = (id: string | null): string | null => (id ? byId.get(id)?.title ?? null : null);
  const live = rm.modules.filter((m) => !m.archived);

  const active = live
    .filter((m) => m.status === "started" && !isMastered(m))
    .map((m) => ({ id: m.id, title: m.title, goalId: m.goalId, status: m.status, retrievability: round(retrievability(m.S, m.lastReinforcedDays, nowDays)), dueInDays: round(m.dueDays - nowDays, 1) }));

  const reviewDue = [...rm.reviewDue]
    .map((ri) => byId.get(ri.moduleId))
    .filter((m): m is ModuleRM => !!m && !m.archived)
    .sort((a, b) => a.dueDays - b.dueDays)
    .map((m) => ({ id: m.id, title: m.title, retrievability: round(retrievability(m.S, m.lastReinforcedDays, nowDays)), dueInDays: round(m.dueDays - nowDays, 1), overdue: m.dueDays <= nowDays }));

  const recent = [...events]
    .filter((e) => NOTABLE.has(e.type))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 12)
    .map((e) => ({ type: e.type, ts: e.ts, module: titleOf(e.module_id) }));

  return {
    ok: true,
    service: "arcanum",
    ts: nowMs,
    apiVersion: MC_API_VERSION,
    stats: {
      totalXp: rm.stats.totalXp,
      grade: rm.stats.grade,
      gradeIndex: rm.stats.gradeIndex,
      currentStreak: rm.stats.currentStreak,
      longestStreak: rm.stats.longestStreak,
      shields: rm.stats.shields,
      todayQualified: rm.stats.lastQualifiedDay === todayOrd,
    },
    counts: {
      goals: rm.goals.filter((g) => !g.archived).length,
      modules: live.length,
      mastered: live.filter((m) => isMastered(m)).length,
      active: active.length,
      sealed: live.filter((m) => nodeStatus(m, rm.edges, byId) === "sealed").length,
      reviewDue: reviewDue.length,
      notes: rm.notes.length,
      pendingAi: rm.pendingAi.length,
    },
    active,
    reviewDue,
    recent,
    lastEventTs: rm.cursor?.ts ?? null,
  };
}
