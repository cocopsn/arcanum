import { describe, it, expect } from "vitest";
import { project } from "@/core/projector";
import { SEED_EVENTS } from "@/lib/seed";
import { SPINES } from "@/lib/spines";
import { contentForModule } from "@/lib/subject-content";

const itc = SPINES.find((s) => s.goalTitle === "ITC")!;
const fred = SPINES.find((s) => s.goalTitle === "FrED Factory")!;
const iot = itc.cells.find((c) => c.branchFrom)!; // the IoT (TC1004B) branch cell
const c4 = itc.cells.find((c) => c.title.startsWith("C4"))!;
const rm = project(SEED_EVENTS);

describe("ITC · IoT track (TC1004B) — a real branch that REFERENCES FrED (no duplication)", () => {
  it("the IoT cell branches off C4, not the linear tail", () => {
    expect(iot.branchFrom).toBe(c4.id);
    expect(rm.edges.some((e) => e.from === c4.id && e.to === iot.id)).toBe(true);
    const linear = itc.cells.filter((c) => !c.branchFrom);
    const c8 = linear[linear.length - 1]!;
    expect(rm.edges.some((e) => e.from === c8.id && e.to === iot.id)).toBe(false); // not the tail
  });

  it("its references resolve to REAL FrED cells (the shared foundation lives once)", () => {
    expect(iot.references!.length).toBeGreaterThan(0);
    const fredIds = new Set(fred.cells.map((c) => c.id));
    for (const ref of iot.references!) expect(fredIds.has(ref)).toBe(true);
    // surfaced honestly in the cell content with their real titles
    const content = contentForModule(iot.id)!;
    expect(content.references.length).toBe(iot.references!.length);
    expect(content.references.every((r) => r.title.length > 0)).toBe(true);
  });

  it("does NOT duplicate FrED's data-layer sources — it anchors its own TC1004B URL", () => {
    const referencedUrls = new Set(
      (iot.references ?? []).flatMap((id) => fred.cells.find((c) => c.id === id)?.sourceUrls ?? []),
    );
    expect(iot.sourceUrls.length).toBeGreaterThan(0);
    for (const u of iot.sourceUrls) expect(referencedUrls.has(u)).toBe(false); // disjoint = references, not copies
  });

  it("every cell id across ALL spines is unique (a cell lives once in the log)", () => {
    const ids = SPINES.flatMap((s) => s.cells.map((c) => c.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every branchFrom resolves to a same-spine cell and every reference resolves (no dangling edge)", () => {
    const allIds = new Set(SPINES.flatMap((s) => s.cells.map((c) => c.id)));
    for (const sp of SPINES) {
      const sameSpine = new Set(sp.cells.map((c) => c.id));
      for (const c of sp.cells) {
        if (c.branchFrom) expect(sameSpine.has(c.branchFrom)).toBe(true); // branch hangs inside its spine
        for (const r of c.references ?? []) expect(allIds.has(r)).toBe(true); // cross-spine ref exists
      }
    }
  });
});

describe("ITC · built to depth (TC1031: 8 DS&A heavy missions + CS50 ramp)", () => {
  it("is a CS50 ramp (plain) + 8 heavy DS&A missions + the IoT branch", () => {
    const ramp = itc.cells[0]!;
    expect(ramp.mission).toBeFalsy(); // nodo cero, rampa mínima (light/review, not heavy)
    expect(ramp.title).toMatch(/CS50/);
    const dsa = itc.cells.filter((c) => c.mission && !c.branchFrom);
    expect(dsa.length).toBe(8); // C1..C8
  });

  it("C4 is the AVL heavy mission (the verification target) — anchored to 6.006 L6-L7", () => {
    expect(c4.mission).toBeTruthy();
    expect(c4.title).toMatch(/AVL|balanceados/);
    expect(c4.sourceUrls.some((u) => u.includes("mit6_006s20_lec7"))).toBe(true);
    expect(rm.modules.find((m) => m.id === c4.id)!.kind).toBe("mission");
  });
});
