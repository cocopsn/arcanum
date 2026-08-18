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
