import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ForenseData } from "@/forge/bank/types/forense";
import type { BankCheckPy, ExecRunner } from "@/lib/exercises-validate";
import { CHECK_GUARD_RUNNER } from "@/lib/exercises-validate";
import * as checkForense from "@/forge/bank/check/forense";
import {
  decideControl,
  FORENSE_CONTROL_DATOS,
  FORENSE_FN,
  FORENSE_HARNESS_PY,
  forenseSpec,
  gradeForense,
  probarControl,
  runForensePasos,
  screenForenseControl,
  type ForenseSpec,
} from "@/forge/eval/forensics";
import { BLOCKS } from "@/forge/__tests__/fixtures/forge-blocks";
import {
  forgeItem,
  FORENSE_CONTROL_MUDO,
  FORENSE_CORREGIDO_ROTO,
  FORENSE_NO_CARGA,
  FORENSE_NO_NACE,
  FORENSE_NO_ROMPE,
  FORENSE_PASOS_DISTINTOS,
  FORENSE_SQL_ANTES_DEL_PASO,
  realForgeItem,
  realForgeItems,
} from "@/forge/__tests__/fixtures/evaluator-blocks";
import { cpythonRunner, PY } from "@/forge/__tests__/helpers/cpython";

// m · forense (design §5.4, §5.4.1, §11.1). Protections, each with its red-check in tools/redcheck-specs.json:
//  rc12 a control must alarm on the lying pipeline AND stay silent on the corrected one; rc45/rc84 a control cannot
//  read SQLite's catalog (sqlite_master and friends, pragma_* functions); with CPython (the same harness text Pyodide
//  runs): rc14 the databases are read-only for controls; rc80 `_q` refuses a non-simple identifier; rc54, rc55, rc56,
//  rc88, rc89 and rc100 are the rules of verify_forense; rc16 is the «born here» rule. The py.check block without
//  CPython comes with the ingestion check (task 2.4).

const fixture = (block: string): ForenseData => forgeItem(block, "forense").data;
const OK = { filas: 0 };

describe("forense · decideControl", () => {
  it("un control que alarma en los dos pipelines no es correcto", () => {
    expect(decideControl({ miente: { filas: 1 }, corregido: { filas: 1 }, limpios: null }).correcto, "un control que siempre alarma pasó como correcto").toBe(false);
  });
  it("tabla de alarma y silencio (comportamiento)", () => {
    expect(decideControl({ miente: { filas: 3 }, corregido: OK, limpios: null })).toEqual({ correcto: true });
    expect(decideControl({ miente: { filas: 3 }, corregido: OK, limpios: OK })).toEqual({ correcto: true });
    expect(decideControl({ miente: OK, corregido: OK, limpios: null })).toEqual({ correcto: false, motivo: "no-alarma" });
    expect(decideControl({ miente: { filas: 1 }, corregido: { filas: 2 }, limpios: null })).toEqual({ correcto: false, motivo: "alarma-en-corregido" });
    expect(decideControl({ miente: { filas: 1 }, corregido: OK, limpios: { filas: 1 } })).toEqual({ correcto: false, motivo: "alarma-en-limpios" });
    expect(decideControl({ miente: { error: "OperationalError: x" }, corregido: OK, limpios: null })).toEqual({ correcto: false, motivo: "error" });
  });
});

describe("forense · screenForenseControl (sin CPython)", () => {
  it("rechaza un control que lee sqlite_master y acepta la palabra dentro de una cadena", () => {
    for (const q of [
      "SELECT 1 FROM sqlite_master WHERE name = 'resumen' AND sql LIKE '%COUNT(*)%'",
      'SELECT 1 FROM "sqlite_schema"',
      "SELECT 1 FROM main.sqlite_temp_master",
    ]) {
      expect(screenForenseControl(q), `un control que lee sqlite_master pasó como correcto: ${q}`).toEqual({ ok: false, error: FORENSE_CONTROL_DATOS });
    }
    expect(screenForenseControl("SELECT 'sqlite_master' AS x FROM citas")).toEqual({ ok: true, sql: "SELECT 'sqlite_master' AS x FROM citas" });
  });
  it("rechaza las funciones pragma_*, con y sin paréntesis", () => {
    for (const q of [
      "SELECT name FROM pragma_table_info('unidos')",
      "SELECT name FROM PRAGMA_TABLE_INFO ('unidos')",
      "SELECT name FROM pragma_table_info WHERE arg = 'unidos'",
      "SELECT name, type FROM pragma_table_list",
      "SELECT name FROM main.pragma_table_info WHERE arg = 'unidos'",
    ]) {
      expect(screenForenseControl(q), `un control que lee pragma_* pasó como correcto: ${q}`).toEqual({ ok: false, error: FORENSE_CONTROL_DATOS });
    }
  });
  it("rechaza las formas citadas y acepta los controles que miden datos (comportamiento)", () => {
    for (const q of ['SELECT name FROM "pragma_table_info"(\'unidos\')', "SELECT name FROM [pragma_table_info]('unidos')", "SELECT name FROM `pragma_table_info`('unidos')"]) {
      expect(screenForenseControl(q).ok, q).toBe(false);
    }
    expect(screenForenseControl("SELECT 'pragma' AS x FROM unidos").ok).toBe(true);
    expect(screenForenseControl("SELECT id FROM unidos GROUP BY id HAVING COUNT(*) > 1;")).toEqual({ ok: true, sql: "SELECT id FROM unidos GROUP BY id HAVING COUNT(*) > 1" });
    expect(screenForenseControl("DELETE FROM unidos").ok).toBe(false);
  });
  it("el arnés no tiene acento grave, ${, \\u, \\x ni barra seguida de dígito (comportamiento)", () => {
    expect(FORENSE_HARNESS_PY.includes("`")).toBe(false);
    expect(FORENSE_HARNESS_PY.includes("${")).toBe(false);
    expect(/\\u|\\x|\\\d/.test(FORENSE_HARNESS_PY)).toBe(false);
    expect(FORENSE_HARNESS_PY.includes('"\\n".join')).toBe(true);
  });
  it("gradeForense rechaza sin correr nada un control que no pasa el filtro (comportamiento)", async () => {
    let calls = 0;
    const run = async () => {
      calls++;
      return { syntaxError: null, cases: [] };
    };
    const d = fixture(BLOCKS.forense);
    expect(await gradeForense(d, { pasos: ["unir"], controles: ["SELECT 1 FROM sqlite_master"] }, run)).toEqual({ estado: "rechazada", motivo: FORENSE_CONTROL_DATOS });
    expect(await probarControl(d, "SELECT 1; SELECT 2", run)).toMatchObject({ estado: "rechazada" });
    expect(calls).toBe(0);
    expect(await gradeForense(d, { pasos: ["unir"], controles: ["SELECT 1"] }, async () => ({ syntaxError: null, cases: [], pyUnavailable: true }))).toEqual({ estado: "sin-python" });
    expect(await gradeForense(d, { pasos: ["unir"], controles: ["SELECT 1"] }, async () => ({ syntaxError: null, cases: [], timedOut: true }))).toEqual({ estado: "tiempo" });
  });
});

// ── CPython: the same harness text, over real SQLite ───────────────────────────────────────────────────────────

const call = async (fn: string, input: unknown[]) => {
  const r = await cpythonRunner(FORENSE_HARNESS_PY, fn, [{ input, expected: null }]);
  if (r.syntaxError) throw new Error(`el arnés forense no compila: ${r.syntaxError}`);
  return r.cases[0]!;
};
/** verify_forense's problems, or a single «ERROR: …» when the harness raised. */
const problemas = async (spec: ForenseSpec): Promise<string[]> => {
  const c = await call(FORENSE_FN.verificar, [spec]);
  if (c.error !== undefined) return [`ERROR: ${c.error}`];
  const out = c.output as { problemas?: unknown };
  return Array.isArray(out?.problemas) ? (out.problemas as string[]) : [`SALIDA: ${JSON.stringify(c.output)}`];
};

describe.skipIf(!PY)("forense · arnés en CPython", () => {
  it("verify_forense no encuentra problemas en los 4 forense reales ni en BLOCKS.forense (comportamiento)", async () => {
    const reales = realForgeItems("forense");
    expect(reales.map((i) => i.itemId).sort()).toHaveLength(4);
    for (const it of reales) expect(await problemas(forenseSpec(it.data)), it.itemId).toEqual([]);
    expect(await problemas(forenseSpec(fixture(BLOCKS.forense)))).toEqual([]);
  }, 60_000);

  it("sobre P1-02 real, el control de referencia es correcto y SELECT 1 no (comportamiento)", async () => {
    const d = realForgeItem("P1-02", "forense-citas", "forense").data;
    const bien = await gradeForense(d, { pasos: d.mentiras.map((m) => m.paso), controles: d.controles }, cpythonRunner);
    expect(bien).toMatchObject({ estado: "calificada", correcto: true });
    const mal = await gradeForense(d, { pasos: d.mentiras.map((m) => m.paso), controles: d.controles.map(() => "SELECT 1") }, cpythonRunner);
    expect(mal).toMatchObject({ estado: "calificada", correcto: false });
    if (mal.estado === "calificada") expect(mal.porMentira.map((p) => [p.pasoOk, p.controlOk, p.motivo])).toEqual([[true, false, "alarma-en-corregido"], [true, false, "alarma-en-corregido"]]);
    const pasoMal = await gradeForense(d, { pasos: ["resumen", "resumen"], controles: d.controles }, cpythonRunner);
    expect(pasoMal.estado === "calificada" ? pasoMal.porMentira.map((p) => [p.pasoOk, p.controlOk]) : pasoMal).toEqual([[false, true], [false, true]]);
  }, 60_000);

  it("verify_forense: la mentira que no nace en su paso", async () => {
    const p = await problemas(forenseSpec(fixture(FORENSE_NO_NACE)));
    expect(p.join(" | "), "verify_forense aceptó una mentira que no nace en el paso que dice").toContain("no nace en el paso");
    expect(p).toEqual(["la mentira «m1» no nace en el paso «limpiar»"]);
  });
  it("verify_forense: la mentira que no rompe su invariante", async () => {
    const p = await problemas(forenseSpec(fixture(FORENSE_NO_ROMPE)));
    expect(p.join(" | "), "verify_forense aceptó una mentira que no rompe su invariante en el pipeline").toContain("no rompe su invariante en el pipeline");
    expect(p).toHaveLength(1);
  });
  it("verify_forense: el invariante que no se cumple en el corregido", async () => {
    const p = await problemas(forenseSpec(fixture(FORENSE_CORREGIDO_ROTO)));
    expect(p.join(" | "), "verify_forense aceptó un invariante que no se cumple en el corregido").toContain("no se cumple en el corregido");
    expect(p).toEqual(["el invariante «inv-suma» no se cumple en el corregido"]);
  });
  it("verify_forense: el control de referencia mudo", async () => {
    const p = await problemas(forenseSpec(fixture(FORENSE_CONTROL_MUDO)));
    expect(p.join(" | "), "verify_forense aceptó un control de referencia que no distingue los dos pipelines").toContain("no distingue los dos pipelines");
    expect(p).toEqual(["el control de referencia 1 no distingue los dos pipelines"]);
  });
  it("verify_forense: el pipeline que no carga", async () => {
    const p = await problemas(forenseSpec(fixture(FORENSE_NO_CARGA)));
    expect(p.join(" | "), "verify_forense aceptó un pipeline que no carga").toContain("no carga");
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/^el pipeline no carga: /);
  });
  it("verify_forense: la corrección con otros pasos, sin KeyError", async () => {
    const p = await problemas(forenseSpec(fixture(FORENSE_PASOS_DISTINTOS)));
    expect(p.join(" | "), "verify_forense aceptó una corrección que no tiene los mismos pasos que el pipeline").toContain("no tiene los mismos pasos que el pipeline");
    expect(p).toEqual(["la corrección no tiene los mismos pasos que el pipeline"]);
  });
  it("verify_forense: una corrección con SQL antes del primer paso", async () => {
    const p = await problemas(forenseSpec(fixture(FORENSE_SQL_ANTES_DEL_PASO)));
    expect(p.join(" | "), "una corrección con SQL antes del primer paso pasó bank-check").toContain("no tiene los mismos pasos que el pipeline");
  });

  it("_q rechaza un identificador que no es un nombre simple", async () => {
    const c = await call("_q", ["x; DROP TABLE pedidos"]);
    expect(c.error ?? `devolvió ${JSON.stringify(c.output)}`, "un identificador inválido llegó al SQL del arnés").toMatch(/^ValueError/);
    expect((await call("_q", ["unidos"])).output).toBe('"unidos"');
  });
  it("verify_forense con «sobre» inyectado termina en ValueError (comportamiento)", async () => {
    const spec = forenseSpec(fixture(BLOCKS.forense));
    const c = await call(FORENSE_FN.verificar, [{ ...spec, invariantes: [{ ...spec.invariantes[0]!, sobre: "unidos; DROP TABLE pedidos" }] }]);
    expect(c.error ?? "").toMatch(/^ValueError: identificador inválido/);
  });

  it("un control WITH … DELETE falla por solo lectura", async () => {
    const d = realForgeItem("P1-02", "forense-citas", "forense").data;
    const q = "WITH x AS (SELECT 1) DELETE FROM citas";
    expect(screenForenseControl(q).ok).toBe(true); // the client filter lets it through: query_only is the real lock
    const c = await call(FORENSE_FN.probar, [d.esquema, d.datos, d.pipeline.sql, q]);
    const out = c.output as { error?: string };
    expect(out?.error ?? JSON.stringify(c.output), "un control del alumno escribió en la base").toMatch(/readonly|read-only/i);
  });

  it("frescura con tolerancia en días sobre P1-05 (comportamiento)", async () => {
    const d = realForgeItem("P1-05", "forense-panel-cobros", "forense").data;
    const spec = forenseSpec(d);
    expect(await problemas(spec)).toEqual([]);
    // with 20 days of tolerance the backup source (19 feb vs. corte 5 mar) is fresh enough: the lie no longer breaks it
    const tolerante = { ...spec, invariantes: spec.invariantes.map((i) => (i.tipo === "frescura" ? { ...i, tolerancia: 20 } : i)) };
    expect((await problemas(tolerante)).join(" | ")).toContain("la mentira «lee-respaldo» no rompe su invariante en el pipeline");
  });

  it("runForensePasos y probarControl sobre BLOCKS.forense (comportamiento)", async () => {
    const d = fixture(BLOCKS.forense);
    expect(await runForensePasos(d, cpythonRunner)).toEqual([
      { id: "limpiar", objetos: [{ nombre: "limpios", filas: 2 }] },
      { id: "unir", objetos: [{ nombre: "unidos", filas: 3 }] },
    ]);
    expect(await probarControl(d, "SELECT id FROM unidos GROUP BY id HAVING COUNT(*) > 1", cpythonRunner)).toEqual({ cols: ["id"], rows: [[1]], filas: 1 });
    expect(await probarControl(d, "SELECT nada FROM unidos", cpythonRunner)).toMatchObject({ estado: "rechazada" });
    const g = await gradeForense(d, { pasos: ["unir"], controles: ["SELECT id FROM unidos GROUP BY id HAVING COUNT(*) > 1"] }, cpythonRunner);
    expect(g).toEqual({ estado: "calificada", correcto: true, porMentira: [{ pasoOk: true, control: { miente: { filas: 1 }, corregido: { filas: 0 }, limpios: null }, controlOk: true }] });
  }, 30_000);
});

// ── py.check without CPython: a fake pyRun returns a fixed shape per case, so each failure of the harness reaches
//    the author with its own message (rc95–rc98), no Python needed (§5.4, task 2.4) ───────────────────────────────

describe("forense · py.check lleva al autor la causa del fallo del arnés (sin CPython)", () => {
  const item = forgeItem(BLOCKS.forense, "forense");
  const py = checkForense.py!;
  const runWith = (out: { syntaxError: string | null; cases: unknown[]; timedOut?: boolean }): ExecRunner => async () => out as never;
  const prefijo = `«${item.title}» (forense): `;

  const rows: { nombre: string; out: { syntaxError: string | null; cases: unknown[]; timedOut?: boolean }; esperado: string; contiene: string }[] = [
    { nombre: "tiempo (rc96)", out: { syntaxError: null, cases: [], timedOut: true }, esperado: "una verificación forense agotada no dijo que agotó el tiempo", contiene: "agotó el tiempo" },
    { nombre: "sintaxis (rc97)", out: { syntaxError: "SyntaxError: line 3", cases: [] }, esperado: "un arnés forense que no corrió no se reportó como tal", contiene: "el arnés forense no corrió (SyntaxError: line 3)" },
    { nombre: "caso con error (rc95)", out: { syntaxError: null, cases: [{ input: [], expected: null, pass: false, error: "ValueError: identificador inválido: x" }] }, esperado: "un error del arnés forense no llegó al autor", contiene: "la verificación forense falló: ValueError: identificador inválido: x" },
    { nombre: "sin lista problemas (rc98)", out: { syntaxError: null, cases: [{ input: [], expected: null, pass: true, output: { otra: 1 } }] }, esperado: "una salida del arnés forense sin problemas se leyó como lista", contiene: "no devolvió una lista de problemas" },
  ];

  it.each(rows)("$nombre: el error nombra el ítem y la causa", async ({ out, esperado, contiene }) => {
    // A disabled guard may fall through to `out.problemas.map` and throw (rc98): that is also a failure of this
    // protection, so a throw is turned into an empty-error result carrying the esperado message.
    let r: { ok: true } | { ok: false; errors: string[] };
    try {
      r = await (py.check as BankCheckPy)(item, { source: "import", jsRun: CHECK_GUARD_RUNNER, pyRun: runWith(out) });
    } catch {
      r = { ok: false, errors: [] };
    }
    expect(r.ok, esperado).toBe(false);
    if (r.ok) return;
    expect(r.errors.join(" | "), esperado).toContain(contiene);
    expect(r.errors.every((e) => e.startsWith(prefijo)), "un error de ingesta no nombra el ítem (CA-E14)").toBe(true);
  });

  it("py.check acepta BLOCKS.forense cuando el arnés no devuelve problemas", async () => {
    const r = await (py.check as BankCheckPy)(item, { source: "import", jsRun: CHECK_GUARD_RUNNER, pyRun: runWith({ syntaxError: null, cases: [{ input: [], expected: null, pass: true, output: { problemas: [] } }] }) });
    expect(r).toEqual({ ok: true });
  });
});

// ── DOM of ForenseRunner (design §5.4, §11.2 point 1): the lies, the correction, the reference controls and the
//    per-lie step ✓/✗ appear ONLY after a correct submission is in the log (rc13, rc59). runPy is answered by the real
//    CPython harness (the same text), so a correct submission over BLOCKS.forense actually grades to correct. ────────

vi.mock("@/ui/use-actions", () => ({ useActions: () => ({ fire: domEnv.fire, passLesson: domEnv.passLesson }) }));
vi.mock("@/app/providers", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).providersMock);
vi.mock("@/lib/py-runner", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/py-runner")>();
  const { cpythonRunner } = await import("@/forge/__tests__/helpers/cpython");
  return { ...real, runPy: (code: string, fn: string, cases: unknown) => cpythonRunner(code, fn, cases as never) };
});

// A `fire` that writes a real evidence.recorded into the current envelope store (so the read model updates and
// `revelado` can flip), and a passLesson spy. The reveal must come ONLY after a correct submission (rc13/rc59).
const domEnv = vi.hoisted(() => ({
  store: null as import("@/store/arcanum-store").ArcanumStore | null,
  passLesson: vi.fn(async () => {}),
  fire: vi.fn(async (type: string, payload: unknown, refs: { goalId?: string | null; moduleId?: string | null }) => {
    const { makeEvent } = await import("@/core/event");
    const ev = makeEvent(type as never, payload as never, { ts: Date.now(), deviceId: "t", goalId: refs.goalId ?? null, moduleId: refs.moduleId ?? null });
    await domEnv.store!.getState().dispatch(ev, Date.now());
  }),
}));

describe.skipIf(!PY)("forense · DOM del corredor revela sólo tras un acierto (rc13, rc59)", () => {
  afterEach(() => cleanup());

  it("las mentiras, la corrección y el paso ✓ aparecen sólo tras una entrega correcta", async () => {
    const { createEnvelope } = await import("@/forge/__tests__/helpers/flow-envelope");
    const ForenseRunner = (await import("@/forge/ui/exercises/ForenseRunner")).default;
    const env = await createEnvelope();
    domEnv.store = env.store;
    domEnv.passLesson.mockClear();
    const it = forgeItem(BLOCKS.forense, "forense");
    const rm = () => env.store.getState().readModel;
    const CELL = rm().modules[0]?.id ?? "cf000000-0000-4000-8000-0000000000aa";
    const { rerender } = render(<ForenseRunner item={it} cellCode="P1-02" cellId={CELL} readModel={rm()} onClose={() => {}} />);
    // before any submission: no lie id (m1), no correction, no step mark
    expect(screen.queryByText(/nace en unir/), "las mentiras aparecieron antes de una entrega correcta").toBeNull();
    expect(document.querySelector("[data-paso-ok]"), "el ✓/✗ de paso por mentira apareció antes del acierto").toBeNull();
    // a correct submission: lie m1 is born in `unir`; the control counts the duplicated id
    fireEvent.change(screen.getByLabelText("Paso de la mentira 1"), { target: { value: "unir" } });
    fireEvent.change(screen.getByLabelText("Control de la mentira 1"), { target: { value: "SELECT id FROM unidos GROUP BY id HAVING COUNT(*) > 1" } });
    fireEvent.click(screen.getByRole("button", { name: /Entregar/ }));
    await waitFor(() => expect(document.body.textContent).toContain("✓ La mentira localizada"), { timeout: 30000 });
    rerender(<ForenseRunner item={it} cellCode="P1-02" cellId={CELL} readModel={rm()} onClose={() => {}} />);
    await waitFor(() => expect(screen.queryByText(/nace en unir/)).not.toBeNull());
    expect(document.querySelector('[data-paso-ok="0"]')?.textContent).toBe("paso ✓");
    expect(domEnv.passLesson, "no se dio XP por una entrega correcta").toHaveBeenCalled();
  }, 40000);

  it("una entrega con un paso mal marcado no revela el ✓/✗ de paso", async () => {
    const { createEnvelope } = await import("@/forge/__tests__/helpers/flow-envelope");
    const ForenseRunner = (await import("@/forge/ui/exercises/ForenseRunner")).default;
    const env = await createEnvelope();
    domEnv.store = env.store;
    domEnv.passLesson.mockClear();
    const it = forgeItem(BLOCKS.forense, "forense");
    const CELL = env.store.getState().readModel.modules[0]?.id ?? "cf000000-0000-4000-8000-0000000000aa";
    render(<ForenseRunner item={it} cellCode="P1-02" cellId={CELL} readModel={env.store.getState().readModel} onClose={() => {}} />);
    // wrong step (`limpiar` instead of `unir`), with a distinguishing control: the submission is incorrect
    fireEvent.change(screen.getByLabelText("Paso de la mentira 1"), { target: { value: "limpiar" } });
    fireEvent.change(screen.getByLabelText("Control de la mentira 1"), { target: { value: "SELECT id FROM unidos GROUP BY id HAVING COUNT(*) > 1" } });
    fireEvent.click(screen.getByRole("button", { name: /Entregar/ }));
    await waitFor(() => expect(document.body.textContent).toContain("✕ Revisa las mentiras: hay al menos un paso mal marcado."), { timeout: 30000 });
    expect(document.querySelector("[data-paso-ok]"), "el ✓/✗ de paso por mentira apareció antes del acierto").toBeNull();
    expect(domEnv.passLesson).not.toHaveBeenCalled();
  }, 40000);
});
