import { describe, expect, it, vi } from "vitest";
import { saveExerciseBank, loadBankForModule, getBank } from "@/lib/exercise-store";
import { BLOCKS, bankMd } from "@/forge/__tests__/fixtures/forge-blocks";

// REGLA DE PENDIENTES (design §9.2). An item whose check is still a Phase-0 stub ({ disponible: false }) is accepted
// as PENDING: not validated, returned in pendientes, stored in ExerciseBankRow.pendientes, and never offered by
// loadBankForModule. A REAL check that fails still rejects the whole bank (all-or-nothing). The «authoring never says
// Verificado with pendientes» half lives in src/forge/model/authoring.ts (forge/c0-nucleo) and its model test.

vi.mock("@/forge/bank/check/gameday", () => ({ check: async () => ({ disponible: false }), js: undefined, py: undefined }));

const M = (n: number) => `cf000000-0000-4000-8000-0000000002${String(n).padStart(2, "0")}`;

describe("bank-pending · a stub check leaves its item pending, never rejected nor offered", () => {
  it("the bank is saved, the pending item is recorded and not offered; the others are", async () => {
    const res = await saveExerciseBank(bankMd([BLOCKS.giro, BLOCKS.gameday, BLOCKS.prediccion], M(1)), { source: "seed" });
    expect(res.ok, `un chequeo stub rechazó el banco entero: ${res.ok ? "" : (res.details ?? []).join(" | ")}`).toBe(true);
    if (res.ok) expect(res.bank.pendientes).toEqual([`${M(1)}:gd-pagos`]);
    const row = await getBank(M(1));
    expect(row?.pendientes).toEqual([`${M(1)}:gd-pagos`]);
    const offered = (await loadBankForModule(M(1))).map((e) => e.itemId);
    expect(offered, "un ítem pendiente se ofreció en ExerciseMode").not.toContain("gd-pagos");
    expect(offered).toEqual(expect.arrayContaining(["giro-fuente", "pred-join"]));
  });

  it("a bank without pending items stores no pendientes", async () => {
    const res = await saveExerciseBank(bankMd([BLOCKS.giro, BLOCKS.prediccion], M(2)), { source: "seed" });
    expect(res.ok).toBe(true);
    expect((await getBank(M(2)))?.pendientes).toBeUndefined();
  });

  it("a REAL check that fails rejects the whole bank, pending items or not", async () => {
    const brokenSenal = BLOCKS.senal.replace('"senal": "arreglo ordenado"', '"senal": "no aparece en el enunciado"');
    const res = await saveExerciseBank(bankMd([BLOCKS.giro, BLOCKS.gameday, brokenSenal], M(3)), { source: "seed" });
    expect(res.ok, "un chequeo real que falla no rechazó el banco").toBe(false);
    if (!res.ok) expect((res.details ?? []).join(" ")).toMatch(/«Set mixto» \(senal\): ítem 1: la señal/);
    expect(await getBank(M(3))).toBeNull();
  });
});
