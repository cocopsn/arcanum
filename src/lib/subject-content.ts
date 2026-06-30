import { cellById } from "@/lib/spines";

// Per-cell content (WHITE ROOM). The BODY is NOT pre-invented: `summary` is null and
// fills on demand via the tutor (editable draft). What IS authored is REAL: the
// canonical source URLs (extracted), the demo cells' first-principle exit-gate rubric,
// and lecture videos. Honesty rule intact — nothing academic fabricated as fixed truth.

export interface TopicVideo {
  title: string;
  url: string;
}

export interface QuizQuestion {
  prompt: string;
  options: string[];
  answer: number;
  rationale: string;
}

/** The adversarial EXIT GATE of a cell: a justify-not-recognize question + rubric. */
export interface TopicGate {
  question: string;
  rubric: string[];
}

/** A directed MISSION (heavy cell): the order anchored to the real source. */
export interface TopicMission {
  assignment: string;
  deliverable: string;
}

export interface TopicContent {
  /** authored orientation, or null = fills on demand (no invented body) */
  summary: string | null;
  /** REAL canonical source URLs (lecture/reading), anchored — never invented */
  sourceUrls: string[];
  videos: TopicVideo[];
  tools: string[];
  /** legacy built-in quiz (recognition) — empty for canonical cells, which use the gate */
  quiz: QuizQuestion[];
  /** the WHITE ROOM exit gate, or null if this cell has no gate authored yet */
  gate: TopicGate | null;
  /** the directed mission (heavy cell), or null if this is not a mission cell */
  mission: TopicMission | null;
  /** 'pattern' = competitive (ICPC) cell → arena HUD + real-judge framing; null = first-principle */
  mode: "pattern" | null;
  /** cross-spine foundation this cell builds on (lives once elsewhere — non-duplication) */
  references: { id: string; title: string }[];
  /** conceptual see-also: a SEPARATE cell of another nature (not a dedup) — e.g. competitive
   *  graphs relates to ITC's graphs but is reflex-under-clock, not first-principle depth */
  related: { id: string; title: string }[];
}

function videoLabel(url: string): string {
  if (/youtube\.com|youtu\.be/.test(url)) return "Lecture (YouTube)";
  if (/ocw\.mit\.edu|archive\.org/.test(url)) return "MIT OCW lecture";
  if (/stanford\.edu/.test(url)) return "Stanford CS231n";
  if (/\.pdf($|\?)/.test(url)) return "Slides (PDF)";
  return "Recurso en video";
}

export function contentForModule(moduleId: string): TopicContent | null {
  const cell = cellById(moduleId);
  if (!cell) return null;
  return {
    summary: null, // body fills on demand via the tutor — no invented academic content
    sourceUrls: cell.sourceUrls,
    videos: (cell.videoUrls ?? []).map((url) => ({ title: videoLabel(url), url })),
    tools: [],
    quiz: [],
    gate: cell.gate ?? null,
    mission: cell.mission ?? null,
    mode: cell.interrogationMode ?? null,
    references: (cell.references ?? [])
      .map((id) => {
        const ref = cellById(id);
        return ref ? { id, title: ref.title } : null;
      })
      .filter((r): r is { id: string; title: string } => r !== null),
    related: (cell.related ?? [])
      .map((id) => {
        const ref = cellById(id);
        return ref ? { id, title: ref.title } : null;
      })
      .filter((r): r is { id: string; title: string } => r !== null),
  };
}
