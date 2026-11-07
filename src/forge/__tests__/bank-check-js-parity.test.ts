import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseExercisesMd } from "@/lib/exercises-md";
import type { ForgeBankItem } from "@/forge/bank/registry";
import type { BankCheckJs, BankCheckModule } from "@/lib/exercises-validate";
import { CHECK_GUARD_RUNNER } from "@/lib/exercises-validate";
import { execRunner } from "@/forge/__tests__/helpers/exec-runner";
import { JS_VERIFIERS, vmRun, deepEqual } from "../../../scripts/forge/bank-check/js-verify.mjs";
import { parseBank } from "../../../scripts/forge/bank-check.mjs";
import * as checkContra from "@/forge/bank/check/contraejemplo";
import * as checkMut from "@/forge/bank/check/mutantes";
import * as checkHist from "@/forge/bank/check/historial";
import { bankMd } from "@/forge/__tests__/fixtures/forge-blocks";
import {
  HIST_FALLAS_JS,
  HIST_INGENUA_PASA,
  HIST_SOLUCION_FALLA,
  CONTRA_TESTIGO_IGUAL,
  MUT_SIN_MATAR,
  MUT_REF_FALLA_DORADO,
} from "@/forge/__tests__/fixtures/evaluator-blocks";

// D2 (design §6.2, §10): the app's js.check (Worker runJs over execCode) and bank-check's JS_VERIFIERS (node:vm) must
// give the SAME verdict for every JavaScript item of contraejemplo, mutantes and historial in mode fallas. Two
// runtimes (the shielded Worker and node:vm): a parity test over the fixtures and the 19 real items keeps them from
// diverging. rc24 lives in js-verify (`if (!killedByGolden)`); a drift there makes a fixture disagree here.

const CHECK: Record<string, NonNullable<BankCheckModule["js"]>["check"]> = {
  contraejemplo: (checkContra as unknown as BankCheckModule).js!.check as BankCheckJs,
  mutantes: (checkMut as unknown as BankCheckModule).js!.check as BankCheckJs,
  historial: (checkHist as unknown as BankCheckModule).js!.check as BankCheckJs,
};

async function appOk(item: ForgeBankItem): Promise<boolean> {
  const r = await CHECK[item.type]!(item, { source: "import", jsRun: execRunner });
  return r.ok;
}

function bankOk(raw: string, itemId: string): boolean {
  const items = parseBank(raw) as { id: string; tipo: string; secciones: unknown[]; enunciado: string; titulo: string }[];
  const it = items.find((x) => x.id === itemId);
  if (!it) throw new Error(`bank-check no encontró ${itemId}`);
  const verifier = (JS_VERIFIERS as Record<string, ((item: unknown, run: typeof vmRun) => { resultado?: string; ok?: boolean }[]) | undefined>)[it.tipo];
  const entries = verifier?.(it, vmRun) ?? [];
  // «sin-verificar» entries (Python without a harness) are not a verdict; the JS entry is.
  const js = entries.filter((e: { resultado?: string }) => e.resultado !== "sin-verificar");
  return js.length > 0 && js.every((e: { ok?: boolean }) => e.ok === true);
}

/** The app item of a fixture block (for the js.check side). */
function appItem(block: string): ForgeBankItem {
  const parsed = parseExercisesMd(bankMd([block]));
  const it = (parsed?.exercises ?? []).find((e): e is ForgeBankItem => e.kind === "forge");
  if (!it) throw new Error("el bloque no parsea");
  return it;
}
/** The id parseBank gives the single item of a fixture bank. */
function bankItemId(block: string): { raw: string; id: string } {
  const raw = bankMd([block]);
  const items = parseBank(raw) as { id: string }[];
  return { raw, id: items[0]!.id };
}

describe("bank-check JS · paridad con la ingesta de la app", () => {
  it("deepEqual de js-verify tiene la semántica de @/lib/exercise", () => {
    expect(deepEqual(NaN, NaN)).toBe(true);
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual(1, "1")).toBe(false);
  });

  const fixtures: { nombre: string; block: string; esperado: boolean }[] = [
    { nombre: "HIST_FALLAS_JS", block: HIST_FALLAS_JS, esperado: true },
    { nombre: "HIST_INGENUA_PASA", block: HIST_INGENUA_PASA, esperado: false },
    { nombre: "HIST_SOLUCION_FALLA", block: HIST_SOLUCION_FALLA, esperado: false },
    { nombre: "CONTRA_TESTIGO_IGUAL", block: CONTRA_TESTIGO_IGUAL, esperado: false },
    { nombre: "MUT_SIN_MATAR", block: MUT_SIN_MATAR, esperado: false },
    { nombre: "MUT_REF_FALLA_DORADO", block: MUT_REF_FALLA_DORADO, esperado: false },
  ];

  it.each(fixtures)("$nombre: bank-check y la app coinciden en $esperado", async ({ block, esperado }) => {
    const { raw, id } = bankItemId(block);
    const app = await appOk(appItem(block));
    const bank = bankOk(raw, id);
    expect(app, "bank-check y la ingesta de la app no coinciden en el veredicto (app)").toBe(esperado);
    expect(bank, "bank-check y la ingesta de la app no coinciden en el veredicto (bank-check)").toBe(esperado);
  });

  // The 19 real JS items: 11 contraejemplo, 7 mutantes and S2-02's historial fallas. All must pass in both paths
  // and give the same verdict.
  const realCodes: { code: string; tipo: string }[] = [
    { code: "a1-01", tipo: "contraejemplo" },
    { code: "a1-07", tipo: "contraejemplo" },
    { code: "p1-04", tipo: "contraejemplo" },
    { code: "s1-03", tipo: "contraejemplo" },
    { code: "s1-05", tipo: "contraejemplo" },
    { code: "s2-04", tipo: "contraejemplo" },
    { code: "sw1-01", tipo: "contraejemplo" },
    { code: "sw1-02", tipo: "contraejemplo" },
    { code: "sw1-04", tipo: "contraejemplo" },
    { code: "sw1-05", tipo: "contraejemplo" },
    { code: "sw1-07", tipo: "contraejemplo" },
    { code: "a1-01", tipo: "mutantes" },
    { code: "a1-07", tipo: "mutantes" },
    { code: "f0-05", tipo: "mutantes" },
    { code: "p1-03", tipo: "mutantes" },
    { code: "p3-05", tipo: "mutantes" },
    { code: "s1-07", tipo: "mutantes" },
    { code: "sw1-03", tipo: "mutantes" },
    { code: "s2-02", tipo: "historial" },
  ];

  it("los 19 ítems JS reales pasan en los dos caminos y coinciden", async () => {
    for (const { code, tipo } of realCodes) {
      const raw = readFileSync(join(process.cwd(), "content", "forge", "exercises", `${code}.md`), "utf8");
      const parsed = parseExercisesMd(raw);
      const forge = (parsed?.exercises ?? []).filter((e): e is ForgeBankItem => e.kind === "forge");
      const bankItems = parseBank(raw) as { id: string; tipo: string; enunciado: string }[];
      const appItems = tipo === "historial" ? forge.filter((i) => i.type === "historial" && i.data.modo === "fallas") : forge.filter((i) => i.type === tipo);
      expect(appItems.length, `${code}: no hay ítems ${tipo}`).toBeGreaterThan(0);
      for (const it of appItems) {
        const app = await appOk(it);
        const bi = bankItems.find((x) => x.id === it.itemId && x.tipo === tipo);
        expect(bi, `${code}: bank-check no tiene ${it.itemId}`).toBeTruthy();
        const bank = bankOk(raw, bi!.id);
        expect(app, `${code}/${it.itemId}: la app reprobó un ítem real`).toBe(true);
        expect(bank, `${code}/${it.itemId}: bank-check y la ingesta de la app no coinciden en el veredicto`).toBe(true);
      }
    }
  });

  it("check nunca ejecuta: el check estructural usa el guardia (M1)", async () => {
    // A quick sanity that CHECK_GUARD_RUNNER is the one the app's check receives (js.check is the one tested above).
    await expect((checkContra as unknown as BankCheckModule).check(appItem(CONTRA_TESTIGO_IGUAL), { source: "import", jsRun: CHECK_GUARD_RUNNER })).resolves.toBeDefined();
  });
});
