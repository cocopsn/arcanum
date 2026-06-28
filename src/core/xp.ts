import { ARCANUM_CONFIG } from "@/core/config";
import type {
  ArcanumEvent,
  SessionEndedPayload,
  FiretestAttemptedPayload,
  NoteCreatedPayload,
} from "@/core/event";

const X = ARCANUM_CONFIG.xp;

/**
 * Raw, UNROUNDED XP base for an event (spec §6.1). The streak multiplier is
 * applied and the result rounded ONCE in the projector — never here.
 */
export function xpBase(event: ArcanumEvent): number {
  switch (event.type) {
    case "error.resolved":
      return X.errorResolved;
    case "checkpoint.passed":
      return X.checkpoint;
    case "module.completed":
      return X.moduleCompleted;
    case "session.ended": {
      const p = event.payload as unknown as SessionEndedPayload;
      return p.duration_ms >= X.sessionMinMs && p.kind !== "review"
        ? X.sessionMin
        : 0;
    }
    case "firetest.attempted": {
      const p = event.payload as unknown as FiretestAttemptedPayload;
      if (p.ceiling <= 0) return 0;
      const reached = Math.min(p.reached, p.ceiling);
      return (reached / p.ceiling) * X.firetestMax;
    }
    case "note.created": {
      const p = event.payload as unknown as NoteCreatedPayload;
      return p.length >= X.noteMinLen ? X.note : 0;
    }
    default:
      return 0;
  }
}

/** Streak multiplier: 1 + min(streak, cap) * perDay (spec §6.1). */
export function streakMultiplier(streak: number): number {
  const s = Math.min(Math.max(streak, 0), X.streakMultCap);
  return 1 + s * X.streakMultPerDay;
}
