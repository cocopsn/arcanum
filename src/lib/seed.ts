import { makeEvent, type ArcanumEvent } from "@/core/event";
import { ARCANUM_CONFIG } from "@/core/config";

// Day-0 seed: the ITC goal and its first module, as EVENTS (not state). Fixed
// UUIDs (valid uuid, exempt from uuidv7 generation) → re-running the seed `put`s
// by id without duplicating (spec §12). Nothing is pre-completed: the fire test
// and module.started are the user's first real acts.

const DEVICE = "seed";
const TS = Date.UTC(2026, 5, 20, 18, 0, 0); // fixed seed instant (deterministic)

export const SEED_GOAL_ID = "a0000000-0000-4000-8000-000000000001";
export const SEED_MODULE_ID = "a0000000-0000-4000-8000-000000000002";

const EVENT_IDS = {
  goal: "b0000000-0000-4000-8000-000000000001",
  module: "b0000000-0000-4000-8000-000000000002",
} as const;

export const SEED_EVENTS: ArcanumEvent[] = [
  makeEvent(
    "goal.upserted",
    { title: "ITC", priority: 1, color: ARCANUM_CONFIG.topicDefaults.ITC, sigil: "itc" },
    { ts: TS, deviceId: DEVICE, goalId: SEED_GOAL_ID, id: EVENT_IDS.goal },
  ),
  makeEvent(
    "module.upserted",
    { title: "Estructuras de datos: fundamentos", prereqs: [], kind: "core" },
    { ts: TS + 1, deviceId: DEVICE, goalId: SEED_GOAL_ID, moduleId: SEED_MODULE_ID, id: EVENT_IDS.module },
  ),
];
