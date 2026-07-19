import { describe, it, expect } from "vitest";
import { resolveCellId, CELL_SLUG_TO_ID } from "@/lib/cell-slugs";

const ITC_C1 = "ca000000-0000-4000-8000-000000000002";
const ITC_C4 = "ca000000-0000-4000-8000-000000000005";
const FRED_S2 = "cb000000-0000-4000-8000-000000000002";
const FRED_OP0 = "cb000000-0000-4000-8000-000000000009"; // FrED Operativo entry (node 0)

describe("cell-slugs — resolve a book handle → cell (match) or null (loose)", () => {
  it("resolves a slug WITH a descriptive suffix to its cell (boundary prefix)", () => {
    expect(resolveCellId("itc-c1-asintotico")).toBe(ITC_C1);
    expect(resolveCellId("fred-s2-ml-anomalias")).toBe(FRED_S2);
    expect(resolveCellId("itc-c4-arboles")).toBe(ITC_C4);
    expect(resolveCellId("fred-op-0-bridge")).toBe(FRED_OP0); // Operativo node 0 (seeded)
  });

  it("resolves a bare canonical slug, case/space tolerant", () => {
    expect(resolveCellId("itc-c1")).toBe(ITC_C1);
    expect(resolveCellId("  FRED-S2 ")).toBe(FRED_S2);
  });

  it("resolves the new Competitiva + Alemán slugs (CC)", () => {
    expect(resolveCellId("cp1-two-pointers")).toBe("cd000000-0000-4000-8000-000000000001");
    expect(resolveCellId("cp8-segment-tree")).toBe("cd000000-0000-4000-8000-000000000008");
    expect(resolveCellId("cp5")).toBe("cd000000-0000-4000-8000-000000000005"); // bare
    // a whole-level German book anchors at the level's ENTRY cell (A1.1 / A2.1)
    expect(resolveCellId("de-a1-fundamentos")).toBe("cc000000-0000-4000-8000-000000000001");
    expect(resolveCellId("de-a2-conversacion")).toBe("cc000000-0000-4000-8000-000000000006");
    expect(resolveCellId("de-a1")).toBe("cc000000-0000-4000-8000-000000000001"); // bare
  });

  it("passes a raw cell UUID through when it is a known cell", () => {
    expect(resolveCellId(ITC_C4)).toBe(ITC_C4);
  });

  it("returns null (LOOSE) when the handle matches nothing", () => {
    expect(resolveCellId("random-book")).toBeNull();
    expect(resolveCellId(null)).toBeNull();
    expect(resolveCellId("   ")).toBeNull();
    expect(resolveCellId("cc000000-0000-4000-8000-000000000999")).toBeNull(); // a UUID that is NOT a known cell
  });

  it("requires the HYPHEN boundary — a prefix without it does not match (no index-swallowing)", () => {
    expect(resolveCellId("itc-c1x")).toBeNull(); // not "itc-c1" and not "itc-c1-…"
    expect(resolveCellId("itc-c")).toBeNull();
  });

  it("every registered slug maps to a DISTINCT existing cell id", () => {
    const ids = Object.values(CELL_SLUG_TO_ID);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
