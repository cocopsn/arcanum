import type { ReadModel, ModuleRM } from "@/core/read-model";
import type { ViewModel } from "@/core/present";
import { cellById } from "@/lib/spines";

// Nature-by-duration (the "never-empty-screen" rule): every cell offers up to THREE entry
// modes by the time the learner has — heavy (the full directed mission), light (a short
// on-demand lesson, Capa B), review (a 5-min question from the decay queue, Capa C). The
// three layers ride on EXISTING events: heavy = mission.submitted/gate.evaluated, light &
// review = checkpoint.passed (reinforcement). Pure.

export type DurationMode = "heavy" | "light" | "review";

export interface ModeAvailability {
  /** the cell carries a directed mission → the full push loop */
  heavy: boolean;
  /** the cell has a real source → an on-demand light lesson can be generated (Capa B) */
  light: boolean;
  /** how many items the decay queue says are due for review right now (Capa C) */
  review: number;
}

/** Which entry modes a cell offers, given the now-injected view model. Pure. */
export function modesFor(m: ModuleRM, vm: ViewModel): ModeAvailability {
  const cell = cellById(m.id);
  return {
    // heavy = a directed mission OR an authored exit gate (both are the full challenge loop)
    heavy: (m.kind === "mission" && !!cell?.mission) || !!cell?.gate,
    light: (cell?.sourceUrls?.length ?? 0) > 0,
    review: vm.reviewQueue.length,
  };
}

/** The mode the cell opens in by default: the heavy loop when it has one, else the light lesson,
 *  else review. So the selector lands on the cell's natural primary activity. Pure. */
export function defaultMode(modes: ModeAvailability): DurationMode {
  if (modes.heavy) return "heavy";
  if (modes.light) return "light";
  return "review";
}

/** The most-overdue review target (Capa C), or null when caught up (honest — not a fake item). Pure. */
export function nextReview(rm: ReadModel, vm: ViewModel): ModuleRM | null {
  const first = vm.reviewQueue[0];
  if (!first) return null;
  return rm.modules.find((m) => m.id === first.moduleId && !m.archived) ?? null;
}
