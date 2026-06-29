import { makeEvent, type ArcanumEvent } from "@/core/event";
import { SPINES } from "@/lib/spines";

// Day-0 seed: the THREE CURRICULAR SPINES (WHITE ROOM) as the roadmap DAG. Each goal
// is a spine; each cell is a module; course order is the dependency (a linear chain →
// fog-of-war seals later cells until the prior is mastered/gate-passed). Structure +
// canonical source URLs are REAL (extracted, see lib/spines.ts) — bodies fill on demand.
// As EVENTS, fixed UUIDs (exempt from uuidv7) → idempotent re-seed (spec §12).

const DEVICE = "seed";
const TS = Date.UTC(2026, 5, 20, 18, 0, 0);

let seq = 0;
let ts = TS;
const fixedId = () => `b0000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

function buildSeed(): ArcanumEvent[] {
  const events: ArcanumEvent[] = [];
  for (const sp of SPINES) {
    events.push(
      makeEvent(
        "goal.upserted",
        { title: sp.goalTitle, priority: 1, color: sp.color, sigil: sp.sigil },
        { ts: ts++, deviceId: DEVICE, goalId: sp.goalId, id: fixedId() },
      ),
    );
    for (const cell of sp.cells) {
      events.push(
        makeEvent(
          "module.upserted",
          { title: cell.title, prereqs: [], kind: "cell" },
          { ts: ts++, deviceId: DEVICE, goalId: sp.goalId, moduleId: cell.id, id: fixedId() },
        ),
      );
    }
    // course order = dependency: cell[i] → cell[i+1] (linear chain DAG)
    for (let i = 0; i + 1 < sp.cells.length; i++) {
      events.push(
        makeEvent(
          "roadmap.edge.upserted",
          { from: sp.cells[i]!.id, to: sp.cells[i + 1]!.id },
          { ts: ts++, deviceId: DEVICE, id: fixedId() },
        ),
      );
    }
  }
  return events;
}

export const SEED_EVENTS: ArcanumEvent[] = buildSeed();

/** ITC spine + its first cell (CS50 ramp) — stable refs for tests/dispatch. */
export const SEED_GOAL_ID = SPINES[0]!.goalId;
export const SEED_MODULE_ID = SPINES[0]!.cells[0]!.id;
