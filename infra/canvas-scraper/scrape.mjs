#!/usr/bin/env node
// ARCANUM · Canvas scraper (reference implementation / no-n8n fallback).
//
// Fetches Canvas obligations with a SESSION COOKIE and writes ONE event
// (canvas.synced) into the Supabase `events` table via the service-role key. The
// app pulls it through the normal sync and derives the agenda — local-first, the
// log is the single source of truth. A failed scrape (expired cookie) is a NORMAL
// state: it still writes a canvas.synced with ok:false so the app shows "datos con
// X de antigüedad" + "sesión expirada", never an error.
//
// The parse logic MIRRORS src/lib/canvas-parse.ts (the tested source of truth).
// The n8n Code node uses the same function — keep all three in sync.
//
// Secrets come ONLY from the environment (never the repo). See .env.example.
//   node scrape.mjs        # one run (wire to cron, or use the n8n workflow)

const env = (k, required = true) => {
  const v = process.env[k];
  if (required && !v) {
    console.error(`Falta env ${k}`);
    process.exit(2);
  }
  return v;
};

const CANVAS_BASE_URL = env("CANVAS_BASE_URL"); // e.g. https://experiencia21.tec.mx
const CANVAS_COOKIE = env("CANVAS_COOKIE"); // full Cookie header value
const SUPABASE_URL = env("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE = env("SUPABASE_SERVICE_ROLE");
const ARCANUM_USER_ID = env("ARCANUM_USER_ID"); // the owner's auth.users uuid
const ARCANUM_DEVICE_ID = process.env.ARCANUM_DEVICE_ID || "n8n-canvas";

// ── parser (mirror of src/lib/canvas-parse.ts) ──────────────────────────────
function parseIso(iso) {
  if (typeof iso !== "string" || !iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}
function deriveStatus(sub) {
  if (sub && typeof sub === "object") {
    if (sub.workflow_state === "graded" || (sub.grade != null && sub.grade !== "")) return "graded";
    if (sub.missing === true) return "missing";
    if (sub.workflow_state === "submitted" || sub.submitted_at) return sub.late ? "late" : "submitted";
    if (sub.late === true) return "late";
  }
  return "pending";
}
function parseOne(raw, courseName) {
  if (!raw || typeof raw !== "object") return null;
  const plannable = raw.plannable ?? null;
  const title =
    (typeof raw.name === "string" && raw.name.trim()) ||
    (typeof plannable?.title === "string" && plannable.title.trim()) ||
    "";
  if (!title) return null;
  const courseId = raw.course_id != null ? String(raw.course_id) : null;
  const rawId =
    raw.id != null
      ? String(raw.id)
      : raw.plannable_id != null
        ? String(raw.plannable_id)
        : plannable?.id != null
          ? String(plannable.id)
          : title;
  const id = courseId ? `${courseId}:${rawId}` : rawId;
  const dueTs = parseIso(raw.due_at ?? plannable?.due_at ?? null);
  const course =
    (typeof raw.context_name === "string" && raw.context_name) ||
    (courseId ? courseName.get(courseId) ?? "" : "") ||
    "";
  return {
    id,
    course,
    title,
    due_ts: dueTs,
    status: deriveStatus(raw.submission),
    url: typeof raw.html_url === "string" ? raw.html_url : null,
  };
}
function parseCanvasObligations(assignments, courses = []) {
  const courseName = new Map();
  if (Array.isArray(courses)) {
    for (const c of courses) {
      if (c && c.id != null && typeof c.name === "string") courseName.set(String(c.id), c.name);
    }
  }
  if (!Array.isArray(assignments)) return [];
  const byId = new Map();
  for (const raw of assignments) {
    const ob = parseOne(raw, courseName);
    if (ob) byId.set(ob.id, ob);
  }
  return [...byId.values()];
}

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// A Canvas GET. Returns { ok, data }. ok=false on auth failure / login redirect.
async function canvasGet(path) {
  const res = await fetch(`${CANVAS_BASE_URL}${path}`, {
    headers: { Cookie: CANVAS_COOKIE, Accept: "application/json" },
    redirect: "manual", // a 3xx to /login means the session expired
  });
  if (res.status === 401 || (res.status >= 300 && res.status < 400)) return { ok: false, data: null };
  if (!res.ok) return { ok: false, data: null };
  try {
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, data: null };
  }
}

async function main() {
  const fetchedTs = Date.now();
  // Recent + upcoming, across all active courses. Planner items carry due dates +
  // submission status; courses give human names.
  const startIso = new Date(fetchedTs - 14 * 86_400_000).toISOString();
  const [courses, planner] = await Promise.all([
    canvasGet(`/api/v1/courses?enrollment_state=active&per_page=100`),
    canvasGet(`/api/v1/planner/items?start_date=${encodeURIComponent(startIso)}&per_page=100`),
  ]);

  // ok requires REAL JSON arrays — an expired session returns an HTML login page
  // (or a redirect), never a Canvas array, so this catches expiry robustly.
  const ok = courses.ok && planner.ok && Array.isArray(planner.data) && Array.isArray(courses.data);
  const obligations = ok ? parseCanvasObligations(planner.data, courses.data) : [];

  const event = {
    id: uuid(),
    user_id: ARCANUM_USER_ID,
    type: "canvas.synced",
    ts: fetchedTs,
    device_id: ARCANUM_DEVICE_ID,
    goal_id: null,
    module_id: null,
    payload: { fetched_ts: fetchedTs, ok, obligations },
    v: 1,
  };

  const ins = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(event),
  });
  if (!ins.ok) {
    console.error(`Supabase insert falló: ${ins.status} ${await ins.text()}`);
    process.exit(1);
  }
  console.log(`canvas.synced escrito · ok=${ok} · ${obligations.length} obligaciones`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
