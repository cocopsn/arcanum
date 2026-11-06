import { describe, expect, it, vi } from "vitest";

// Design §6.3: ensureForgeBank ingests the packaged bank with saveExerciseBank(md, { source: "seed" }). It saves when
// there is no row, when the packaged md differs from the seed row (a deploy that fixes a bank), or when the seed row
// still has pending items (a deploy that replaces a stub re-validates). It never touches an import row.
const BANKS = vi.hoisted(() => ({ index: {} as Record<string, string>, md: {} as Record<string, string> }));
vi.mock("@/forge/data/bank-index.json", () => ({
  get default() {
    return BANKS.index;
  },
}));
const saveSpy = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock("@/lib/exercise-store", async () => {
  const real = await vi.importActual<typeof import("@/lib/exercise-store")>("@/lib/exercise-store");
  return {
    ...real,
    saveExerciseBank: vi.fn(async (md: string, opts: Parameters<typeof real.saveExerciseBank>[1]) => {
      saveSpy.calls.push(md);
      return real.saveExerciseBank(md, opts);
    }),
  };
});

import { ensureForgeBank, forgeBankSource } from "@/forge/loaders";
import { getBanksForModule, saveExerciseBank } from "@/lib/exercise-store";
import { forgeCellId } from "@/forge/ids";
import Dexie from "dexie";
import { BLOCKS, bankMd } from "@/forge/__tests__/fixtures/forge-blocks";

// a valid Forge bank (the Phase-0 fixture block of a structural type, whose ingestion check is real); the variant
// goes in the title so two versions of the same bank differ in their md
const bank = (code: string, variant: string) => bankMd([BLOCKS.prediccion], forgeCellId(code), `Banco ${code} ${variant}`);

function pack(code: string, md: string) {
  BANKS.index[code] = "0000000000";
  BANKS.md[code] = md;
}
forgeBankSource.load = async (code: string) => {
  const md = BANKS.md[code];
  if (md === undefined) throw new Error("chunk ausente");
  return md;
};

describe("ensureForgeBank (banks-loader, §6.3)", () => {
  it("the fixture bank is valid for the real parser", async () => {
    const r = await saveExerciseBank(bank("P3-01", "¿válido?"), { source: "seed" });
    expect(r.ok, JSON.stringify(r)).toBe(true);
  });

  it("a seed row whose md differs from the packaged one is replaced", async () => {
    await saveExerciseBank(bank("P3-02", "versión vieja"), { source: "seed" });
    const md = bank("P3-02", "versión corregida del despliegue");
    pack("P3-02", md);
    saveSpy.calls = [];
    const r = await ensureForgeBank("P3-02");
    expect(r.ok && r.refreshed, "un banco corregido no llegó al dispositivo tras un despliegue").toBe(true);
    expect((await getBanksForModule(forgeCellId("P3-02"))).find((x) => x.source === "seed")?.md).toBe(md);
  });

  it("a seed row with pending items is validated again even when the md is equal", async () => {
    const md = bank("P3-03", "igual");
    await saveExerciseBank(md, { source: "seed" });
    const row = (await getBanksForModule(forgeCellId("P3-03"))).find((x) => x.source === "seed")!;
    // the row as a deploy left it while a check was still a stub (same DB and table as exercise-store)
    const raw = new Dexie("arcanum-exercises");
    raw.version(1).stores({ banks: "id, moduleId, spine" });
    await raw.table("banks").update(row.id, { pendientes: ["p303-stub"] });
    raw.close();
    pack("P3-03", md);
    saveSpy.calls = [];
    await ensureForgeBank("P3-03");
    expect(saveSpy.calls.length, "un banco con pendientes no se revalidó tras reemplazar el stub").toBe(1);
  });

  it("a seed row equal to the packaged md and without pending items is not saved again", async () => {
    const md = bank("P3-04", "igual y limpio");
    await saveExerciseBank(md, { source: "seed" });
    pack("P3-04", md);
    saveSpy.calls = [];
    expect(await ensureForgeBank("P3-04")).toEqual({ ok: true, refreshed: false, pendientes: [] });
    expect(saveSpy.calls).toHaveLength(0);
  });

  it("an import row is never touched", async () => {
    const mine = bank("P3-05", "mi banco");
    await saveExerciseBank(mine, { source: "import" });
    pack("P3-05", bank("P3-05", "el del despliegue"));
    saveSpy.calls = [];
    const r = await ensureForgeBank("P3-05");
    expect(r.ok && !r.refreshed).toBe(true);
    expect(saveSpy.calls).toHaveLength(0);
    expect((await getBanksForModule(forgeCellId("P3-05"))).find((x) => x.source === "import")?.md).toBe(mine);
  });

  it("an unknown code or a missing chunk never ingests anything", async () => {
    saveSpy.calls = [];
    expect(await ensureForgeBank("ZZ-99")).toEqual({ ok: false, reason: "desconocido" });
    BANKS.index["P3-06"] = "0000000000";
    expect(await ensureForgeBank("P3-06")).toEqual({ ok: false, reason: "no-descargado" });
    expect(saveSpy.calls).toHaveLength(0);
  });
});
