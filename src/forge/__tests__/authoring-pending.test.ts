// D11.5 (integrar-fase0): the authoring side of the §9.2 pending rule. A bank whose items still have a stub
// ingestion check (`{ disponible: false }` → «pendiente») passes ingestion, but its cell is never «Verificado»,
// even when every executable item has an approved bank-check entry (D9).
import { describe, expect, it } from "vitest";
import { authoringState, type ForgeBankForAuthoring } from "@/forge/model/authoring";
import type { ForgeCellData, ForgeRouteData } from "@/forge/data/types";
import p2 from "@/forge/data/routes/p2.json";

const P206 = (p2 as unknown as ForgeRouteData).cells.find((c) => c.code === "P2-06")! as ForgeCellData;
const bank: ForgeBankForAuthoring = { sha10: "abcdef0123", valid: true, items: [{ id: "p206-code", langs: ["javascript"] }, { id: "p206-mut", langs: ["javascript"] }] };
const verification = { sha10: "abcdef0123", items: [{ id: "p206-code", resultado: "paso" }, { id: "p206-mut", resultado: "paso" }] };

describe("authoring · pending items never read «Verificado» (§9.2, D11.5)", () => {
  it("without pending items, every executable item approved → «Verificado»", () => {
    expect(authoringState(P206, { book: true, bank, verification })).toBe("verificado");
  });

  it("with a pending item (stub check), the cell stays «Autorado»", () => {
    const withPending = { ...bank, pendientes: ["p206-mut"] };
    expect(authoringState(P206, { book: true, bank: withPending, verification }), "un banco con pendientes (p206-mut) salió Verificado").toBe("autorado");
  });
});
