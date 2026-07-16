import { describe, it, expect, afterEach } from "vitest";
import { buildSnapshot, mcAuthorized, mcToken } from "@/lib/mc-status";
import { civilDayOrdinal, msToDays } from "@/core/time";
import { ARCANUM_CONFIG } from "@/core/config";
import type { ArcanumEvent } from "@/core/event";
import type { ReadModel, ModuleRM, Stats } from "@/core/read-model";

const NOW = 1_700_000_000_000; // fixed "now" (ms)
const nowDays = msToDays(NOW);
const todayOrd = civilDayOrdinal(NOW, ARCANUM_CONFIG.tz);

function mod(p: Partial<ModuleRM> & { id: string }): ModuleRM {
  return { goalId: "g1", pathId: null, concept: null, nature: "a_mano", parts: [], title: "Módulo " + p.id, status: "idle", kind: "core", prereqs: [], S: 5, lastReinforcedDays: nowDays, dueDays: nowDays + 5, startedDays: null, archived: false, firetestRatio: null, x: null, y: null, sourceObligationId: null, gatePassed: false, reinforceCount: 0, ...p };
}
function rm(p: Partial<ReadModel>): ReadModel {
  const stats: Stats = { totalXp: 0, grade: "Scintilla", gradeIndex: 0, currentStreak: 0, longestStreak: 0, shields: 0, lastQualifiedDay: null } as Stats;
  return { goals: [], paths: [], modules: [], edges: [], qualifiedDays: [], stats, reviewDue: [], notes: [], sleepCycles: [], obligations: [], canvas: { lastSyncTs: null, lastOkTs: null, cookieStale: false }, celebratedGrade: null, evaluations: [], gates: [], missions: [], pendingAi: [], cursor: null, ...p };
}
const ev = (type: string, module_id: string | null, ts: number): ArcanumEvent => ({ id: type + ts, type: type as ArcanumEvent["type"], ts, device_id: "d", goal_id: null, module_id, payload: {}, v: 1 });

afterEach(() => {
  delete process.env.MC_STATUS_TOKEN;
});

describe("mc-status — derived snapshot for the Vigía (pure)", () => {
  it("classifies modules into active / mastered / sealed and shapes the review queue", () => {
    const m1 = mod({ id: "m1", status: "started" }); // in progress → active
    const m2 = mod({ id: "m2", status: "completed", dueDays: nowDays - 1 }); // mastered + overdue for review
    const m3 = mod({ id: "m3", status: "idle" }); // gated behind m1 → sealed
    const model = rm({
      goals: [{ id: "g1", title: "ITC", priority: 1, color: "#000", sigil: "x", archived: false }],
      modules: [m1, m2, m3],
      edges: [{ from: "m1", to: "m3" }], // m3 needs m1 mastered; m1 isn't → m3 sealed
      reviewDue: [{ moduleId: "m2", dueDays: m2.dueDays }],
      notes: [{ id: "n1", moduleId: "m1", goalId: null, title: "n", markdown: "", links: [], backlinks: [], createdTs: 0, updatedTs: 0 }],
      stats: { totalXp: 4200, grade: "Faber", gradeIndex: 3, currentStreak: 7, longestStreak: 9, shields: 2, lastQualifiedDay: todayOrd } as Stats,
      cursor: { ts: NOW - 1000, id: "e9" },
    });
    const events = [ev("checkpoint.passed", "m1", NOW - 5000), ev("module.started", "m1", NOW - 9000), ev("note.updated", "m1", NOW - 100)];

    const s = buildSnapshot(model, events, NOW);

    expect(s.stats.totalXp).toBe(4200);
    expect(s.stats.grade).toBe("Faber");
    expect(s.stats.currentStreak).toBe(7);
    expect(s.stats.todayQualified).toBe(true); // lastQualifiedDay === today
    expect(s.counts).toMatchObject({ goals: 1, modules: 3, mastered: 1, active: 1, sealed: 1, reviewDue: 1, notes: 1, pendingAi: 0 });
    expect(s.active.map((a) => a.id)).toEqual(["m1"]);
    expect(s.active[0]!.retrievability).toBeGreaterThan(0); // r = exp(0) = 1 at last=now
    expect(s.reviewDue[0]!.id).toBe("m2");
    expect(s.reviewDue[0]!.overdue).toBe(true); // dueDays < now
    // recent = only NOTABLE events, newest first; note.updated is filtered out
    expect(s.recent.map((r) => r.type)).toEqual(["checkpoint.passed", "module.started"]);
    expect(s.recent[0]!.module).toBe("Módulo m1"); // module title resolved
    expect(s.lastEventTs).toBe(NOW - 1000);
  });

  it("todayQualified is false when the last qualified day isn't today (streak not alive today)", () => {
    const s = buildSnapshot(rm({ stats: { totalXp: 0, grade: "Scintilla", gradeIndex: 0, currentStreak: 0, longestStreak: 3, shields: 0, lastQualifiedDay: todayOrd - 2 } as Stats }), [], NOW);
    expect(s.stats.todayQualified).toBe(false);
  });

  it("never counts an archived module", () => {
    const s = buildSnapshot(rm({ modules: [mod({ id: "a", status: "started", archived: true })] }), [], NOW);
    expect(s.counts.modules).toBe(0);
    expect(s.active).toHaveLength(0);
  });
});

describe("mc-status — token auth (constant-time, server-only)", () => {
  it("authorizes only the exact configured token", () => {
    process.env.MC_STATUS_TOKEN = "mc-token-abcdefghijklmnop"; // ≥16 chars
    expect(mcAuthorized("mc-token-abcdefghijklmnop")).toBe(true);
    expect(mcAuthorized("wrong-token-abcdefghijkl")).toBe(false);
    expect(mcAuthorized("short")).toBe(false); // length mismatch → false (no throw)
    expect(mcAuthorized(null)).toBe(false);
    expect(mcAuthorized(undefined)).toBe(false);
  });

  it("stays DISABLED when the token is missing or trivially short (endpoints refuse everything)", () => {
    expect(mcToken()).toBeNull();
    expect(mcAuthorized("anything")).toBe(false);
    process.env.MC_STATUS_TOKEN = "tooshort"; // < 16 chars → treated as unset
    expect(mcToken()).toBeNull();
    expect(mcAuthorized("tooshort")).toBe(false);
  });
});
