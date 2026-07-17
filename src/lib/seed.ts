import { makeEvent, type ArcanumEvent } from "@/core/event";
import { SPINES, pathIdForCell } from "@/lib/spines";

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
      // A cell carrying a directed mission is a HEAVY cell (kind:'mission') — it is
      // mastered ONLY by passing its interrogation (roadmap.isMastered), so its block
      // on the next node is real. Plain cells stay kind:'cell'.
      events.push(
        makeEvent(
          "module.upserted",
          { title: cell.title, prereqs: [], kind: cell.mission ? "mission" : "cell" },
          { ts: ts++, deviceId: DEVICE, goalId: sp.goalId, moduleId: cell.id, id: fixedId() },
        ),
      );
    }
    const edge = (from: string, to: string) =>
      events.push(makeEvent("roadmap.edge.upserted", { from, to }, { ts: ts++, deviceId: DEVICE, id: fixedId() }));
    // course order = dependency over the MAIN line (cells without an explicit branchFrom):
    // cell[i] → cell[i+1] (linear chain DAG, fog-of-war).
    const linear = sp.cells.filter((c) => !c.branchFrom);
    for (let i = 0; i + 1 < linear.length; i++) edge(linear[i]!.id, linear[i + 1]!.id);
    // branch cells (e.g. the IoT track) hang off an explicit point in the line, not the tail.
    for (const cell of sp.cells) if (cell.branchFrom) edge(cell.branchFrom, cell.id);
  }
  return events;
}

// ── PATHS block (additive migration) ────────────────────────────────────────────────────────────
// A goal can hold N PARALLEL PATHS, each with its own cells + fog-of-war. This block is APPENDED
// (never renumbered into the original) with its OWN id prefix `b1000000-…` and a LATER ts, because
// the original seed ids above are already in every existing log — shifting them would rewrite
// history. Existing logs therefore receive ONLY these new events (hydrate re-applies the seed
// idempotently, deduped by id), and the module.upserted re-upserts are LOSSLESS: the projector's
// upsert branch preserves status/mastery/gatePassed and only ADDS pathId/concept/nature.
// This is how the current FrED cells are RE-ASSIGNED to the path "Fundamentos" without losing a thing.
let pseq = 0;
const pathId = () => `b1000000-0000-4000-8000-${String(++pseq).padStart(12, "0")}`;

function buildPaths(): ArcanumEvent[] {
  const events: ArcanumEvent[] = [];
  let t = TS + 1_000_000; // strictly after the original block
  for (const sp of SPINES) {
    sp.paths.forEach((p, i) => {
      events.push(
        makeEvent(
          "path.upserted",
          { path_id: p.id, slug: p.slug, name: p.name, description: p.description, order: i },
          { ts: t++, deviceId: DEVICE, goalId: sp.goalId, id: pathId() },
        ),
      );
    });
    // re-upsert each existing cell WITH its path assignment (+ concept/nature when authored).
    // Idempotent and lossless — progress is preserved by the projector.
    for (const cell of sp.cells) {
      const payload: Record<string, unknown> = {
        title: cell.title,
        prereqs: [],
        kind: cell.mission ? "mission" : "cell",
        pathId: pathIdForCell(sp, cell),
      };
      if (cell.concept) payload.concept = cell.concept;
      if (cell.nature) payload.nature = cell.nature;
      if (cell.parts) payload.parts = cell.parts;
      events.push(
        makeEvent("module.upserted", payload as never, { ts: t++, deviceId: DEVICE, goalId: sp.goalId, moduleId: cell.id, id: pathId() }),
      );
    }
  }
  return events;
}

// ── OPERATIVO ENTRY block (appended) ──────────────────────────────────────────────────────────────
// The FrED Operativo path shipped EMPTY. Its node-0 ENTRY cell is seeded HERE as an APPENDED event (own
// id prefix `b4000000-`, ts strictly after the paths block) — the original (`b0000000-`) and paths
// (`b1000000-`) blocks are NEVER renumbered, so an existing log receives ONLY this new event (hydrate
// set-diff by id → idempotent, no progress touched, no phantom duplicate). No prereq = the path's
// available root (node 0). The `fred-op-0-bridge` book RESOLVES to it (lib/cell-slugs.ts) → it stops
// being loose and shows "Leer" on the cell. Books never create cells; this is a curated SEED cell for
// the operational track, distinct from (and orthogonal to) book ingestion.
const FRED_GOAL_ID = "a0000000-0000-4000-8000-000000000002";
const FRED_OPERATIVO_PATH_ID = "a1000000-0000-4000-8000-000000000003";
/** stable id of the FrED Operativo ENTRY cell (node 0) — the `fred-op-0` slug resolves here. */
export const FRED_OPERATIVO_ENTRY_ID = "cb000000-0000-4000-8000-000000000009";

function buildOperativoSeed(): ArcanumEvent[] {
  const payload: Record<string, unknown> = {
    title: "Arquitectura del ORION Bridge",
    prereqs: [],
    kind: "cell", // comprehension node, not a code mission
    pathId: FRED_OPERATIVO_PATH_ID,
    nature: "a_mano", // intellectual core — defended from first principles; the full adversarial gate applies
    concept: "orion-infra",
  };
  return [
    makeEvent("module.upserted", payload as never, {
      ts: TS + 2_000_000,
      deviceId: DEVICE,
      goalId: FRED_GOAL_ID,
      moduleId: FRED_OPERATIVO_ENTRY_ID,
      id: "b4000000-0000-4000-8000-000000000001",
    }),
  ];
}

// Folder books do NOT create roadmap cells — a book ANCHORS to an existing cell for reading (resolved by
// its slug/UUID handle, lib/cell-slugs.ts) or stays LOOSE. The seed carries the spines + paths + the
// curated Operativo entry cell; the books live in the Dexie reader store (lib/seed-books.ts), never the log.
export const SEED_EVENTS: ArcanumEvent[] = [...buildSeed(), ...buildPaths(), ...buildOperativoSeed()];

/** ITC spine + its first cell (CS50 ramp) — stable refs for tests/dispatch. */
export const SEED_GOAL_ID = SPINES[0]!.goalId;
export const SEED_MODULE_ID = SPINES[0]!.cells[0]!.id;
