import { describe, it, expect } from "vitest";
import type { ForgeRouteData } from "@/forge/data/types";
import { FORGE_PATHS } from "@/forge/ids";
import f0 from "@/forge/data/routes/f0.json";
import a1 from "@/forge/data/routes/a1.json";
import a2 from "@/forge/data/routes/a2.json";
import s1 from "@/forge/data/routes/s1.json";
import s2 from "@/forge/data/routes/s2.json";
import p1 from "@/forge/data/routes/p1.json";
import p2 from "@/forge/data/routes/p2.json";
import p3 from "@/forge/data/routes/p3.json";
import p4 from "@/forge/data/routes/p4.json";
import p5 from "@/forge/data/routes/p5.json";
import f1 from "@/forge/data/routes/f1.json";
import f2 from "@/forge/data/routes/f2.json";
import sw1 from "@/forge/data/routes/sw1.json";
import sw2 from "@/forge/data/routes/sw2.json";
import sw3 from "@/forge/data/routes/sw3.json";
import sw4 from "@/forge/data/routes/sw4.json";
import diagnostico from "@/forge/data/routes/diagnostico.json";
import retos from "@/forge/data/routes/retos.json";
import expedientes from "@/forge/data/routes/expedientes.json";

// The FLUJO table of design §5.2, repeated LITERALLY (frozen in Phase 0). The master program has no such field:
// extract-maestro.mjs copies its constant FLUJOS and infers nothing. Every code not listed is "mision".
const TABLE: Record<string, string[]> = {
  diagnostico: ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8"],
  entrevista: ["F1-02", "F1-03", "X22"],
  expediente: ["SD-01", "SD-02", "SD-03", "SD-04", "SD-05", "SD-06", "SD-07", "SD-08", "SD-09", "SD-10", "SD-11", "SD-12", "S2-08", "X21"],
  ontologia: ["P2-01", "P2-02", "P2-03", "P2-05", "P2-08"],
  gameday: ["P5-08", "F1-07"],
  proyecto: ["F2-01", "F2-02", "F2-03", "F2-04", "F2-05", "F2-06"],
};
const COUNTS: Record<string, number> = { diagnostico: 8, entrevista: 3, expediente: 14, ontologia: 5, gameday: 2, proyecto: 6, mision: 130 };
const COMPUERTA: Record<string, string | null> = {
  mision: "mision", proyecto: "mision", entrevista: "entrevista", expediente: "expediente", ontologia: "ontologia", gameday: "gameday", diagnostico: null,
};
const expected = (code: string) => Object.entries(TABLE).find(([, codes]) => codes.includes(code))?.[0] ?? "mision";

const ROUTES = [f0, a1, a2, s1, s2, p1, p2, p3, p4, p5, f1, f2, sw1, sw2, sw3, sw4, diagnostico, retos, expedientes] as unknown as ForgeRouteData[];
const cells = ROUTES.flatMap((r) => r.cells);

describe("flujo and compuerta of the 168 cells (§5.2)", () => {
  it("the 19 route files are in RF-M2 order", () => {
    expect(ROUTES.map((r) => r.slug)).toEqual(FORGE_PATHS.map((p) => p.slug));
    expect(cells).toHaveLength(168);
  });

  it("every cell has the flujo of the table, cell by cell", () => {
    for (const c of cells) expect(c.flujo, `${c.code} tiene flujo ${c.flujo}; la tabla de §5.2 dice ${expected(c.code)}`).toBe(expected(c.code));
  });

  it("the counts of the last column (they add up to 168)", () => {
    const got: Record<string, number> = {};
    for (const c of cells) got[c.flujo] = (got[c.flujo] ?? 0) + 1;
    expect(got).toEqual(COUNTS);
    expect(Object.values(COUNTS).reduce((a, b) => a + b, 0)).toBe(168);
  });

  it("compuerta follows the flujo with the rule of §5.2 and nothing more (F2-05: proyecto → mision)", () => {
    for (const c of cells) expect(c.compuerta, c.code).toBe(COMPUERTA[c.flujo]);
    const f205 = cells.find((c) => c.code === "F2-05")!;
    expect([f205.flujo, f205.compuerta]).toEqual(["proyecto", "mision"]);
    expect(cells.filter((c) => c.compuerta === null).map((c) => c.code)).toEqual(TABLE.diagnostico);
  });
});
