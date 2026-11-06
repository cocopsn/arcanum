import { describe, it, expect } from "vitest";
import { SEED_EVENTS } from "@/lib/seed";
import { CELL_SLUG_TO_ID, resolveCellId } from "@/lib/cell-slugs";
import {
  FORGE_CELL_CODES,
  FORGE_PATHS,
  FORGE_SLUG_TO_ID,
  codeHex,
  forgeCellId,
  forgeCodeForCellId,
  isDiagnosticCode,
  isForgeCellId,
} from "@/forge/ids";
import { FORGE_SEED_EVENTS } from "@/forge/seed";
import { FORGE_SPINE } from "@/lib/spines-forge";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("Engineering Forge ids (CA-08, §4.1, §4.4)", () => {
  it("codeHex is the ASCII hex of the code, left-padded to 12; examples measured in the design", () => {
    expect(forgeCellId("P2-06")).toBe("cf000000-0000-4000-8000-0050322d3036");
    expect(forgeCellId("SW4-07")).toBe("cf000000-0000-4000-8000-5357342d3037");
    expect(forgeCellId("D1")).toBe("cf000000-0000-4000-8000-000000004431");
    expect(forgeCellId("X24")).toBe("cf000000-0000-4000-8000-000000583234");
    expect(forgeCellId("SD-12")).toBe("cf000000-0000-4000-8000-0053442d3132");
    expect(() => codeHex("p2-06")).toThrow();
    expect(() => codeHex("SW4-071")).toThrow();
    expect(() => codeHex("")).toThrow();
  });

  it("168 codes in RF-M2 order and the spine uses exactly those ids", () => {
    expect(FORGE_CELL_CODES).toHaveLength(168);
    expect(new Set(FORGE_CELL_CODES).size).toBe(168);
    expect(FORGE_SPINE.cells.map((c) => c.id)).toEqual(FORGE_CELL_CODES.map(forgeCellId));
    expect(FORGE_PATHS.reduce((n, p) => n + p.cells, 0)).toBe(168);
  });

  it("every Forge id is a lowercase UUID (v4, variant 8) and unique across SEED_EVENTS and CELL_SLUG_TO_ID", () => {
    const forgeIds = [
      ...FORGE_SEED_EVENTS.map((e) => e.id),
      ...FORGE_SPINE.cells.map((c) => c.id),
      ...FORGE_SPINE.paths.map((p) => p.id),
      FORGE_SPINE.goalId,
    ];
    for (const id of forgeIds) expect(id, id).toMatch(UUID_RE);
    const seedIds = SEED_EVENTS.map((e) => e.id);
    expect(new Set(seedIds).size).toBe(seedIds.length);
    const otherCellIds = new Set(Object.entries(CELL_SLUG_TO_ID).filter(([k]) => !k.startsWith("forge-")).map(([, v]) => v));
    for (const c of FORGE_SPINE.cells) expect(otherCellIds.has(c.id), c.id).toBe(false);
    const otherSeedIds = new Set(SEED_EVENTS.filter((e) => !e.id.startsWith("b5000000-")).map((e) => e.id));
    for (const e of FORGE_SEED_EVENTS) expect(otherSeedIds.has(e.id), e.id).toBe(false);
  });

  it("no Forge event or cell id starts with an existing block prefix (RD-3)", () => {
    for (const e of FORGE_SEED_EVENTS) expect(/^(b0|b1|b4)/.test(e.id), e.id).toBe(false);
    for (const c of FORGE_SPINE.cells) expect(/^(ca|cb|cc|cd|ce)/.test(c.id), c.id).toBe(false);
  });

  it("isForgeCellId is the exact set; code ↔ id round-trips; D1–D8 are the diagnostic codes", () => {
    for (const code of FORGE_CELL_CODES) {
      expect(isForgeCellId(forgeCellId(code))).toBe(true);
      expect(forgeCodeForCellId(forgeCellId(code))).toBe(code);
    }
    expect(isForgeCellId("cf000000-0000-4000-8000-000000000000")).toBe(false);
    expect(isForgeCellId("ca000000-0000-4000-8000-000000000001")).toBe(false);
    expect(FORGE_CELL_CODES.filter(isDiagnosticCode)).toEqual(["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8"]);
  });

  it("§4.4: 168 slugs forge-<code>, none equal to another nor starting with another + '-', within Forge and against every existing key", () => {
    const forgeKeys = Object.keys(FORGE_SLUG_TO_ID);
    expect(forgeKeys).toHaveLength(168);
    const all = Object.keys(CELL_SLUG_TO_ID);
    expect(all.length).toBe(new Set(all).size);
    for (const k of forgeKeys) {
      for (const other of all) {
        if (other === k) continue;
        expect(k.startsWith(other + "-"), `${k} empieza con ${other}-`).toBe(false);
        expect(other.startsWith(k + "-"), `${other} empieza con ${k}-`).toBe(false);
      }
    }
    expect(resolveCellId("forge-p2-06")).toBe(forgeCellId("P2-06"));
    expect(resolveCellId("forge-p2-06-concurrencia")).toBe(forgeCellId("P2-06"));
    expect(resolveCellId("forge-sd-12")).toBe(forgeCellId("SD-12"));
    expect(resolveCellId("forge-d1")).toBe(forgeCellId("D1"));
  });
});
