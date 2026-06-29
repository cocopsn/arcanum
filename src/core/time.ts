// TZ-aware civil-day arithmetic. Pure: every function takes its inputs
// explicitly. "Days" for streaks/grouping are computed in a config TZ
// (default America/Monterrey, UTC-6 no DST). Changing TZ re-folds without loss.

const FMT_CACHE = new Map<string, Intl.DateTimeFormat>();

function dayFormatter(tz: string): Intl.DateTimeFormat {
  let f = FMT_CACHE.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    FMT_CACHE.set(tz, f);
  }
  return f;
}

/** epoch ms → civil-day key 'YYYY-MM-DD' in the given TZ. */
export function civilDay(ts: number, tz: string): string {
  const parts = dayFormatter(tz).formatToParts(new Date(ts));
  const pick = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

/** 'YYYY-MM-DD' → integer day number (days since epoch). */
export function dayOrdinal(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** epoch ms → integer civil-day ordinal in TZ. */
export function civilDayOrdinal(ts: number, tz: string): number {
  return dayOrdinal(civilDay(ts, tz));
}

export function msToDays(ms: number): number {
  return ms / 86_400_000;
}
