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

// ── OPERATIVO track block (appended) ────────────────────────────────────────────────────────────────
// The FrED Operativo path (the ORION Bridge, Armando's own engineering) is seeded HERE as an APPENDED
// block (own id prefix `b4000000-`, ts strictly after the paths block) — the original (`b0000000-`) and
// paths (`b1000000-`) blocks are NEVER renumbered, so a live log receives ONLY the new events it lacks
// (hydrate set-diff by id → idempotent, no progress touched, no phantom duplicate). node 0 (event id
// `-001`) is UNCHANGED from the prior build (byte-identical payload/ts → a log that already had it sees no
// new op-0 event). All a_mano (defended from first principles). op-6/op-8 have no reading yet → no cell
// (CERO invención — never an empty node). Each `fred-op-N` book RESOLVES here (lib/cell-slugs.ts).
const FRED_GOAL_ID = "a0000000-0000-4000-8000-000000000002";
const FRED_OPERATIVO_PATH_ID = "a1000000-0000-4000-8000-000000000003";
/** stable id of the FrED Operativo ENTRY cell (node 0) — the `fred-op-0` slug resolves here. */
export const FRED_OPERATIVO_ENTRY_ID = "cb000000-0000-4000-8000-000000000009";

// ORDERED — the DAG chains in this order so the fog-of-war climbs the architecture. { cell id, event id,
// title (matches the book), concept tag }. Titles come from the r2 books; nature is a_mano for all.
const OPERATIVO_NODES: { cell: string; ev: string; title: string; concept: string }[] = [
  { cell: "cb000000-0000-4000-8000-000000000009", ev: "b4000000-0000-4000-8000-000000000001", title: "Arquitectura del ORION Bridge", concept: "orion-infra" },
  { cell: "cb000000-0000-4000-8000-00000000000a", ev: "b4000000-0000-4000-8000-000000000002", title: "Transport — la conexión viva del Bridge", concept: "orion-transport" },
  { cell: "cb000000-0000-4000-8000-00000000000b", ev: "b4000000-0000-4000-8000-000000000003", title: "El Dispatcher y los Handlers", concept: "orion-dispatch" },
  { cell: "cb000000-0000-4000-8000-00000000000c", ev: "b4000000-0000-4000-8000-000000000004", title: "Serial y tu primer Handler real", concept: "orion-serial" },
  { cell: "cb000000-0000-4000-8000-00000000000d", ev: "b4000000-0000-4000-8000-000000000005", title: "Capability Cards — el contrato de seguridad", concept: "orion-safety" },
  { cell: "cb000000-0000-4000-8000-00000000000e", ev: "b4000000-0000-4000-8000-000000000006", title: "El Reactive Observer", concept: "orion-reactive" },
  { cell: "cb000000-0000-4000-8000-00000000000f", ev: "b4000000-0000-4000-8000-000000000007", title: "AutoCard — síntesis de capability cards", concept: "orion-safety" },
];

function buildOperativoSeed(): ArcanumEvent[] {
  const events: ArcanumEvent[] = [];
  let t = TS + 2_000_000; // strictly after the paths block; node 0 keeps exactly this ts (byte-identical)
  // 1) the cells
  for (const n of OPERATIVO_NODES) {
    const payload: Record<string, unknown> = {
      title: n.title,
      prereqs: [],
      kind: "cell", // comprehension/implementation node, not a scripted mission
      pathId: FRED_OPERATIVO_PATH_ID,
      nature: "a_mano", // Armando's own engineering — the full adversarial gate applies
      concept: n.concept,
    };
    events.push(makeEvent("module.upserted", payload as never, { ts: t++, deviceId: DEVICE, goalId: FRED_GOAL_ID, moduleId: n.cell, id: n.ev }));
  }
  // 2) the linear chain node[i] → node[i+1] — fog-of-war climbs the ORION architecture. Edge ids own
  //    sub-range `-1NN` (distinct from the cells' `-00N`); appended, so a log that had only node 0 gains
  //    the new cells AND these edges on the next hydrate. node 0 keeps NO incoming edge → still available.
  for (let i = 0; i + 1 < OPERATIVO_NODES.length; i++) {
    events.push(
      makeEvent(
        "roadmap.edge.upserted",
        { from: OPERATIVO_NODES[i]!.cell, to: OPERATIVO_NODES[i + 1]!.cell },
        { ts: t++, deviceId: DEVICE, id: `b4000000-0000-4000-8000-0000000001${String(i).padStart(2, "0")}` },
      ),
    );
  }
  return events;
}

// ── OPERATIVO extension (appended, additive) ────────────────────────────────────────────────────────
// op-6 (Modbus / PLC S7-1200) and op-8 (CV industrial) arrived AFTER the op-0..op-7 block shipped. They are
// seeded HERE as a SEPARATE appended block so buildOperativoSeed above stays BYTE-IDENTICAL (its 7 cells +
// 6 edges never change → a live log that already hydrated them sees no diff). op-6 slots between op-5 and
// op-7, op-8 after op-7, via 3 NEW edges (own id sub-range `-2NN`). The prior op-5→op-7 edge is left in
// place — harmless: op-7's gate becomes {op-5, op-6}, and op-6 already requires op-5, so the direct op-5
// requirement is subsumed. Fresh installs and already-hydrated logs CONVERGE to the identical DAG.
const OP5 = "cb000000-0000-4000-8000-00000000000e";
const OP6 = "cb000000-0000-4000-8000-000000000010";
const OP7 = "cb000000-0000-4000-8000-00000000000f";
const OP8 = "cb000000-0000-4000-8000-000000000011";
const OPERATIVO_EXT: { cell: string; ev: string; title: string; concept: string }[] = [
  { cell: OP6, ev: "b4000000-0000-4000-8000-000000000008", title: "Modbus y el PLC Siemens S7-1200", concept: "orion-plc" },
  { cell: OP8, ev: "b4000000-0000-4000-8000-000000000009", title: "Computer Vision para control industrial", concept: "orion-vision" },
];

function buildOperativoExtension(): ArcanumEvent[] {
  const events: ArcanumEvent[] = [];
  let t = TS + 2_100_000; // strictly after the op-0..op-7 block
  for (const n of OPERATIVO_EXT) {
    const payload: Record<string, unknown> = { title: n.title, prereqs: [], kind: "cell", pathId: FRED_OPERATIVO_PATH_ID, nature: "a_mano", concept: n.concept };
    events.push(makeEvent("module.upserted", payload as never, { ts: t++, deviceId: DEVICE, goalId: FRED_GOAL_ID, moduleId: n.cell, id: n.ev }));
  }
  // op-5 → op-6 → op-7 → op-8 (new edges; the pre-existing op-5 → op-7 edge stays, redundant-but-harmless)
  const chain: [string, string, string][] = [
    [OP5, OP6, "b4000000-0000-4000-8000-000000000200"],
    [OP6, OP7, "b4000000-0000-4000-8000-000000000201"],
    [OP7, OP8, "b4000000-0000-4000-8000-000000000202"],
  ];
  for (const [from, to, id] of chain) {
    events.push(makeEvent("roadmap.edge.upserted", { from, to }, { ts: t++, deviceId: DEVICE, id }));
  }
  return events;
}

// Folder books do NOT create roadmap cells — a book ANCHORS to an existing cell for reading (resolved by
// its slug/UUID handle, lib/cell-slugs.ts) or stays LOOSE. The seed carries the spines + paths + the
// curated Operativo track; the books live in the Dexie reader store (lib/seed-books.ts), never the log.
export const SEED_EVENTS: ArcanumEvent[] = [...buildSeed(), ...buildPaths(), ...buildOperativoSeed(), ...buildOperativoExtension()];

/** ITC spine + its first cell (CS50 ramp) — stable refs for tests/dispatch. */
export const SEED_GOAL_ID = SPINES[0]!.goalId;
export const SEED_MODULE_ID = SPINES[0]!.cells[0]!.id;
