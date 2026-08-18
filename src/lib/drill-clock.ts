// DRILL CLOCK — pure helpers for the timed-drill feature. The OA (and any timed exam) is won or
// lost under a clock, so an exercise may DECLARE a time target (`tiempo: N` in the bank contract)
// and the runner MEASURES real elapsed time against it. This module never judges mastery and never
// touches the log: it formats a real measurement and states, honestly, within/over the target.

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const ss = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export interface ClockVerdict {
  /** elapsed ≤ target (the meta is an inclusive ceiling) */
  within: boolean;
  elapsedLabel: string;
  targetLabel: string;
  /** how far over the target, or null when within */
  overLabel: string | null;
}

/** Honest statement of a real measurement vs the exercise's declared target. Pure. */
export function clockVerdict(elapsedMs: number, targetMin: number): ClockVerdict {
  const targetMs = targetMin * 60_000;
  const within = elapsedMs <= targetMs;
  return {
    within,
    elapsedLabel: formatClock(elapsedMs),
    targetLabel: formatClock(targetMs),
    overLabel: within ? null : formatClock(elapsedMs - targetMs),
  };
}
