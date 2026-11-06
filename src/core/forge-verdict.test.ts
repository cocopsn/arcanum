import { describe, it, expect } from "vitest";
import { forgeKindOpens, forgeVerdictPasses, FORGE_VERDICT_KINDS, type ForgeVerdictFields } from "@/core/forge-verdict";

// RF-V1/RF-V2: the approval rule lives in code and fails CLOSED. CA-34: passed:true with a failed critical
// condition, or an essential capability at 2, does not pass.
const ok = (over: Partial<ForgeVerdictFields> | Record<string, unknown> = {}): unknown => ({
  v: 1, kind: "mision", essential: ["sistemas", "datos"], capabilities: { sistemas: 3, datos: 4, ia: 0 },
  critical: [{ id: "consistencia", passed: true }, { id: "recuperacion", passed: true }],
  failureMode: null, scope: "local", apoyo: "independiente", ...over,
});

describe("forgeVerdictPasses (§8.1)", () => {
  it("passes with every essential ≥ 3 and every critical condition passed (non-essential scores do not matter)", () => {
    expect(forgeVerdictPasses(ok())).toBe(true);
  });
  it("CA-34: an essential at 2, or a failed critical condition, fails", () => {
    expect(forgeVerdictPasses(ok({ capabilities: { sistemas: 2, datos: 4 } }))).toBe(false);
    expect(forgeVerdictPasses(ok({ critical: [{ id: "consistencia", passed: true }, { id: "recuperacion", passed: false }] }))).toBe(false);
  });
  it("fails closed on anything malformed", () => {
    const bad: unknown[] = [
      null, undefined, 1, "x", [], {},
      ok({ v: 2 }), ok({ kind: "otro" }), ok({ kind: undefined }),
      ok({ essential: [] }), ok({ essential: ["magia"] }), ok({ essential: "sistemas" }),
      ok({ capabilities: { sistemas: 3 } }), ok({ capabilities: { sistemas: 3.5, datos: 4 } }), ok({ capabilities: { sistemas: 5, datos: 4 } }),
      ok({ capabilities: { sistemas: "4", datos: 4 } }), ok({ capabilities: null }),
      ok({ critical: [] }), ok({ critical: [{ id: "", passed: true }] }), ok({ critical: [{ id: "c", passed: "true" }] }), ok({ critical: null }),
      ok({ scope: "global" }), ok({ scope: undefined }), ok({ apoyo: "algo" }), ok({ apoyo: undefined }),
    ];
    for (const b of bad) expect(forgeVerdictPasses(b), `la regla aprobó un veredicto malformado: ${JSON.stringify(b)}`).toBe(false);
  });
});

describe("forgeKindOpens (whitelist, review NIT 5)", () => {
  it("only mision, expediente, entrevista, ontologia and gameday may open", () => {
    const opens = FORGE_VERDICT_KINDS.filter((k) => forgeKindOpens({ kind: k }));
    expect(opens).toEqual(["mision", "expediente", "entrevista", "ontologia", "gameday"]);
    for (const x of [{ kind: "retencion" }, { kind: "diagnostico" }, { kind: "otro" }, {}, null, undefined]) {
      expect(forgeKindOpens(x), `un kind fuera de la lista blanca puede abrir: ${JSON.stringify(x)}`).toBe(false);
    }
  });
});
