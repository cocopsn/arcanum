import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { SEED_EVENTS } from "@/lib/seed";

// SEED FREEZE — anti-renumbering regression. The pre-OA seed universe (b0 spines block + b1 paths
// block + b4 Operativo blocks, 137 events) is FROZEN by fingerprint: adding the OA Amazon spine at
// the TAIL of SPINES appends new events but must leave every previously-shipped event byte-identical
// (same id, same ts, same payload). If this test goes red, something reordered/renumbered shipped
// history — a live device would receive duplicate/foreign events on hydrate. Fix the CAUSE (restore
// the original ids/ts); NEVER update the frozen hash unless the old events were deliberately and
// verifiably migrated (which the seed architecture forbids — appended blocks only).
//
// Fingerprint captured on HEAD 3838961 (pre-OA), 2026-08-17, via a one-run probe over ALL events.

const OA_GOAL_ID = "a0000000-0000-4000-8000-000000000005";
const OA_PATH_ID = "a1000000-0000-4000-8000-000000000006";
const OA_CELL_PREFIX = "ce000000-"; // every OA Amazon cell id lives under this prefix

const FROZEN_COUNT = 137;
const FROZEN_SHA256 = "b2ab548428f3818db203aded4cf4cab8374f34715b1795826fb172b08e5a03bd";

// Engineering Forge (design §4.5) — its own appended block (b5000000- events, cf000000- cells); skipped by the
// pre-OA fingerprint above exactly like the OA block. Its own fingerprint lands after the production probe.
const FORGE_GOAL_ID_FROZEN = "a0000000-0000-4000-8000-000000000006";
const FORGE_EVENT_PREFIX = "b5000000-";
const FORGE_CELL_PREFIX = "cf000000-";
function isForgeEvent(e: (typeof SEED_EVENTS)[number]): boolean {
  if (e.goal_id === FORGE_GOAL_ID_FROZEN || e.id.startsWith(FORGE_EVENT_PREFIX)) return true;
  if (e.module_id?.startsWith(FORGE_CELL_PREFIX)) return true;
  const fp = e.payload as Record<string, unknown>;
  if (e.type === "roadmap.edge.upserted") {
    const from = typeof fp.from === "string" ? fp.from : "";
    const to = typeof fp.to === "string" ? fp.to : "";
    if (from.startsWith(FORGE_CELL_PREFIX) || to.startsWith(FORGE_CELL_PREFIX)) return true;
  }
  return false;
}

function isOaEvent(e: (typeof SEED_EVENTS)[number]): boolean {
  if (e.goal_id === OA_GOAL_ID) return true;
  if (e.module_id?.startsWith(OA_CELL_PREFIX)) return true;
  const p = e.payload as Record<string, unknown>;
  if (e.type === "path.upserted" && p.path_id === OA_PATH_ID) return true;
  if (e.type === "roadmap.edge.upserted") {
    const from = typeof p.from === "string" ? p.from : "";
    const to = typeof p.to === "string" ? p.to : "";
    if (from.startsWith(OA_CELL_PREFIX) || to.startsWith(OA_CELL_PREFIX)) return true;
  }
  if (isForgeEvent(e)) return true;
  return false;
}

describe("seed freeze — shipped history is never renumbered", () => {
  it("every pre-OA seed event is byte-identical to the frozen fingerprint (count + sha256)", () => {
    const frozen = SEED_EVENTS.filter((e) => !isOaEvent(e));
    const lines = [...frozen]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((e) => `${e.id}|${e.ts}|${e.type}|${e.goal_id ?? ""}|${e.module_id ?? ""}|${JSON.stringify(e.payload)}`);
    expect(lines.length, "pre-OA seed event count shifted — a shipped block gained/lost events").toBe(FROZEN_COUNT);
    const sha = createHash("sha256").update(lines.join("\n")).digest("hex");
    expect(sha, "a shipped seed event mutated (id/ts/payload) — appended blocks only, never renumber").toBe(FROZEN_SHA256);
  });

  it("OA events (once seeded) never reuse a pre-OA id block", () => {
    const oa = SEED_EVENTS.filter(isOaEvent);
    // whatever block the OA events land in, none may collide with a frozen id
    const frozenIds = new Set(SEED_EVENTS.filter((e) => !isOaEvent(e)).map((e) => e.id));
    for (const e of oa) expect(frozenIds.has(e.id), `OA event ${e.id} collides with a shipped id`).toBe(false);
  });
});

// OA BLOCK FREEZE (Engineering Forge, design §4.5). The OA Amazon block is frozen by its OWN fingerprint,
// with its OWN predicate (independent of isOaEvent above, which also skips later appended blocks). Captured
// on HEAD 0098936 before any Forge code: written with empty values, run red, count + hash read from the
// failure, fixed, run green (both runs in .agents/tasks/arcanum-forge/oa-fingerprint.txt). Never updated.
const OA_FROZEN_COUNT = 43;
const OA_FROZEN_SHA256 = "90124e7f5e73e6e55f7c4533f32b0460686e8bb1a161852d60762f233cc20316";

function isOaBlockEvent(e: (typeof SEED_EVENTS)[number]): boolean {
  if (e.goal_id === OA_GOAL_ID) return true;
  if (e.module_id?.startsWith(OA_CELL_PREFIX)) return true;
  const p = e.payload as Record<string, unknown>;
  if (e.type === "path.upserted" && p.path_id === OA_PATH_ID) return true;
  if (e.type === "roadmap.edge.upserted") {
    const from = typeof p.from === "string" ? p.from : "";
    const to = typeof p.to === "string" ? p.to : "";
    if (from.startsWith(OA_CELL_PREFIX) || to.startsWith(OA_CELL_PREFIX)) return true;
  }
  return false;
}

describe("seed freeze — the OA block", () => {
  it("the OA block is frozen by its own fingerprint", () => {
    const lines = SEED_EVENTS.filter(isOaBlockEvent)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((e) => `${e.id}|${e.ts}|${e.type}|${e.goal_id ?? ""}|${e.module_id ?? ""}|${JSON.stringify(e.payload)}`);
    expect(lines.length, "OA block mutated: the OA seed block gained or lost events").toBe(OA_FROZEN_COUNT);
    const sha = createHash("sha256").update(lines.join("\n")).digest("hex");
    expect(sha, "OA block mutated: an OA seed event changed (id/ts/payload)").toBe(OA_FROZEN_SHA256);
  });
});

// FORGE BLOCK FREEZE (Engineering Forge, design §4.5 step 4 and §19.2). The Forge block (src/forge/seed.ts: 1 goal,
// 19 paths, 168 cells, 108 edges) is frozen by its OWN fingerprint, with its OWN predicate: isForgeEvent above is the
// skip helper of the older fingerprints, so a later appended block can be excluded here without touching it. Same
// line format and id order as the blocks above. Captured on main 8f9d723 (merge of PR #1, the commit served in
// production), 2026-11-06, after the production probe passed: written with empty values, run red twice (count, then
// hash, read from the failure), fixed, run green (the three runs in .agents/tasks/arcanum-forge/forge-fingerprint.txt).
// Never updated.
const FORGE_FROZEN_COUNT = 296;
const FORGE_FROZEN_SHA256 = "9b3d4954c6eb53715b34a1317cc778948ae0de18ab64a7b39d5f841b8e60e723";

function isForgeBlockEvent(e: (typeof SEED_EVENTS)[number]): boolean {
  if (e.goal_id === FORGE_GOAL_ID_FROZEN || e.id.startsWith(FORGE_EVENT_PREFIX)) return true;
  if (e.module_id?.startsWith(FORGE_CELL_PREFIX)) return true;
  const p = e.payload as Record<string, unknown>;
  if (e.type === "roadmap.edge.upserted") {
    const from = typeof p.from === "string" ? p.from : "";
    const to = typeof p.to === "string" ? p.to : "";
    if (from.startsWith(FORGE_CELL_PREFIX) || to.startsWith(FORGE_CELL_PREFIX)) return true;
  }
  return false;
}

describe("seed freeze — the Forge block", () => {
  it("the Forge block is frozen by its own fingerprint", () => {
    const lines = SEED_EVENTS.filter(isForgeBlockEvent)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((e) => `${e.id}|${e.ts}|${e.type}|${e.goal_id ?? ""}|${e.module_id ?? ""}|${JSON.stringify(e.payload)}`);
    expect(lines.length, "Forge block mutated: the Forge seed block gained or lost events").toBe(FORGE_FROZEN_COUNT);
    const sha = createHash("sha256").update(lines.join("\n")).digest("hex");
    expect(sha, "Forge block mutated: a Forge seed event changed (id/ts/payload)").toBe(FORGE_FROZEN_SHA256);
  });
});
