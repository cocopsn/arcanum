import { describe, expect, it } from "vitest";
import type { EvidenceRM } from "@/core/read-model";
import {
  autoOkFor,
  codeSteps,
  currentLevel,
  fillTemplate,
  gradeFadedCode,
  huecoCabe,
  HUECO_PROSA_MAX,
  levelHoles,
  proseSteps,
  templateSegments,
  visibleCodeSteps,
} from "@/forge/eval/faded";
import { realForgeItem } from "@/forge/__tests__/fixtures/evaluator-blocks";
import { execRunner } from "@/forge/__tests__/helpers/exec-runner";

// b · desvanecido (design §5.3, §11.1). Protections, each with its red-check in tools/redcheck-specs.json:
//  rc08 the level only rises with a correct «nivel» evidence of the current level; rc09 a hidden region's code never
//  appears in a fixed segment; rc46 a prose answer the read model would truncate cannot be sent.

const CELL = "cf000000-0000-4000-8000-0000000000aa";
const ITEM = "a1-01-desv-frontera";
const T0 = Date.UTC(2026, 10, 10, 15, 0, 0);
let n = 0;
const ev = (over: Partial<EvidenceRM>): EvidenceRM => ({
  id: `c8000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  moduleId: CELL,
  goalId: null,
  itemId: ITEM,
  type: "desvanecido",
  phase: "nivel",
  outcome: "correcto",
  data: { nivel: 1 },
  source: "local",
  provider: null,
  passed: null,
  ts: T0,
  ...over,
});
const a101 = () => realForgeItem("A1-01", ITEM, "desvanecido").data;

describe("desvanecido · currentLevel", () => {
  it("diez intentos de código incorrectos y un día después siguen en el nivel 1", () => {
    const evidence = Array.from({ length: 10 }, (_, i) => ev({ phase: "codigo", outcome: "incorrecto", data: { nivel: 1, pasan: 0, total: 7, correcto: false }, ts: T0 + 86_400_000 + i }));
    expect(currentLevel(evidence, CELL, ITEM), "el nivel subió sin completar bien el nivel actual").toBe(1);
  });
  it("sube sólo con «nivel» correcto del nivel actual y no salta niveles (comportamiento)", () => {
    expect(currentLevel([], CELL, ITEM)).toBe(1);
    expect(currentLevel([ev({ data: { nivel: 1 } })], CELL, ITEM)).toBe(2);
    expect(currentLevel([ev({ data: { nivel: 2 } })], CELL, ITEM)).toBe(1);
    expect(currentLevel([ev({ data: { nivel: 1 } }), ev({ data: { nivel: 3 } })], CELL, ITEM)).toBe(2);
    expect(currentLevel([ev({ data: { nivel: 1 } }), ev({ data: { nivel: 2 } })], CELL, ITEM)).toBe(3);
    expect(currentLevel([ev({ data: { nivel: 1 }, outcome: "incorrecto" })], CELL, ITEM)).toBe(1);
    expect(currentLevel([ev({ data: { nivel: 1 }, moduleId: "otra" })], CELL, ITEM)).toBe(1);
    expect(currentLevel([ev({ data: { nivel: 1 }, itemId: "otro-item" })], CELL, ITEM)).toBe(1);
    expect(currentLevel([ev({ data: { truncated: true, bytes: 5000 } })], CELL, ITEM)).toBe(1);
  });
});

describe("desvanecido · plantilla por trozos", () => {
  it("con el paso 3 oculto, su código no aparece en ningún trozo fijo", () => {
    const d = a101();
    const segs = templateSegments(d.plantilla!.code, "js", new Set([3]));
    const fijos = segs.filter((s) => s.kind === "fijo").map((s) => (s as { text: string }).text);
    expect(fijos.some((t) => t.includes("lo = mid + 1")), "el código de referencia de un hueco apareció antes de aprobar el nivel").toBe(false);
    expect(segs.filter((s) => s.kind === "hueco")).toEqual([{ kind: "hueco", paso: 3 }]);
    expect(fijos.join("\n")).toContain("const mid = lo + Math.floor((hi - lo) / 2);");
    expect(fijos.join("\n")).not.toContain("<paso");
  });
  it("los pasos visibles por nivel salen de los huecos del nivel actual (comportamiento)", () => {
    const d = a101();
    expect(codeSteps(d)).toEqual([1, 2, 3, 4]);
    expect(proseSteps(d)).toEqual([5]);
    expect(levelHoles(d, 2)).toEqual({ codigo: [3], prosa: [5] });
    expect(levelHoles(d, 4)).toEqual({ codigo: [], prosa: [] });
    expect(visibleCodeSteps(d, 3)).toEqual([2]);
    expect(visibleCodeSteps(d, 4)).toEqual([1, 2, 3, 4]);
  });
  it("fillTemplate y gradeFadedCode sobre el nivel 1 de A1-01, con el código bueno y con <= (comportamiento)", async () => {
    const d = a101();
    const bueno = { 3: "    if (a[mid] < x) lo = mid + 1;\n    else hi = mid;" };
    const prog = fillTemplate(d.plantilla!.code, "js", bueno);
    expect(prog).toContain("// <paso 3>\n    if (a[mid] < x) lo = mid + 1;\n    else hi = mid;\n    // </paso 3>");
    expect(await gradeFadedCode(d, bueno, execRunner)).toMatchObject({ estado: "calificada", correcto: true, pasan: 7, total: 7 });
    const malo = await gradeFadedCode(d, { 3: "    if (a[mid] <= x) lo = mid + 1;\n    else hi = mid;" }, execRunner);
    expect(malo).toMatchObject({ estado: "calificada", correcto: false, total: 7 });
    if (malo.estado === "calificada") expect(malo.primerFallo).toBeDefined();
    expect(await gradeFadedCode(d, { 3: "    if (a[mid] < x lo = mid + 1;" }, execRunner)).toMatchObject({ estado: "sintaxis" });
  });
});

describe("desvanecido · autoverificación y tamaño de la prosa", () => {
  it("autoOkFor sólo cuenta la autoverificación correcta del mismo nivel (comportamiento)", () => {
    const auto = (nivel: number, outcome: "correcto" | "incorrecto") => ev({ phase: "autoverificacion", outcome, source: "self", data: { nivel, marcados: [0] } });
    expect(autoOkFor([auto(2, "correcto")], CELL, ITEM, 2)).toBe(true);
    expect(autoOkFor([auto(1, "correcto")], CELL, ITEM, 2)).toBe(false);
    expect(autoOkFor([auto(2, "incorrecto")], CELL, ITEM, 2)).toBe(false);
    expect(autoOkFor([ev({ phase: "nivel", data: { nivel: 2 } })], CELL, ITEM, 2)).toBe(false);
  });
  it("una respuesta de prosa que el read model truncaría no se puede enviar", () => {
    const muchos = "\n".repeat(1_100) + "a".repeat(HUECO_PROSA_MAX - 1_100);
    expect(muchos.length).toBe(3_000);
    expect(huecoCabe({ nivel: 2, paso: 5, respuesta: muchos }), "una respuesta de prosa que el read model truncaría se pudo enviar").toBe(false);
  });
  it("3,000 caracteres con 200 saltos sí caben (comportamiento)", () => {
    const pocos = "\n".repeat(200) + "a".repeat(HUECO_PROSA_MAX - 200);
    expect(huecoCabe({ nivel: 2, paso: 5, respuesta: pocos })).toBe(true);
  });
});
