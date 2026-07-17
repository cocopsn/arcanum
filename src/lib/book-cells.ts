import { makeEvent, type ArcanumEvent } from "@/core/event";
import { parseBook, type ParsedBook } from "@/lib/book";
import type { Spine } from "@/lib/spines";

// FOLDER BOOKS → EVENT-SOURCED CELLS. A book's frontmatter can create the cell it anchors to (when it
// doesn't exist yet), on the right GOAL (spine) and the right PATH (slug → real pathId — this closes the
// path-aware debt), with its NATURE, and the DAG edges from its prereq/order so the fog-of-war respects
// the hierarchy. Everything is DERIVED and DETERMINISTIC: the event ids are a stable hash of the
// module_id (and from|to for edges), so re-importing the same folder yields the SAME events → hydrate
// dedupes them by id, cells never duplicate, and progress (gatePassed/XP/mastery) is preserved by the
// projector's idempotent upsert. Pure — no clock, no I/O. Books whose cell already exists in the seed
// spines are left to the seed (the book only anchors for reading, via the Dexie store).

const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (s: string) => stripAccents(s.toLowerCase()).trim();

/** Deterministic code-point comparison. NEVER String.localeCompare in this file: its ICU collation is
 *  locale/host-dependent, so it could derive a DIFFERENT chain edge on two synced devices and break the
 *  "same folder → same events → hydrate dedupes" invariant. Code points are identical on every machine. */
const byCodePoint = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** FNV-1a → 12 hex, so a module_id maps to a stable UUID tail (keeps ids 36 chars, UUID-shaped). */
function tail(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let h2 = 0x811c9dc5 ^ 0x9e3779b9;
  for (let i = s.length - 1; i >= 0; i--) {
    h2 ^= s.charCodeAt(i);
    h2 = Math.imul(h2, 0x01000193);
  }
  return ((h >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0")).slice(0, 12);
}
const cellEventId = (moduleId: string) => `b2000000-0000-4000-8000-${tail(moduleId)}`;
// "\n" DELIMITER (impossible inside a UUID id) so distinct (from,to) pairs can never concatenate to the
// same string and collide to one deterministic edge id — a collision would let hydrate's id set-diff
// silently dedupe two real edges into one, dropping a DAG edge. Endpoints are UUID-validated (book.ts).
const edgeEventId = (from: string, to: string) => `b3000000-0000-4000-8000-${tail(from + "\n" + to)}`;

/** Resolve a book's `spine` to a goal id — TOLERANT but not loose: exact title, exact sigil, or a
 *  whole-WORD title prefix ("FrED" → "FrED Factory", "Aleman" → "Alemán"). NOT a mid-string substring:
 *  a short/typo/garbage spine must fail safe to null ("no cell", the contract), never mis-anchor a book
 *  onto an arbitrary goal it merely happens to be a substring of. */
export function spineToGoalId(spine: string, spines: Spine[]): string | null {
  const s = norm(spine);
  if (!s) return null;
  const hit = spines.find((sp) => {
    const g = norm(sp.goalTitle);
    return g === s || norm(sp.sigil) === s || g.startsWith(s + " ");
  });
  return hit?.goalId ?? null;
}

/** Resolve a path slug (within a goal) to the real pathId; absent/unknown → the goal's first (default) path. */
export function resolvePathId(goalId: string, pathSlug: string | null, spines: Spine[]): string | null {
  const sp = spines.find((x) => x.goalId === goalId);
  if (!sp) return null;
  if (pathSlug) {
    const p = sp.paths.find((pp) => norm(pp.slug) === norm(pathSlug));
    if (p) return p.id;
  }
  return sp.paths[0]?.id ?? null;
}

/**
 * Derive the module.upserted (+ edge) events for the folder books. `existingCellIds` are the seed cells
 * (those are NOT re-created — the book anchors to them via the Dexie store). ts0 is the base timestamp
 * (strictly after the paths block). Pure + deterministic.
 */
export function deriveBookCellEvents(md: string[], spines: Spine[], ts0: number, device: string): ArcanumEvent[] {
  const existing = new Set(spines.flatMap((s) => s.cells.map((c) => c.id)));
  const parsed = md
    .map(parseBook)
    .filter((b): b is ParsedBook => b !== null && !!b.meta.moduleId);
  // stable order so ts/id assignment is deterministic regardless of folder read order
  parsed.sort((a, b) => byCodePoint(a.meta.moduleId!, b.meta.moduleId!));

  const events: ArcanumEvent[] = [];
  let t = ts0;

  // 1) CREATE cells that don't exist yet — path-aware, nature-aware
  const created = new Map<string, { goalId: string; pathId: string | null; order: number | null; prereq: string[] }>();
  for (const b of parsed) {
    const M = b.meta.moduleId!;
    if (existing.has(M) || created.has(M)) continue; // existing seed cell or a duplicate file → skip
    const goalId = spineToGoalId(b.meta.spine, spines);
    if (!goalId) continue; // unknown spine → can't place the cell (the book still saves to Dexie for reading)
    const pathId = resolvePathId(goalId, b.meta.path, spines);
    const payload: Record<string, unknown> = { title: b.meta.title, prereqs: [], kind: "cell" };
    if (pathId) payload.pathId = pathId;
    if (b.meta.nature) payload.nature = b.meta.nature;
    events.push(makeEvent("module.upserted", payload as never, { ts: t++, deviceId: device, goalId, moduleId: M, id: cellEventId(M) }));
    created.set(M, { goalId, pathId, order: b.meta.order, prereq: b.meta.prereq });
  }

  const known = new Set([...existing, ...created.keys()]);
  const edgeSeen = new Set<string>();
  const addEdge = (from: string, to: string) => {
    if (from === to || !known.has(from) || !known.has(to)) return;
    const key = from + "|" + to;
    if (edgeSeen.has(key)) return;
    edgeSeen.add(key);
    events.push(makeEvent("roadmap.edge.upserted", { from, to }, { ts: t++, deviceId: device, id: edgeEventId(from, to) }));
  };

  // 2) EXPLICIT prereqs → edges
  for (const [M, info] of created) for (const pre of info.prereq) addEdge(pre, M);

  // 3) ORDER-based chaining: within each (goal, path), cells that declared `order` and NO explicit prereq
  //    are chained in sequence (order K depends on the previous order in the same path) → a linear DAG.
  const byLane = new Map<string, { id: string; order: number }[]>();
  for (const [M, info] of created) {
    if (info.prereq.length > 0 || info.order === null) continue;
    const lane = `${info.goalId}|${info.pathId ?? ""}`;
    (byLane.get(lane) ?? byLane.set(lane, []).get(lane)!).push({ id: M, order: info.order });
  }
  for (const cells of byLane.values()) {
    cells.sort((a, b) => a.order - b.order || byCodePoint(a.id, b.id));
    for (let i = 1; i < cells.length; i++) addEdge(cells[i - 1]!.id, cells[i]!.id);
  }

  return events;
}
