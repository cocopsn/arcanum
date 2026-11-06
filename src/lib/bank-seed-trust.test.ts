import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecRunner } from "@/lib/exercises-validate";
import { saveExerciseBank, loadBankForModule, getBank } from "@/lib/exercise-store";
import { BLOCKS, bankMd } from "@/forge/__tests__/fixtures/forge-blocks";

// SEED TRUST + M1 (design §9.2; D6 obligation M1). In the SEED, no author code runs at ingestion: neither Python/SQL
// (`py`) nor JavaScript (`js`: mutants, naive solutions), and `check` can never execute (its jsRun refuses). Those
// steps were verified by bank-check.mjs (verification/<código>.json, sha10 of the .md). At IMPORT, `js` and `py`
// run only through the runners the caller passes (Worker / Pyodide); without them the bank is rejected.

const spies = vi.hoisted(() => ({
  py: { forense: vi.fn(), historial: vi.fn(), desvanecido: vi.fn() },
  js: { mutantes: vi.fn() },
  execCode: vi.fn(),
}));

// (vitest mocks throw on a missing export, so absent members are declared as undefined, as a real module reads them)
vi.mock("@/forge/bank/check/forense", () => ({ check: async () => ({ ok: true }), js: undefined, py: { needs: () => true, check: spies.py.forense } }));
vi.mock("@/forge/bank/check/historial", () => ({ check: async () => ({ ok: true }), js: undefined, py: { needs: () => true, check: spies.py.historial } }));
vi.mock("@/forge/bank/check/desvanecido", () => ({ check: async () => ({ ok: true }), js: undefined, py: { needs: () => true, check: spies.py.desvanecido } }));
vi.mock("@/forge/bank/check/mutantes", () => ({ check: async () => ({ ok: true }), js: { needs: () => true, check: spies.js.mutantes }, py: undefined }));
// a check that (wrongly) tries to execute author JS inside `check`: M1 says it must never run
vi.mock("@/forge/bank/check/contraejemplo", () => ({
  check: async (_item: unknown, ctx: { jsRun: ExecRunner; pyRun?: ExecRunner }) => {
    if (ctx.pyRun) throw new Error("check recibió pyRun: podría ejecutar Python fuera de py.check");
    await ctx.jsRun("function elegir(t) { return t.length; }", "elegir", [{ input: [[1]], expected: 1 }]);
    return { ok: true };
  },
  js: undefined,
  py: undefined,
}));
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

const HIST_FALLAS_PY = `## Cobro idempotente
type: historial
id: hist-fallas
modo: fallas

Implementa un cobro idempotente bajo fallas.

### Firma
~~~python
def cobrar(servicio, clave, monto):
    pass
~~~

### Arnés
~~~python
def arnes(calendario):
    return {"una_operacion": True}
~~~

### Calendarios
~~~json
[{ "nombre": "falla-antes", "eventos": ["falla"], "espera": { "una_operacion": true } }]
~~~

### Solución
~~~python
def cobrar(servicio, clave, monto):
    return servicio.cobrar(clave, monto)
~~~

### Ingenua
~~~python
def cobrar(servicio, clave, monto):
    return servicio.cobrar(None, monto)
~~~`;

const DESV_PY = `## Suma desvanecida en Python
type: desvanecido
id: suma-py
lang: python

Completa la suma.

### Pasos
1. Inicializa el acumulador.
2. Recorre la lista.

### Plantilla
~~~python
def suma(xs):
    # <paso 1>
    t = 0
    # </paso 1>
    # <paso 2>
    for x in xs:
        t += x
    # </paso 2>
    return t
~~~

### Casos
~~~json
[{ "input": [[1, 2, 3]], "expected": 6 }]
~~~

### Niveles
- 1: 1
- 2: 1, 2`;

const M = (n: number) => `cf000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`;
const trustBank = (moduleId: string) => bankMd([BLOCKS.forense, HIST_FALLAS_PY, DESV_PY, BLOCKS.mutantes, BLOCKS.giro], moduleId);

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
  for (const f of [...Object.values(spies.py), ...Object.values(spies.js)]) {
    f.mockReset();
    f.mockImplementation(async () => {
      throw new Error("este paso no debe correr en la semilla");
    });
  }
  spies.execCode.mockClear();
});

describe("bank-seed-trust · the seed never executes author code (§9.2, M1)", () => {
  it("a seeded bank with Python/SQL and JS steps is saved and offered without running any of them", async () => {
    const res = await saveExerciseBank(trustBank(M(1)), { source: "seed" });
    expect(res.ok, `un banco sembrado exigió Python para ingerirse: ${res.ok ? "" : (res.details ?? []).join(" | ")}`).toBe(true);
    const offered = (await loadBankForModule(M(1))).map((e) => e.itemId);
    expect(offered).toEqual(expect.arrayContaining(["forense-join", "hist-fallas", "suma-py", "mut-max", "giro-fuente"]));
    for (const [type, f] of Object.entries(spies.py)) expect(f, `la semilla corrió py.check de ${type}`).not.toHaveBeenCalled();
    expect(spies.js.mutantes, "la semilla ejecutó mutantes o soluciones ingenuas (M1)").not.toHaveBeenCalled();
    expect(spies.execCode, "la semilla ejecutó código del autor en el hilo principal (M1)").not.toHaveBeenCalled();
  });

  it("M1: a check that tries to execute author JS is refused in the seed, and nothing runs on the main thread", async () => {
    const md = bankMd([BLOCKS.contraejemplo, BLOCKS.giro], M(2));
    const res = await saveExerciseBank(md, { source: "seed" });
    expect(spies.execCode, "la semilla ejecutó código del autor en el hilo principal (M1)").not.toHaveBeenCalled();
    expect(res.ok, "un chequeo ejecutó código del autor durante la semilla y el banco se aceptó (M1)").toBe(false);
    if (!res.ok) expect((res.details ?? []).join(" ")).toMatch(/M1/);
    expect(await getBank(M(2))).toBeNull();
  });

  it("M1 at import: `check` cannot execute either; only js.check/py.check get the caller's runners", async () => {
    const jsRun = vi.fn(fakeRun);
    const res = await saveExerciseBank(bankMd([BLOCKS.contraejemplo, BLOCKS.giro], M(3)), { source: "import", jsRun, pyRun: fakeRun });
    expect(res.ok, "check ejecutó código del autor al importar y el banco se aceptó (M1)").toBe(false);
    if (!res.ok) {
      const details = (res.details ?? []).join(" ");
      expect(details, "check recibió pyRun al importar: podría ejecutar Python fuera de py.check").not.toMatch(/recibió pyRun/);
      expect(details).toMatch(/M1/);
    }
    expect(jsRun, "check recibió el runner del llamador").not.toHaveBeenCalled();
    expect(spies.execCode).not.toHaveBeenCalled();
  });

  it("the same bank imported without pyRun is rejected: no hay runtime para validar", async () => {
    const res = await saveExerciseBank(trustBank(M(4)), { source: "import", jsRun: fakeRun });
    expect(res.ok).toBe(false);
    if (!res.ok) expect((res.details ?? []).join(" ")).toMatch(/no hay runtime para validar/);
    expect(await getBank(M(4))).toBeNull();
  });

  it("imported without a worker jsRun, the JS steps are not run on the main thread: rejected", async () => {
    for (const f of Object.values(spies.py)) f.mockResolvedValue({ ok: true });
    const res = await saveExerciseBank(trustBank(M(5)), { source: "import", pyRun: fakeRun });
    expect(res.ok).toBe(false);
    if (!res.ok) expect((res.details ?? []).join(" ")).toMatch(/runtime aislado \(worker\)/);
    expect(spies.js.mutantes).not.toHaveBeenCalled();
    expect(spies.execCode).not.toHaveBeenCalled();
  });

  it("with a fake pyRun and jsRun, py.check runs once per Python/SQL item and js.check once per JS item", async () => {
    for (const f of [...Object.values(spies.py), ...Object.values(spies.js)]) f.mockResolvedValue({ ok: true });
    const res = await saveExerciseBank(trustBank(M(6)), { source: "import", jsRun: fakeRun, pyRun: fakeRun });
    expect(res.ok, res.ok ? "" : (res.details ?? []).join(" | ")).toBe(true);
    for (const f of Object.values(spies.py)) expect(f).toHaveBeenCalledTimes(1);
    expect(spies.js.mutantes).toHaveBeenCalledTimes(1);
  });

  it("a pyUnavailable from the runner is reported as today", async () => {
    for (const f of [...Object.values(spies.py), ...Object.values(spies.js)]) {
      f.mockImplementation(async (_item: unknown, ctx: { pyRun?: ExecRunner }) => {
        if (ctx.pyRun) await ctx.pyRun("x", "y", []);
        return { ok: true };
      });
    }
    const unavailable: ExecRunner = async () => ({ syntaxError: null, cases: [], pyUnavailable: true });
    const res = await saveExerciseBank(trustBank(M(7)), { source: "import", jsRun: fakeRun, pyRun: unavailable });
    expect(res.ok).toBe(false);
    if (!res.ok) expect((res.details ?? []).join(" ")).toMatch(/runtime de Python no disponible — no se pudo validar/);
  });
});
