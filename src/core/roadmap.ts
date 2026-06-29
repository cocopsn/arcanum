import { ARCANUM_CONFIG } from "@/core/config";
import type { ModuleRM, Edge } from "@/core/read-model";

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
  const live = prereqsOf(moduleId, edges)
    .map((pid) => byId.get(pid))
    .filter((m): m is ModuleRM => m !== undefined && !m.archived);
  return live.every((m) => isMastered(m));
}

/** Derived node status from prereqs + events. */
export function nodeStatus(m: ModuleRM, edges: Edge[], byId: Map<string, ModuleRM>): NodeStatus {
  if (m.status === "completed") return "completed";
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
