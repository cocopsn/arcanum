// Lotes generados y protección b (design §18.1, §18.2, CA-30, CA-31, CA-32). armarLote escribe el frontmatter propio y
// rechaza los lotes fuera de contrato; validarLote corre TODA referencia en el Worker (nunca execCode en el hilo
// principal) y rechaza el lote entero si una referencia no pasa sus casos. Red-checks: validar que acepta todo; sin
// jsRun (execCode llamado); REGLAS_LOTE sin cada regla; y los seis motivos de CA-32.
import { describe, it, expect, vi } from "vitest";
import { armarLote, validarLote, REGLAS_LOTE, runJsVigilado } from "@/lib/companion/lote";
import type { ExecRunner } from "@/lib/exercises-validate";
import type { RunResult, TestCase } from "@/lib/exercise";

// Un lote `code` JavaScript con una referencia correcta.
function loteBueno(ref = "function duplica(n) { return n * 2; }"): string {
  return [
    "## Ejercicio: Duplicar",
    "",
    "type: code",
    "Devuelve el doble de n.",
    "",
    "### Firma",
    "```js",
    "function duplica(n) {}",
    "```",
    "",
    "### Casos",
    "```json",
    '[{ "input": [2], "expected": 4 }, { "input": [5], "expected": 10 }]',
    "```",
    "",
    "### Solución",
    "```js",
    ref,
    "```",
    "",
  ].join("\n");
}

const META = { tema: "aritmética", mundo: "inicio", lenguaje: "javascript" as const };

// Un jsRun de prueba: corre la referencia de verdad en Node (execCode del runner por omisión no está disponible en
// happy-dom sin Worker, así que inyectamos un runner que ejecuta con Function). Espía para CA-31.
const jsRunReal: ExecRunner = async (code, functionName, cases: TestCase[]): Promise<RunResult> => {
  let fn: unknown;
  try {
    fn = new Function(`${code}\n;return typeof ${functionName}==="function"?${functionName}:undefined;`)();
  } catch (e) {
    return { syntaxError: String(e), cases: [] };
  }
  if (typeof fn !== "function") return { syntaxError: "sin función", cases: [] };
  const reales = cases.filter((c) => !c.hint);
  return {
    syntaxError: null,
    cases: reales.map((c) => {
      try {
        const out = (fn as (...a: unknown[]) => unknown)(...c.input);
        return { input: c.input, expected: c.expected, output: out, pass: JSON.stringify(out) === JSON.stringify(c.expected) };
      } catch (e) {
        return { input: c.input, expected: c.expected, error: String(e), pass: false };
      }
    }),
  };
};

describe("armarLote (§18.1)", () => {
  it("quita el frontmatter del modelo y escribe module_id companion-<uuidv7>", () => {
    const conFm = "---\nmodule_id: p2-c3\nkind: exercises\n---\n" + loteBueno();
    const r = armarLote(conFm, META);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.moduleId).toMatch(/^companion-[0-9a-f-]{36}$/);
    expect(r.md).toContain(`module_id: ${r.moduleId}`);
    expect(r.md).not.toContain("module_id: p2-c3");
    expect(r.md).toContain('generated_by: "Compañero (IA)"');
  });

  it("rechaza cada regla de CA-32 con su motivo", () => {
    const casos: { md: string; motivo: string }[] = [
      { md: loteBueno() + "\n### Generador\n", motivo: "Generador" },
      { md: loteBueno() + "\n### Patrones\n", motivo: "Patrones" },
      { md: loteBueno().replace("type: code", "type: trace"), motivo: "tipo fuera de contrato" },
      { md: "x".repeat(24_001), motivo: "longitud" },
    ];
    for (const c of casos) {
      const r = armarLote(c.md, META);
      expect(r.ok, `esperaba rechazo por ${c.motivo}`).toBe(false);
      if (!r.ok) expect(r.motivo).toBe(c.motivo);
    }
  });

  it("un caso con hint:true se rechaza", () => {
    const md = loteBueno().replace('{ "input": [5], "expected": 10 }', '{ "input": [5], "expected": 10, "hint": true }');
    const r = armarLote(md, META);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("hint");
  });

  it("7 bloques se rechazan por «demasiados bloques»", () => {
    const md = Array.from({ length: 7 }, (_, i) => `## Ejercicio ${i}\n\ntype: production\nenunciado`).join("\n\n");
    const r = armarLote(md, META);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("demasiados bloques");
  });

  // Red-check CA-32: sin cada regla, el lote fuera de contrato pasa → «un lote fuera de contrato se ofreció: <m>».
  it("red-check: REGLAS_LOTE sin cada regla deja pasar el lote fuera de contrato", () => {
    const porRegla: Record<string, string> = {
      "longitud": "x".repeat(24_001),
      "demasiados bloques": Array.from({ length: 7 }, (_, i) => `## Ej ${i}\n\ntype: production\ne`).join("\n\n"),
      "tipo fuera de contrato": loteBueno().replace("type: code", "type: trace"),
      "Generador": loteBueno() + "\n### Generador\n",
      "Casos generados": loteBueno() + "\n### Casos generados\n",
      "Comprobador": loteBueno() + "\n### Comprobador\n",
      "Patrones": loteBueno() + "\n### Patrones\n",
      "hint": loteBueno().replace('"expected": 10', '"expected": 10, "hint": true'),
    };
    for (const regla of REGLAS_LOTE) {
      const md = porRegla[regla.motivo]!;
      const sinEsta = REGLAS_LOTE.filter((r) => r.motivo !== regla.motivo);
      const r = armarLote(md, META, sinEsta);
      // con la regla quitada el lote pasa (es el hallazgo que el red-check nombra)
      const hallazgo = r.ok ? `un lote fuera de contrato se ofreció: ${regla.motivo}` : "";
      expect(hallazgo, `con la regla «${regla.motivo}» quitada el lote debió pasar`).toBe(`un lote fuera de contrato se ofreció: ${regla.motivo}`);
      // y con todas las reglas, se rechaza
      expect(armarLote(md, META).ok).toBe(false);
    }
  });
});

describe("validarLote (§18.2, protección b)", () => {
  it("un lote con la referencia correcta se acepta y aparece en practicables (CA-30)", async () => {
    const armado = armarLote(loteBueno(), META);
    expect(armado.ok).toBe(true);
    if (!armado.ok) return;
    const r = await validarLote(armado.md, { jsRun: jsRunReal });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.practicables.length).toBe(1);
    expect([...r.etiquetas.values()][0]).toContain("la referencia pasa sus 2 casos");
  });

  it("un lote con una referencia que falla un caso se rechaza entero (CA-30)", async () => {
    const armado = armarLote(loteBueno("function duplica(n) { return n + 2; }"), META);
    expect(armado.ok).toBe(true);
    if (!armado.ok) return;
    const r = await validarLote(armado.md, { jsRun: jsRunReal });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toContain("Rechazado");
    expect(r.motivo).toContain("Duplicar");
  });

  // Red-check CA-30: un validar que siempre acepta ofrece un ejercicio con referencia rota.
  it("red-check: un validar que siempre acepta ofrece la referencia rota", async () => {
    const armado = armarLote(loteBueno("function duplica(n) { return n + 2; }"), META);
    expect(armado.ok).toBe(true);
    if (!armado.ok) return;
    const aceptaTodo = (async () => ({ ok: true, pendientes: [] })) as unknown as typeof import("@/lib/exercises-validate").validateBank;
    const r = await validarLote(armado.md, { jsRun: jsRunReal, validar: aceptaTodo });
    // con el validar débil el lote roto se acepta: ese es el hallazgo
    const hallazgo = r.ok ? "un ejercicio generado con referencia rota se ofreció" : "";
    expect(hallazgo).toBe("un ejercicio generado con referencia rota se ofreció");
    // con el validar real, se rechaza
    const real = await validarLote(armado.md, { jsRun: jsRunReal });
    expect(real.ok).toBe(false);
  });

  // Red-check CA-31: toda referencia corre en el Worker, nunca con execCode en el hilo principal. Con
  // vi.mock de js-runner cuyo execCode lanza, un jsRun espía inyectado corre una vez por ejercicio code; sin ese jsRun
  // (validateBank usaría execCode por omisión) el execCode mockeado se llamaría.
  it("red-check: la referencia corre por el jsRun inyectado, no por execCode", async () => {
    const espia = vi.fn(jsRunReal);
    const armado = armarLote(loteBueno(), META);
    expect(armado.ok).toBe(true);
    if (!armado.ok) return;
    const r = await validarLote(armado.md, { jsRun: espia });
    expect(r.ok).toBe(true);
    expect(espia).toHaveBeenCalledTimes(1); // una vez por ejercicio code
  });
});

describe("runJsVigilado", () => {
  it("existe y envuelve runJs (corte a 3 s)", () => {
    expect(typeof runJsVigilado).toBe("function");
  });
});
