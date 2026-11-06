import { describe, it, expect } from "vitest";
import {
  authoringCounts,
  authoringState,
  executableItems,
  unverifiedItems,
  type ForgeArtifacts,
  type ForgeBankForAuthoring,
} from "@/forge/model/authoring";
import type { ForgeCellData, ForgeRouteData } from "@/forge/data/types";
import p2 from "@/forge/data/routes/p2.json";
import retos from "@/forge/data/routes/retos.json";
import diagnostico from "@/forge/data/routes/diagnostico.json";
import expedientes from "@/forge/data/routes/expedientes.json";

const P206 = (p2 as unknown as ForgeRouteData).cells.find((c) => c.code === "P2-06")! as ForgeCellData;

// A P2-06-like bank: two executable items that bank-check (fa4ad29) does not record (desvanecido and retencion in
// forma codigo have no harness), next to executable items it did verify.
const bank: ForgeBankForAuthoring = {
  sha10: "abcdef0123",
  valid: true,
  items: [
    { id: "p206-historial", langs: ["python"] },
    { id: "p206-code", langs: ["javascript", "python"] },
    { id: "p206-desv-version", langs: ["javascript"] },
    { id: "p206-ret-timeout", langs: ["python"] },
    { id: "p206-produccion", langs: [] },
  ],
};
const verifiedSome = {
  sha10: "abcdef0123",
  items: [
    { id: "p206-historial", resultado: "paso" },
    { id: "p206-code", resultado: "paso" },
    { id: "p206-code", resultado: "paso" },
  ],
};
const art = (over: Partial<ForgeArtifacts>): ForgeArtifacts => ({ book: true, bank, verification: verifiedSome, ...over });

describe("authoring state (§5.7, CA-22) — executable items are counted FROM THE BANK", () => {
  it("counts every item with a JS, Python or SQL step, of any type", () => {
    expect(executableItems(bank)).toEqual(["p206-historial", "p206-code", "p206-desv-version", "p206-ret-timeout"]);
  });

  it("an executable item absent from verification keeps the cell out of «Verificado» (names the item)", () => {
    const missing = unverifiedItems(bank, verifiedSome);
    for (const id of ["p206-desv-version", "p206-ret-timeout"]) {
      expect(missing, `${id} no tiene entrada aprobada en verification y no se contó como pendiente`).toContain(id);
    }
    expect(authoringState(P206, art({})), "P2-06 salió «Verificado» sin haber corrido p206-desv-version ni p206-ret-timeout").toBe("autorado");
  });

  it("an entry «sin-verificar» or «fallo» is not an approved run", () => {
    for (const resultado of ["sin-verificar", "fallo"]) {
      const v = { sha10: bank.sha10, items: bank.items.map((i) => ({ id: i.id, resultado: i.id === "p206-desv-version" ? resultado : "paso" })) };
      expect(unverifiedItems(bank, v)).toEqual(["p206-desv-version"]);
      expect(authoringState(P206, art({ verification: v }))).toBe("autorado");
    }
  });

  it("a run of another .md (sha10 mismatch) verifies nothing", () => {
    const v = { sha10: "0000000000", items: bank.items.map((i) => ({ id: i.id, resultado: "paso" })) };
    expect(unverifiedItems(bank, v)).toHaveLength(4);
    expect(authoringState(P206, art({ verification: v }))).toBe("autorado");
  });

  it("with an approved entry for every executable item and the current sha10, the route cell is «Verificado»", () => {
    const v = { sha10: bank.sha10, items: executableItems(bank).map((id) => ({ id, resultado: "paso" })) };
    expect(authoringState(P206, art({ verification: v }))).toBe("verificado");
  });

  it("a bank without executable items, a missing book or an invalid bank never reach «Verificado»", () => {
    const noExec: ForgeBankForAuthoring = { ...bank, items: [{ id: "solo-texto", langs: [] }] };
    expect(authoringState(P206, art({ bank: noExec, verification: { sha10: bank.sha10, items: [] } }))).toBe("autorado");
    expect(authoringState(P206, art({ book: false }))).toBe("especificado");
    expect(authoringState(P206, art({ bank: { ...bank, valid: false } }))).toBe("especificado");
    expect(authoringState(P206, art({ bank: null, verification: null }))).toBe("especificado");
  });

  it("at launch with no artifacts: no route or SD cell says «Autorado», none says «Verificado» (CA-22)", () => {
    const none: ForgeArtifacts = { book: false, bank: null, verification: null };
    const routes = [p2, retos, diagnostico, expedientes] as unknown as ForgeRouteData[];
    const states = routes.flatMap((r) => r.cells.map((c) => ({ c, s: authoringState(c, none) })));
    expect(states.filter(({ s }) => s === "verificado")).toHaveLength(0);
    for (const { c, s } of states) {
      if (c.cls === "ruta" || c.cls === "expediente") expect(s, c.code).toBe("especificado");
      else expect(s, c.code).toBe("autorado"); // X and D: statement + deliverable come from the master program
    }
    expect(authoringCounts(states.map((x) => x.s)).verificado).toBe(0);
  });
});
