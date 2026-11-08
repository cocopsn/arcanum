import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecRunner } from "@/lib/exercises-validate";
import { saveExerciseBank, loadBankForModule, getBank } from "@/lib/exercise-store";
import { BLOCKS, bankMd } from "@/forge/__tests__/fixtures/forge-blocks";
import { HIST_FALLAS_JS } from "@/forge/__tests__/fixtures/evaluator-blocks";

// SEED TRUST + M1 with the REAL check modules (no vi.mock of @/forge/bank/check/*): in the seed, the author's code
// never runs — neither the Python/SQL of forense nor the JavaScript of contraejemplo, mutantes, desvanecido,
// retencion and historial fallas (design §9.2, M1, CA-E15). Those steps were verified by bank-check.mjs. The spies
// are on the runtimes (js-runner.execCode and py-runner.runPy): if seed trust breaks (rc22), the real js.check calls
// execCode and the spy catches it. The assertions on res.ok name their `details` first, so a failure reads.

const spies = vi.hoisted(() => ({ execCode: vi.fn(), runPy: vi.fn() }));

vi.mock("@/lib/js-runner", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/js-runner")>();
  return {
    ...real,
    execCode: (...args: Parameters<typeof real.execCode>) => {
      spies.execCode(...args);
      return real.execCode(...args);
    },
  };
});
vi.mock("@/lib/py-runner", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/py-runner")>();
  return {
    ...real,
    runPy: (...args: Parameters<typeof real.runPy>) => {
      spies.runPy(...args);
      return real.runPy(...args);
    },
  };
});

const M = (n: number) => `cf000000-0000-4000-8000-0000000002${String(n).padStart(2, "0")}`;
// The five real JS/SQL types plus historial fallas and a type with no executable step (giro).
const seedBank = (moduleId: string) =>
  bankMd([BLOCKS.contraejemplo, BLOCKS.mutantes, BLOCKS.desvanecido, BLOCKS.forense, BLOCKS.retencion, HIST_FALLAS_JS, BLOCKS.giro], moduleId);

const fakeRun: ExecRunner = async () => ({ syntaxError: null, cases: [] });

let onLine: PropertyDescriptor | undefined;
beforeAll(() => {
  onLine = Object.getOwnPropertyDescriptor(window.navigator, "onLine");
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => false });
});
afterAll(() => {
  if (onLine) Object.defineProperty(window.navigator, "onLine", onLine);
});
beforeEach(() => {
  spies.execCode.mockClear();
  spies.runPy.mockClear();
});

describe("bank-seed-trust (módulos reales) · la semilla no ejecuta código del autor (§9.2, M1, CA-E15)", () => {
  it("un banco sembrado con los seis tipos se guarda y se ofrece sin correr js ni py del autor", async () => {
    const res = await saveExerciseBank(seedBank(M(1)), { source: "seed" });
    const detalles = res.ok ? "" : (res.details ?? []).join(" | ");
    expect(res.ok, `un banco sembrado exigió ejecutar código del autor: ${detalles}`).toBe(true);
    const offered = (await loadBankForModule(M(1))).map((e) => e.itemId);
    expect(offered).toEqual(expect.arrayContaining(["contra-voraz", "mut-max", "suma-desv", "forense-join", "ret-inventario", "hist-fallas", "giro-fuente"]));
    expect(spies.execCode, "la semilla ejecutó JavaScript del autor (M1)").not.toHaveBeenCalled();
    expect(spies.runPy, "la semilla ejecutó Python del autor (M1)").not.toHaveBeenCalled();
  });

  it("el mismo banco importado con runners corre js.check/py.check (control positivo del espía)", async () => {
    // At import, the real js.check runs the author's JavaScript in the caller's runner; here the runner is a fake, so
    // execCode is NOT called by it, but the contrast with the seed (above) is what the trust rule protects. We assert
    // the import path reaches the checks by rejecting without pyRun (forense needs it).
    const res = await saveExerciseBank(seedBank(M(2)), { source: "import", jsRun: fakeRun });
    expect(res.ok, "un banco importado con forense se aceptó sin runtime de Python").toBe(false);
    if (!res.ok) expect((res.details ?? []).join(" ")).toMatch(/no hay runtime para validar|runtime de Python/);
    expect(await getBank(M(2))).toBeNull();
  });
});
