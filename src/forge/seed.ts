// ENGINEERING FORGE — its OWN seed block (design §4.2). 296 events with fixed ids derived from the codes
// (prefix b5000000-), ts from FORGE_SEED_TS (2026-11-05T18:00:00Z, later than every seeded event, Amoxtli's
// included), built ONLY from FORGE_SPINE / FORGE_CELL_META (never from SPINES or a position in it), so inserting
// a world before Forge changes nothing here (CA-09). Once shipped, this block is frozen like the others.
import { makeEvent, type ArcanumEvent } from "@/core/event";
import { FORGE_CELL_META, FORGE_SPINE } from "@/lib/spines-forge";
import { FORGE_GOAL_EVENT_ID, FORGE_GOAL_ID, FORGE_PATHS, forgeEventId, isDiagnosticCode } from "@/forge/ids";

/** Date.UTC(2026, 10, 5, 18, 0, 0) — 2026-11-05T18:00:00Z */
export const FORGE_SEED_TS = 1793901600000;

const DEVICE = "seed";
const SEED_TEXT_MAX = 240;

/** The seed's text normalization for path descriptions: NFC, collapsed whitespace, ≤ 240 UTF-16 units. A longer
 *  text is cut at the last space before unit 240 and gets «…»; with no space, 239 units are kept (238 when unit 239
 *  would split a surrogate pair) plus «…». Never leaves a lone surrogate half. */
export function seedText(s: string): string {
  const t = s.normalize("NFC").replace(/\s+/g, " ").trim();
  if (t.length <= SEED_TEXT_MAX) return t;
  const k = t.lastIndexOf(" ", SEED_TEXT_MAX - 1);
  if (k > 0) return t.slice(0, k) + "…";
  const hi = t.charCodeAt(SEED_TEXT_MAX - 2);
  const keep = hi >= 0xd800 && hi <= 0xdbff ? SEED_TEXT_MAX - 2 : SEED_TEXT_MAX - 1;
  return t.slice(0, keep) + "…";
}

function buildForgeSeed(): ArcanumEvent[] {
  const events: ArcanumEvent[] = [];
  let ts = FORGE_SEED_TS;
  const pathCode = new Map(FORGE_PATHS.map((p) => [p.slug, p.code] as const));
  const pathIdBySlug = new Map(FORGE_SPINE.paths.map((p) => [p.slug, p.id] as const));

  // 1 · the goal (color #ffffff: the D4 neutral, a six-digit hex because LaneHeader appends an alpha)
  events.push(
    makeEvent(
      "goal.upserted",
      { title: FORGE_SPINE.goalTitle, priority: 1, color: FORGE_SPINE.color, sigil: FORGE_SPINE.sigil },
      { ts: ts++, deviceId: DEVICE, goalId: FORGE_GOAL_ID, id: FORGE_GOAL_EVENT_ID },
    ),
  );
  // 2 · the 19 paths, in order
  FORGE_SPINE.paths.forEach((p, order) => {
    const code = pathCode.get(p.slug as never);
    if (!code) throw new Error(`path de Forge sin código: ${p.slug}`);
    events.push(
      makeEvent(
        "path.upserted",
        { path_id: p.id, slug: p.slug, name: p.name, description: seedText(p.description), order },
        { ts: ts++, deviceId: DEVICE, goalId: FORGE_GOAL_ID, id: forgeEventId("path", code) },
      ),
    );
  });
  // 3 · the 168 cells: kind "diagnostic" in D1–D8, "mission" elsewhere; nature + parts only on the mixed ones
  FORGE_SPINE.cells.forEach((cell, i) => {
    const meta = FORGE_CELL_META[i];
    if (!meta) throw new Error(`celda de Forge sin metadatos: ${cell.title}`);
    const pathId = pathIdBySlug.get(cell.pathSlug ?? "");
    if (!pathId) throw new Error(`celda de Forge sin path: ${meta.code}`);
    const payload: Record<string, unknown> = {
      title: cell.title,
      prereqs: [],
      kind: isDiagnosticCode(meta.code) ? "diagnostic" : "mission",
      pathId,
    };
    if (cell.nature && cell.nature !== "a_mano") {
      payload.nature = cell.nature;
      payload.parts = cell.parts ?? [];
    }
    events.push(
      makeEvent("module.upserted", payload as never, {
        ts: ts++,
        deviceId: DEVICE,
        goalId: FORGE_GOAL_ID,
        moduleId: cell.id,
        id: forgeEventId("module", meta.code),
      }),
    );
  });
  // 4 · the linear chain inside each of the 16 routes (12 × 7 + 4 × 6 = 108); D, X and SD have no edges
  for (const p of FORGE_PATHS) {
    if (p.code === "D" || p.code === "X" || p.code === "SD") continue;
    const idx = FORGE_SPINE.cells.map((c, i) => ({ c, i })).filter(({ c }) => c.pathSlug === p.slug);
    for (let k = 0; k + 1 < idx.length; k++) {
      const from = idx[k]!.c.id;
      const to = idx[k + 1]!;
      events.push(
        makeEvent("roadmap.edge.upserted", { from, to: to.c.id }, { ts: ts++, deviceId: DEVICE, id: forgeEventId("edge", FORGE_CELL_META[to.i]!.code) }),
      );
    }
  }
  return events;
}

/** The Forge seed block: 1 goal + 19 paths + 168 cells + 108 edges = 296 events. */
export const FORGE_SEED_EVENTS: readonly ArcanumEvent[] = buildForgeSeed();
/** Edges of the block (seed.test.ts adds it to the positional count). */
export const FORGE_EDGE_COUNT = 108;
