import type { ObligationInput } from "@/core/event";

// Pure, TOLERANT parser of Canvas data → obligations (Fase 4). The n8n scraper hits
// Canvas's JSON API with the session cookie (the dashboard is a SPA — its data IS
// this JSON, far more stable than scraping rendered HTML). Every field degrades
// independently: a missing/!title row is dropped, a bad date becomes null, an
// unknown submission shape falls back to "pending". It NEVER throws on junk input.
//
// The n8n workflow's Code node mirrors this logic (n8n can't import the repo);
// these tests are the source of truth for the contract.

interface CanvasSubmissionRaw {
  workflow_state?: string;
  submitted_at?: string | null;
  missing?: boolean;
  late?: boolean;
  grade?: string | number | null;
}

interface CanvasAssignmentRaw {
  id?: number | string;
  course_id?: number | string;
  name?: string;
  due_at?: string | null;
  html_url?: string;
  submission?: CanvasSubmissionRaw | null;
  // planner-item shape (alternative Canvas endpoint):
  context_name?: string;
  plannable_id?: number | string;
  plannable?: { id?: number | string; title?: string; due_at?: string | null } | null;
}

interface CanvasCourseRaw {
  id?: number | string;
  name?: string;
}

function parseIso(iso: unknown): number | null {
  if (typeof iso !== "string" || !iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function deriveStatus(sub: CanvasSubmissionRaw | null | undefined): string {
  if (sub && typeof sub === "object") {
    if (sub.workflow_state === "graded" || (sub.grade != null && sub.grade !== "")) return "graded";
    if (sub.missing === true) return "missing";
    if (sub.workflow_state === "submitted" || sub.submitted_at) return sub.late ? "late" : "submitted";
    if (sub.late === true) return "late";
  }
  return "pending";
}

function parseOne(raw: unknown, courseName: Map<string, string>): ObligationInput | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as CanvasAssignmentRaw;
  const plannable = a.plannable ?? null;

  const title =
    (typeof a.name === "string" && a.name.trim()) ||
    (typeof plannable?.title === "string" && plannable.title.trim()) ||
    "";
  if (!title) return null; // honest: no usable title → drop, don't show junk

  const courseId = a.course_id != null ? String(a.course_id) : null;
  const rawId =
    a.id != null
      ? String(a.id)
      : a.plannable_id != null
        ? String(a.plannable_id)
        : plannable?.id != null
          ? String(plannable.id)
          : title; // last-resort stable-ish id
  const id = courseId ? `${courseId}:${rawId}` : rawId;

  const dueTs = parseIso(a.due_at ?? plannable?.due_at ?? null);
  const course =
    (typeof a.context_name === "string" && a.context_name) ||
    (courseId ? courseName.get(courseId) ?? "" : "") ||
    "";

  return {
    id,
    course,
    title,
    due_ts: dueTs,
    status: deriveStatus(a.submission),
    url: typeof a.html_url === "string" ? a.html_url : null,
  };
}

/**
 * Parse a Canvas assignment/planner array (+ optional courses for name lookup) into
 * obligations. De-dups by id (last wins). Returns [] for any non-array / junk input.
 */
export function parseCanvasObligations(assignments: unknown, courses: unknown = []): ObligationInput[] {
  const courseName = new Map<string, string>();
  if (Array.isArray(courses)) {
    for (const c of courses) {
      const cc = c as CanvasCourseRaw;
      if (cc && cc.id != null && typeof cc.name === "string") courseName.set(String(cc.id), cc.name);
    }
  }
  if (!Array.isArray(assignments)) return [];
  const byId = new Map<string, ObligationInput>();
  for (const raw of assignments) {
    const ob = parseOne(raw, courseName);
    if (ob) byId.set(ob.id, ob); // last wins on dup id
  }
  return [...byId.values()];
}
