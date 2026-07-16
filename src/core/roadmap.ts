import { ARCANUM_CONFIG } from "@/core/config";
import type { ModuleRM, Edge, PathRM } from "@/core/read-model";

export type NodeStatus = "sealed" | "available" | "started" | "completed";

/** Prerequisite module ids of `moduleId` (sources of edges pointing → moduleId). */
export function prereqsOf(moduleId: string, edges: Edge[]): string[] {
  return edges.filter((e) => e.to === moduleId).map((e) => e.from);
}

/**
 * A module counts as mastered (for fog-of-war reveal) when it is completed, a fire
 * test cleared the bar, OR its adversarial EXIT GATE was passed (WHITE ROOM — the
 * gate has real power: passing it demonstrates first-principle mastery and unseals
 * the next cell). Derived; idempotent under re-fold.
 */
export function isMastered(m: ModuleRM): boolean {
  // A heavy MISSION cell is mastered ONLY by passing its adversarial interrogation
  // (gate.evaluated → gatePassed). Completing it or clearing a firetest must NOT
  // bypass the directed loop — the block on the next node is real, derived from the
  // log, and only the interrogator can lift it.
  if (m.kind === "mission") return m.gatePassed;
  if (m.status === "completed" || m.gatePassed) return true;
  return (m.firetestRatio ?? 0) >= ARCANUM_CONFIG.roadmap.firetestRevealThreshold;
}

/**
 * Revealed (not sealed) iff every LIVE prereq is mastered. Prereqs whose module
 * was archived (or no longer exists) are skipped — an archived prereq is not a
 * real gate, so it must never permanently seal its downstream node. If no live
 * prereq remains the node is revealed.
 */
export function isRevealed(moduleId: string, edges: Edge[], byId: Map<string, ModuleRM>): boolean {
  const self = byId.get(moduleId);
  const live = prereqsOf(moduleId, edges)
    .map((pid) => byId.get(pid))
    .filter((m): m is ModuleRM => m !== undefined && !m.archived)
    // PATHS — progress NEVER crosses a path. A prereq only gates a cell in its OWN path: mastering a
    // concept in path A must not unseal anything in path B, even if the topic repeats (that would be
    // a placebo of mastery never demonstrated there — the learner must pass THAT path's gate too).
    // The cross-path exemption applies ONLY when BOTH cells carry a REAL path (fail-open there is safe:
    // path B's own chain still seals it). A null on EITHER side means "unassigned/legacy", NOT a
    // different path — it must keep gating. Without this guard a null-path cell (e.g. one created on the
    // roadmap canvas) hung off a path-assigned seed cell would drop its only prereq and be vacuously
    // revealed → an UNEARNED unseal. That is the exact leak the migration would otherwise arm.
    .filter((m) => (self && self.pathId !== null && m.pathId !== null ? m.pathId === self.pathId : true));
  return live.every((m) => isMastered(m));
}

/** An informative CROSS-PATH echo: this cell's concept was already MASTERED (gate passed) in ANOTHER
 *  path. Pure, derived. It is context ONLY — it never unseals, never grants XP, never skips a gate.
 *  Pure cognitive wiring so the learner sees the connection between parallel routes. */
export interface CrossPathEcho {
  pathId: string;
  pathName: string;
  moduleTitle: string;
}
export function crossPathEcho(m: ModuleRM, modules: ModuleRM[], paths: PathRM[]): CrossPathEcho | null {
  if (!m.concept || !m.pathId) return null;
  const other = modules.find(
    (x) => x.id !== m.id && !x.archived && x.concept === m.concept && x.pathId !== null && x.pathId !== m.pathId && x.gatePassed,
  );
  if (!other || !other.pathId) return null;
  const p = paths.find((pp) => pp.id === other.pathId);
  return { pathId: other.pathId, pathName: p?.name ?? "otro path", moduleTitle: other.title };
}

/** Derived node status from prereqs + events. */
export function nodeStatus(m: ModuleRM, edges: Edge[], byId: Map<string, ModuleRM>): NodeStatus {
  // A mission cell reads "completed" (✓) ONLY when its interrogation actually passed — a bare
  // module.completed must never paint a ✓ on a mission whose gate is still closed (it doesn't
  // lift the block, so showing it as done would be a placebo). Non-mission cells unchanged.
  if (m.status === "completed" && (m.kind !== "mission" || m.gatePassed)) return "completed";
  if (m.status === "started") return "started";
  // A node you've proven (firetest cleared the bar) surfaces itself, not just its
  // descendants — never bury a mastered node behind its own unmet prereqs.
  if (isMastered(m)) return "available";
  return isRevealed(m.id, edges, byId) ? "available" : "sealed";
}

/** Would adding edge from→to create a cycle? It's a DAG — reject if so. Pure. */
export function wouldCreateCycle(edges: Edge[], from: string, to: string): boolean {
  if (from === to) return true;
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const arr = adj.get(e.from);
    if (arr) arr.push(e.to);
    else adj.set(e.from, [e.to]);
  }
  // A cycle would form iff `from` is already reachable from `to`.
  const stack = [to];
  const seen = new Set<string>();
  while (stack.length) {
    const n = stack.pop()!;
    if (n === from) return true;
    if (seen.has(n)) continue;
    seen.add(n);
    for (const next of adj.get(n) ?? []) stack.push(next);
  }
  return false;
}
