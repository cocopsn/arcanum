import type {
  ArcanumEvent,
  SessionEndedPayload,
  NoteCreatedPayload,
} from "@/core/event";

export interface DayDigest {
  fromMs: number;
  toMs: number;
  errorsResolved: number;
  checkpointsPassed: number;
  modulesCompleted: number;
  sessionMinutes: number;
  notesCreated: number;
  /** note titles created in the window — seed for AI axiom/connection proposals */
  noteTitles: string[];
}

/**
 * Pure fold over the last 24h (window ends at `nowMs`). Local derivation only —
 * the AI enrichment (patterns/axioms) is layered on top by the Sleep Cycle, and
 * the review_queue comes from present(readModel, now). `nowMs` is explicit.
 */
export function foldLast24h(events: ArcanumEvent[], nowMs: number): DayDigest {
  const fromMs = nowMs - 24 * 60 * 60 * 1000;
  let errorsResolved = 0;
  let checkpointsPassed = 0;
  let modulesCompleted = 0;
  let sessionMs = 0;
  let notesCreated = 0;
  const noteTitles: string[] = [];

  for (const e of events) {
    if (e.ts < fromMs || e.ts > nowMs) continue;
    switch (e.type) {
      case "error.resolved":
        errorsResolved++;
        break;
      case "checkpoint.passed":
        checkpointsPassed++;
        break;
      case "module.completed":
        modulesCompleted++;
        break;
      case "session.ended":
        sessionMs += Number((e.payload as unknown as SessionEndedPayload).duration_ms) || 0;
        break;
      case "note.created": {
        notesCreated++;
        const t = (e.payload as unknown as NoteCreatedPayload).title;
        if (t) noteTitles.push(t);
        break;
      }
      default:
        break;
    }
  }

  return {
    fromMs,
    toMs: nowMs,
    errorsResolved,
    checkpointsPassed,
    modulesCompleted,
    sessionMinutes: Math.round(sessionMs / 60000),
    notesCreated,
    noteTitles,
  };
}
