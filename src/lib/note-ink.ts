// Plumita ink — hand-drawn strokes serialized INTO the note markdown as fenced ```arcanum-ink
// blocks, so a drawing is reconstructed from the SAME note.created/updated log as the prose (no new
// event type, no binary blob store, syncs by the same log). The WYSIWYG editor owns the prose; ink
// rides alongside in the serialized markdown. Pure — no DOM, no clock, no randomness → testable, and
// the fold stays atemporal/idempotent. Round-trip guaranteed: splitInk(joinInk(prose, inks)) restores
// both prose and inks (validated/normalized; malformed blocks are dropped honestly, never invented).

export interface InkPoint {
  x: number;
  y: number;
  /** pressure 0..1 (1 when the device/pointer reports none) */
  p: number;
}
export interface InkStroke {
  color: string;
  size: number;
  points: InkPoint[];
}
export interface InkDrawing {
  id: string;
  /** the canvas dimensions the strokes were captured at (for faithful replay/scaling) */
  w: number;
  h: number;
  strokes: InkStroke[];
}

const FENCE = "arcanum-ink";
// a fenced ```arcanum-ink … ``` block (the body is the JSON of one InkDrawing)
const INK_BLOCK = /```arcanum-ink[ \t]*\r?\n([\s\S]*?)\r?\n```/g;

const q = (n: number, d = 0): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

/** Compact, deterministic serialization of one drawing as a fenced block. */
export function serializeInk(ink: InkDrawing): string {
  const compact = {
    id: ink.id,
    w: q(ink.w),
    h: q(ink.h),
    strokes: ink.strokes.map((s) => ({
      color: s.color,
      size: q(s.size, 1),
      // points as [x, y, pressure] triples — far smaller than keyed objects for long strokes
      pts: s.points.map((pt) => [q(pt.x, 1), q(pt.y, 1), q(pt.p, 2)]),
    })),
  };
  return "```" + FENCE + "\n" + JSON.stringify(compact) + "\n```";
}

/** Parse one block body back into a drawing, or null if malformed (dropped, never faked). */
export function parseInk(body: string): InkDrawing | null {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id) return null;
  const strokesRaw = Array.isArray(o.strokes) ? o.strokes : [];
  const strokes: InkStroke[] = [];
  for (const sRaw of strokesRaw) {
    if (!sRaw || typeof sRaw !== "object") continue;
    const s = sRaw as Record<string, unknown>;
    const ptsRaw = Array.isArray(s.pts) ? s.pts : Array.isArray(s.points) ? s.points : [];
    const points: InkPoint[] = [];
    for (const ptRaw of ptsRaw) {
      if (Array.isArray(ptRaw) && ptRaw.length >= 2) {
        const x = Number(ptRaw[0]);
        const y = Number(ptRaw[1]);
        const p = ptRaw.length >= 3 ? Number(ptRaw[2]) : 1;
        if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y, p: Number.isFinite(p) ? p : 1 });
      }
    }
    if (points.length === 0) continue;
    strokes.push({
      color: typeof s.color === "string" ? s.color : "currentColor",
      size: Number.isFinite(Number(s.size)) ? Number(s.size) : 2,
      points,
    });
  }
  if (strokes.length === 0) return null; // an empty drawing is not content
  return {
    id: o.id,
    w: Number.isFinite(Number(o.w)) ? Number(o.w) : 0,
    h: Number.isFinite(Number(o.h)) ? Number(o.h) : 0,
    strokes,
  };
}

/** Split a note's markdown into prose (for the editor) + the drawings (for the canvases). */
export function splitInk(markdown: string): { prose: string; inks: InkDrawing[] } {
  const inks: InkDrawing[] = [];
  const stripped = markdown.replace(INK_BLOCK, (_m, body: string) => {
    const ink = parseInk(body);
    if (ink) inks.push(ink);
    return "\n"; // leave a newline so neighbouring prose lines don't merge
  });
  const prose = stripped.replace(/\n{3,}/g, "\n\n").trim();
  return { prose, inks };
}

/** Recombine prose + drawings into the serialized note markdown (drawings appended after the prose). */
export function joinInk(prose: string, inks: InkDrawing[]): string {
  const blocks = inks.map(serializeInk).join("\n\n");
  const p = prose.trim();
  if (!blocks) return p;
  return p ? `${p}\n\n${blocks}` : blocks;
}
