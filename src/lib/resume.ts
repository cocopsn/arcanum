// RESUME — device-local "where was I" (localStorage; NEVER the log — view position is not
// learning history, exactly like scroll/listen progress in book-store). Root-cause context: any
// full reload (a Chrome tab-discard, an OS killing the PWA, a deploy, formerly Serwist's
// reload-on-online) used to land on the throne hall because every surface was ephemeral React
// state. This module remembers the SPINE of the location — open world, open cell sheet, open
// book, the library overlay — so boot can put the learner back where they were.
//
// WRITE SEMANTICS (load-bearing): surfaces write on MOUNT and clear on DELIBERATE CLOSE (React
// effect cleanup). A reload / crash / discard never runs cleanups → the location survives. A
// deliberate close does → next boot lands home, as the learner chose.
//
// RESTORE SEMANTICS: fail-closed. Every id is validated against the live read-model / book store
// before anything opens; anything stale or unknown is ignored (never a broken surface). Restoring
// a surface never touches progression — a sealed cell restores to its honest sealed view, and
// reading/listening remain input (mastery stays gate-only).

export interface ResumeState {
  v: 1;
  /** open world (SubjectMap goalId) */
  world: string | null;
  /** open cell sheet (TopicDetailSheet moduleId) */
  cell: string | null;
  /** open book reader (BookRow id) — restored at a top-level host, whatever its original host */
  bookId: string | null;
  /** the Lecturas (library) overlay */
  library: boolean;
  ts: number;
}

const KEY = "arcanum_resume";
const EMPTY: ResumeState = { v: 1, world: null, cell: null, bookId: null, library: false, ts: 0 };

/** The stored location, or null when absent/invalid/foreign-version. Never throws (private mode). */
export function loadResume(): ResumeState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<ResumeState> | null;
    if (!p || typeof p !== "object" || p.v !== 1) return null;
    return {
      v: 1,
      world: typeof p.world === "string" ? p.world : null,
      cell: typeof p.cell === "string" ? p.cell : null,
      bookId: typeof p.bookId === "string" ? p.bookId : null,
      library: p.library === true,
      ts: typeof p.ts === "number" ? p.ts : 0,
    };
  } catch {
    return null;
  }
}

/** Merge-patch the stored location. Best-effort (private mode / SSR → no-op). */
export function saveResume(patch: Partial<Omit<ResumeState, "v" | "ts">>): void {
  try {
    const cur = loadResume() ?? EMPTY;
    const next: ResumeState = { ...cur, ...patch, v: 1, ts: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* device-local best-effort — resume simply won't survive here */
  }
}

/** Forget the stored location entirely (used by logout). Best-effort. */
export function clearResume(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
