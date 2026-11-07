import { describe, expect, it } from "vitest";
import { failingProps, faultsProgram, gradeFaults } from "@/forge/eval/history-faults";
import { forgeItem, HIST_FALLAS_JS, realForgeItem } from "@/forge/__tests__/fixtures/evaluator-blocks";
import { execRunner } from "@/forge/__tests__/helpers/exec-runner";

// c · historial in mode fallas (design §5.6, §11.1). Protections, each with its red-check in tools/redcheck-specs.json:
//  rc20 a property the harness marked false never counts as met; rc83 an attempt never changes the bank's calendars.

const fallas = (block: string) => {
  const d = forgeItem(block, "historial").data;
  if (d.modo !== "fallas") throw new Error("el bloque no es de modo fallas");
  return d;
};

describe("fallas · failingProps", () => {
  it("una propiedad que el arnés marcó falsa reprueba", () => {
    expect(failingProps({ una_operacion: false, confirmada: true }, { una_operacion: true, confirmada: true }), "una propiedad que el arnés marcó falsa contó como cumplida").toEqual(["una_operacion"]);
  });
  it("una salida que no es objeto reprueba todas las propiedades; un objeto completo no reprueba ninguna (comportamiento)", () => {
    expect(failingProps(null, { a: true, b: false })).toEqual(["a", "b"]);
    expect(failingProps([true], { a: true })).toEqual(["a"]);
    expect(failingProps({ a: true, b: false, extra: 1 }, { a: true, b: false })).toEqual([]);
    expect(faultsProgram("function f() {}", "function arnes(c) {}")).toBe("function f() {}\n;\nfunction arnes(c) {}");
  });
});

describe("fallas · gradeFaults sobre S2-02 real (comportamiento)", () => {
  it("la solución aprueba los 6 calendarios y la ingenua falla y nombra una_operacion", async () => {
    const d = realForgeItem("S2-02", "s202-lab-escalera", "historial").data;
    if (d.modo !== "fallas") throw new Error("S2-02 dejó de ser fallas");
    const sol = await gradeFaults(d, "js", d.solucion.js!, execRunner);
    expect(sol).toMatchObject({ estado: "calificada", correcto: true });
    if (sol.estado === "calificada") expect(sol.calendarios).toHaveLength(6);
    const ing = await gradeFaults(d, "js", d.ingenua.js!, execRunner);
    expect(ing).toMatchObject({ estado: "calificada", correcto: false });
    if (ing.estado === "calificada") expect(ing.calendarios.flatMap((c) => c.fallan)).toContain("una_operacion");
  });
  it("sobre HIST_FALLAS_JS la ingenua falla sólo «respuesta perdida» y un código que no compila es sintaxis (comportamiento)", async () => {
    const d = fallas(HIST_FALLAS_JS);
    const ing = await gradeFaults(d, "js", d.ingenua.js!, execRunner);
    expect(ing.estado === "calificada" ? ing.calendarios.map((c) => [c.nombre, c.correcto]) : ing).toEqual([["directo", true], ["respuesta perdida", false]]);
    expect(await gradeFaults(d, "js", "function enviar( {", execRunner)).toMatchObject({ estado: "sintaxis" });
  });
});

describe("fallas · clonado de calendarios", () => {
  it("un arnés que vacía el calendario no cambia los calendarios del banco", async () => {
    const base = fallas(HIST_FALLAS_JS);
    const vaciador = base.arnes.js!.replace("  const eventos = calendario.eventos.slice();", "  const eventos = calendario.eventos.slice();\n  calendario.eventos.length = 0;");
    expect(vaciador).not.toBe(base.arnes.js);
    const d = { ...base, arnes: { js: vaciador } };
    const antes = structuredClone(d.calendarios);
    // execRunner passes the same object to the program (no clone): only gradeFaults' clone protects the bank
    await gradeFaults(d, "js", d.solucion.js!, execRunner);
    expect(d.calendarios, "un intento cambió los calendarios del banco").toEqual(antes);
  });
});
