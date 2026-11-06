import { describe, it, expect, vi } from "vitest";
import { SEED_EVENTS } from "@/lib/seed";
import { SPINES } from "@/lib/spines";
import { FORGE_SPINE, FORGE_CELL_META } from "@/lib/spines-forge";
import { FORGE_SEED_EVENTS, FORGE_SEED_TS, FORGE_EDGE_COUNT, seedText } from "@/forge/seed";
import { FORGE_GOAL_ID, FORGE_PATHS, forgeCellId, forgeEventId } from "@/forge/ids";
import { project, applyEvents } from "@/core/projector";
import { nodeStatus } from "@/core/roadmap";
import { makeEvent, type ArcanumEvent } from "@/core/event";
import { createDb } from "@/db/schema";
import { appendEvents, getAllEvents } from "@/db/repo";

const isForgeSeed = (e: ArcanumEvent) => e.id.startsWith("b5000000-");
const forgePathIds = new Set(FORGE_PATHS.map((p) => p.id));

describe("Engineering Forge — world and seed (CA-02 … CA-05, CA-09 … CA-11)", () => {
  it("is the LAST spine, titled «Engineering Forge», with its own seed block (RF-M1)", () => {
    const last = SPINES[SPINES.length - 1]!;
    expect(last).toBe(FORGE_SPINE);
    expect(last.goalTitle).toBe("Engineering Forge");
    expect(last.sigil).toBe("forge");
    expect(last.ownSeedBlock).toBe(true);
    expect(last.goalId).toBe(FORGE_GOAL_ID);
  });

  it("CA-02: 19 paths in the RF-M2 order with 8/7/8/24/12 cells (168 in total); titles start with the code", () => {
    expect(FORGE_SPINE.paths.map((p) => p.slug)).toEqual([
      "f0", "a1", "a2", "s1", "s2", "p1", "p2", "p3", "p4", "p5", "f1", "f2", "sw1", "sw2", "sw3", "sw4", "diagnostico", "retos", "expedientes",
    ]);
    expect(FORGE_SPINE.paths.map((p) => p.id)).toEqual(FORGE_PATHS.map((p) => p.id));
    expect(FORGE_SPINE.cells).toHaveLength(168);
    for (const p of FORGE_PATHS) expect(FORGE_SPINE.cells.filter((c) => c.pathSlug === p.slug), p.slug).toHaveLength(p.cells);
    FORGE_SPINE.cells.forEach((c, i) => {
      const code = FORGE_CELL_META[i]!.code;
      expect(c.title.startsWith(`${code} · `), c.title).toBe(true);
      expect(c.id).toBe(forgeCellId(code));
    });
    expect(FORGE_SPINE.paths.slice(16).map((p) => p.name)).toEqual(["Diagnóstico inicial", "Banco de retos", "Expedientes de system design"]);
  });

  it("the block has 296 events: 1 goal, 19 paths, 168 modules, 108 edges, consecutive ts from FORGE_SEED_TS", () => {
    expect(FORGE_SEED_EVENTS).toHaveLength(296);
    expect(FORGE_SEED_TS).toBe(Date.UTC(2026, 10, 5, 18, 0, 0));
    expect(FORGE_SEED_EVENTS.map((e) => e.ts)).toEqual(Array.from({ length: 296 }, (_, i) => FORGE_SEED_TS + i));
    const types = FORGE_SEED_EVENTS.map((e) => e.type);
    expect(types.filter((t) => t === "goal.upserted")).toHaveLength(1);
    expect(types.filter((t) => t === "path.upserted")).toHaveLength(19);
    expect(types.filter((t) => t === "module.upserted")).toHaveLength(168);
    expect(types.filter((t) => t === "roadmap.edge.upserted")).toHaveLength(FORGE_EDGE_COUNT);
    expect(FORGE_SEED_EVENTS[0]!.payload).toEqual({ title: "Engineering Forge", priority: 1, color: "#ffffff", sigil: "forge" });
    expect(FORGE_SEED_EVENTS.every((e) => e.device_id === "seed" && e.v === 1)).toBe(true);
    // every Forge seed event is in SEED_EVENTS, appended at the tail
    expect(SEED_EVENTS.slice(-296)).toEqual([...FORGE_SEED_EVENTS]);
  });

  it("CA-10: every Forge ts is greater than the maximum of the previous seed", () => {
    const prevMax = Math.max(...SEED_EVENTS.filter((e) => !isForgeSeed(e)).map((e) => e.ts));
    expect(Math.min(...FORGE_SEED_EVENTS.map((e) => e.ts))).toBeGreaterThan(prevMax);
  });

  it("CA-03: 160 mission cells, D1–D8 diagnostic; only the first of each route is available; D/X/SD all available; no D mastered", () => {
    const rm = project(SEED_EVENTS);
    const byId = new Map(rm.modules.map((m) => [m.id, m]));
    const forge = FORGE_SPINE.cells.map((c) => byId.get(c.id)!);
    expect(forge.filter((m) => m.kind === "mission")).toHaveLength(160);
    expect(forge.filter((m) => m.kind === "diagnostic").map((m) => m.title.split(" · ")[0])).toEqual(["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8"]);
    for (const p of FORGE_PATHS) {
      const cells = FORGE_SPINE.cells.filter((c) => c.pathSlug === p.slug).map((c) => byId.get(c.id)!);
      const st = cells.map((m) => nodeStatus(m, rm.edges, byId));
      if (p.code === "D" || p.code === "X" || p.code === "SD") expect(st.every((s) => s === "available"), p.slug).toBe(true);
      else expect(st, p.slug).toEqual(["available", ...Array(cells.length - 1).fill("sealed")]);
    }
    expect(forge.every((m) => m.status === "idle" && !m.gatePassed)).toBe(true);
  });

  it("CA-04: an AI pass in cell k of a route opens only k+1 of that route; ITC C1 changes no Forge cell", () => {
    const rm0 = project(SEED_EVENTS);
    const byId0 = new Map(rm0.modules.map((m) => [m.id, m]));
    const status0 = new Map(rm0.modules.map((m) => [m.id, nodeStatus(m, rm0.edges, byId0)]));
    const p2 = FORGE_SPINE.cells.filter((c) => c.pathSlug === "p2");
    const forge = {
      v: 1, kind: "mision", essential: ["abstraccion"], capabilities: { abstraccion: 3 },
      critical: [{ id: "consistencia", passed: true }], failureMode: null, scope: "local", apoyo: "independiente",
    };
    const verdict = makeEvent(
      "gate.evaluated",
      { passed: true, score: 0.9, summary: "s", feedback: "f", source: "ai", provider: "azure", forge },
      { ts: FORGE_SEED_TS + 10_000_000, deviceId: "t", goalId: FORGE_GOAL_ID, moduleId: p2[0]!.id, id: "c4000000-0000-4000-8000-000000000001" },
    );
    const rm = project([...SEED_EVENTS, verdict]);
    const byId = new Map(rm.modules.map((m) => [m.id, m]));
    const changed = rm.modules.filter((m) => nodeStatus(m, rm.edges, byId) !== status0.get(m.id)).map((m) => m.id);
    expect(changed).toEqual([p2[1]!.id]);
    // ITC C1 mastered: no Forge cell changes
    const itc = SPINES[0]!;
    const itcPass = makeEvent(
      "gate.evaluated",
      { passed: true, score: 1, summary: "s", feedback: "f", source: "ai", provider: "azure" },
      { ts: FORGE_SEED_TS + 10_000_001, deviceId: "t", goalId: itc.goalId, moduleId: itc.cells[1]!.id, id: "c4000000-0000-4000-8000-000000000002" },
    );
    const rm2 = project([...SEED_EVENTS, itcPass]);
    const byId2 = new Map(rm2.modules.map((m) => [m.id, m]));
    for (const c of FORGE_SPINE.cells) expect(nodeStatus(byId2.get(c.id)!, rm2.edges, byId2)).toBe(status0.get(c.id));
  });

  it("CA-05: every Forge edge joins two cells of the same path", () => {
    const pathOf = new Map(FORGE_SPINE.cells.map((c) => [c.id, c.pathSlug]));
    const edges = FORGE_SEED_EVENTS.filter((e) => e.type === "roadmap.edge.upserted");
    expect(edges).toHaveLength(108);
    for (const e of edges) {
      const p = e.payload as { from: string; to: string };
      expect(pathOf.get(p.from), `${p.from}→${p.to}`).toBeDefined();
      expect(pathOf.get(p.from)).toBe(pathOf.get(p.to));
      expect(e.goal_id).toBeNull();
      expect(e.module_id).toBeNull();
    }
  });

  it("RD-4: no event outside the b5000000- block carries a Forge goal, cell, path or edge (positional constructors skip Forge)", () => {
    for (const e of SEED_EVENTS.filter((x) => !isForgeSeed(x))) {
      const p = e.payload as Record<string, unknown>;
      const offending =
        e.goal_id === FORGE_GOAL_ID ||
        !!e.module_id?.startsWith("cf") ||
        (e.type === "path.upserted" && forgePathIds.has(String(p.path_id))) ||
        (e.type === "roadmap.edge.upserted" && (String(p.from).startsWith("cf") || String(p.to).startsWith("cf")));
      expect(offending, "un constructor posicional sembró eventos de Forge (RD-4)").toBe(false);
    }
  });

  it("CA-09: the Forge block is byte-identical when a dummy spine is inserted before Forge in SPINES", async () => {
    const before = JSON.stringify(FORGE_SEED_EVENTS);
    vi.resetModules();
    vi.doMock("@/lib/spines", async () => {
      const real = await vi.importActual<typeof import("@/lib/spines")>("@/lib/spines");
      const dummy = { ...real.SPINES[0]!, goalId: "a0000000-0000-4000-8000-0000000000ff", goalTitle: "Dummy", cells: [] };
      const spines = [...real.SPINES.slice(0, -1), dummy, real.SPINES[real.SPINES.length - 1]!];
      return { ...real, SPINES: spines };
    });
    const mod = await import("@/lib/seed");
    const after = JSON.stringify(mod.SEED_EVENTS.filter(isForgeSeed));
    vi.doUnmock("@/lib/spines");
    vi.resetModules();
    expect(after, "el bloque de Forge depende de su posición en SPINES").toBe(before);
  });

  it("CA-11: on a log that has the whole previous seed, hydrating adds exactly the Forge events, and again adds 0", async () => {
    const db = createDb(`forge-seed-${Math.round(performance.now())}`);
    try {
      const previous = SEED_EVENTS.filter((e) => !isForgeSeed(e));
      await appendEvents(db, previous);
      const n0 = (await getAllEvents(db)).length;
      await appendEvents(db, SEED_EVENTS);
      const n1 = (await getAllEvents(db)).length;
      await appendEvents(db, SEED_EVENTS);
      const n2 = (await getAllEvents(db)).length;
      expect(n1 - n0).toBe(296);
      expect(n2 - n1).toBe(0);
    } finally {
      await db.delete();
    }
  });

  it("event ids follow §4.1 (goal literal; K=0001 path, 0002 module, 0003 edge by destination)", () => {
    expect(FORGE_SEED_EVENTS[0]!.id).toBe("b5000000-0000-4000-8000-000000000001");
    expect(FORGE_SEED_EVENTS.find((e) => e.type === "path.upserted")!.id).toBe(forgeEventId("path", "F0"));
    const p206 = FORGE_SEED_EVENTS.find((e) => e.module_id === forgeCellId("P2-06"))!;
    expect(p206.id).toBe(forgeEventId("module", "P2-06"));
    const edgeTo = FORGE_SEED_EVENTS.find((e) => e.type === "roadmap.edge.upserted" && (e.payload as { to: string }).to === forgeCellId("P2-06"))!;
    expect(edgeTo.id).toBe(forgeEventId("edge", "P2-06"));
    expect((edgeTo.payload as { from: string }).from).toBe(forgeCellId("P2-05"));
  });

  it("only the mixed cells carry nature + parts (A2-06, F2-05), at the end of the payload", () => {
    const mixed = FORGE_SEED_EVENTS.filter((e) => e.type === "module.upserted" && "nature" in (e.payload as object));
    expect(mixed.map((e) => (e.payload as { title: string }).title.split(" · ")[0])).toEqual(["A2-06", "F2-05"]);
    for (const e of mixed) expect(Object.keys(e.payload as object)).toEqual(["title", "prereqs", "kind", "pathId", "nature", "parts"]);
  });

  it("applyEvents == project over the seed (incremental == rebuild on the seeded log)", () => {
    const full = project(SEED_EVENTS);
    const inc = applyEvents(project(SEED_EVENTS.slice(0, 50)), SEED_EVENTS.slice(50), SEED_EVENTS).model;
    expect(inc).toEqual(full);
  });
});

describe("seedText (§4.2)", () => {
  it("keeps a short text (NFC, collapsed whitespace)", () => {
    expect(seedText("  Código   y\n diseño  ")).toBe("Código y diseño");
  });
  it("cuts a long text at the last space before unit 240 and appends …", () => {
    const s = Array.from({ length: 80 }, (_, i) => `palabra${i}`).join(" ");
    const out = seedText(s);
    expect(out.length).toBeLessThanOrEqual(240);
    expect(out.endsWith("…")).toBe(true);
    expect(s.startsWith(out.slice(0, -1))).toBe(true);
    expect(s[out.length - 1]).toBe(" ");
  });
  it("without spaces keeps 239 units plus …", () => {
    const out = seedText("x".repeat(300));
    expect(out).toBe("x".repeat(239) + "…");
  });
  it("300 emojis without spaces: no lone surrogate half, ≤ 240 units, ends in …", () => {
    const out = seedText("😀".repeat(300));
    expect(out.length).toBeLessThanOrEqual(240);
    expect(out.endsWith("…")).toBe(true);
    const body = out.slice(0, -1);
    const last = body.charCodeAt(body.length - 1);
    expect(last >= 0xd800 && last <= 0xdbff, "seedText partió un par sustituto").toBe(false);
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(body), "seedText partió un par sustituto").toBe(false);
  });
});
