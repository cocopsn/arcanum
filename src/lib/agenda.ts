import type { ObligationRM } from "@/core/read-model";

// Pure presentation helpers for the Canvas obligations layer (Fase 4). `now` is an
// EXPLICIT parameter everywhere — these are testable and never call Date.now().
// (Canvas data-age/freshness lives in core/present's canvasFreshness.)

const DAY = 86_400_000;

export type DueBucket = "overdue" | "today" | "tomorrow" | "week" | "later" | "none";

export function dueBucket(dueTs: number | null, nowMs: number): DueBucket {
  if (dueTs === null) return "none";
  const delta = dueTs - nowMs;
  if (delta < 0) return "overdue";
  if (delta < DAY) return "today";
  if (delta < 2 * DAY) return "tomorrow";
  if (delta < 7 * DAY) return "week";
  return "later";
}

export const BUCKET_ORDER: DueBucket[] = ["overdue", "today", "tomorrow", "week", "later", "none"];

export const BUCKET_LABEL: Record<DueBucket, string> = {
  overdue: "Vencidas",
  today: "Hoy",
  tomorrow: "Mañana",
  week: "Esta semana",
  later: "Más adelante",
  none: "Sin fecha",
};

export interface ObligationGroup {
  bucket: DueBucket;
  label: string;
  items: ObligationRM[];
}

/** Group obligations into ordered, non-empty due buckets (each sorted by dueTs). Pure. */
export function groupObligations(obligations: ObligationRM[], nowMs: number): ObligationGroup[] {
  const groups = new Map<DueBucket, ObligationRM[]>();
  for (const o of obligations) {
    const b = dueBucket(o.dueTs, nowMs);
    const arr = groups.get(b);
    if (arr) arr.push(o);
    else groups.set(b, [o]);
  }
  for (const arr of groups.values()) {
    arr.sort((a, b) => {
      if (a.dueTs === null && b.dueTs === null) return a.title.localeCompare(b.title);
      if (a.dueTs === null) return 1;
      if (b.dueTs === null) return -1;
      return a.dueTs - b.dueTs;
    });
  }
  return BUCKET_ORDER.map((b) => ({ bucket: b, label: BUCKET_LABEL[b], items: groups.get(b) ?? [] })).filter(
    (g) => g.items.length > 0,
  );
}

/** Human "hace X" for data age. Pure. */
export function formatAge(ageMs: number | null): string {
  if (ageMs === null) return "sin conectar";
  const min = Math.floor(ageMs / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}
