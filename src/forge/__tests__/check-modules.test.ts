import { describe, expect, it } from "vitest";
import type { ForgeBankItem, ForgeType } from "@/forge/bank/registry";
import type { BankCheckJs, BankCheckModule, BankCheckPy } from "@/lib/exercises-validate";
import { CHECK_GUARD_RUNNER } from "@/lib/exercises-validate";
import { execRunner } from "@/forge/__tests__/helpers/exec-runner";
import { BLOCKS } from "@/forge/__tests__/fixtures/forge-blocks";
import { forgeItem, realForgeItems } from "@/forge/__tests__/fixtures/evaluator-blocks";
import * as checkContra from "@/forge/bank/check/contraejemplo";
import * as checkMut from "@/forge/bank/check/mutantes";
import * as checkDesv from "@/forge/bank/check/desvanecido";
import * as checkForense from "@/forge/bank/check/forense";
import * as checkRet from "@/forge/bank/check/retencion";
import * as checkHist from "@/forge/bank/check/historial";
import {
  // CA-E14 executable (js.check rejections)
  CONTRA_TESTIGO_IGUAL,
  MUT_SIN_MATAR,
  MUT_REF_FALLA_DORADO,
  DESV_PLANTILLA_MALA,
  RET_SOLUCION_MALA,
  HIST_INGENUA_PASA,
  HIST_SOLUCION_FALLA,
  HIST_FALLAS_JS,
  RET_DEFENSA,
  // structural (check) rejections
  CONTRA_OTRA_FUNCION,
  CONTRA_TESTIGO_VACIO,
  CONTRA_TESTIGO_GRANDE,
  MUT_SIN_CRITICO,
  MUT_MINIMO_ALTO,
  MUT_DUPLICADO,
  MUT_OTRA_FUNCION,
  DESV_NO_ANIDADO,
  DESV_ULTIMO_CORTO,
  DESV_PROSA_SIN_NIVEL,
  FORENSE_ID_REPETIDO,
  FORENSE_PASO_FUERA,
  FORENSE_INV_FALTA,
  FORENSE_CONTROLES_DE_MAS,
  FORENSE_ESPERADO_TEXTO,
  FORENSE_SIN_COLUMNAS,
  FORENSE_SOBRE_INYECTA,
  FORENSE_CONTROL_CATALOGO,
  FORENSE_CORRECCION_ILEGIBLE,
  FORENSE_PASOS_DISTINTOS,
  FORENSE_TOLERANCIA_NEGATIVA,
} from "@/forge/__tests__/fixtures/evaluator-blocks";

// Ingestion checks of the five types + historial fallas (design §5.1–§5.6, §11.1). `check` reads structure and never
// executes (M1). `js.check`/`py.check` run the author's code only at import. Every error names the item (CA-E14):
// «<título>» (<tipo>): …, measured by the prefix assertion on each structural row and each js/py rejection.

const MOD: Record<string, BankCheckModule> = {
  contraejemplo: checkContra as unknown as BankCheckModule,
  mutantes: checkMut as unknown as BankCheckModule,
  desvanecido: checkDesv as unknown as BankCheckModule,
  forense: checkForense as unknown as BankCheckModule,
  retencion: checkRet as unknown as BankCheckModule,
  historial: checkHist as unknown as BankCheckModule,
};

const prefix = (item: ForgeBankItem) => `«${item.title}» (${item.type}): `;

// ── M1: check never executes (CA-E16) ───────────────────────────────────────────────────────────────────────────

describe("check nunca ejecuta código del autor (M1, CA-E16)", () => {
  const realTypes: ForgeType[] = ["contraejemplo", "desvanecido", "forense", "mutantes", "retencion"];
  const realItems = realTypes.flatMap((t) => realForgeItems(t)).concat(realForgeItems("historial").filter((i) => i.data.modo === "fallas"));

  it("los 61 ítems reales pasan check con el guardia (ejecutar código lanza ExecutionRefused)", async () => {
    expect(realItems.length).toBe(61);
    for (const item of realItems) {
      // check con CHECK_GUARD_RUNNER no debe ejecutar: si un check llama al runner, éste lanza ExecutionRefused y
      // el ítem no pasa (rc23: «ejecutó código (M1)»).
      let r: Awaited<ReturnType<typeof MOD["contraejemplo"]["check"]>> | { ok: false };
      try {
        r = await MOD[item.type]!.check(item, { source: "import", jsRun: CHECK_GUARD_RUNNER });
      } catch {
        r = { ok: false };
      }
      expect("ok" in r && r.ok === true, `${item.type} ${item.itemId}: ejecutó código (M1)`).toBe(true);
    }
  });

  it("los BLOCKS de los seis tipos pasan check (phase0-contracts exige { ok: true })", async () => {
    for (const t of ["contraejemplo", "mutantes", "desvanecido", "forense", "retencion", "historial"] as const) {
      const item = forgeItem(BLOCKS[t], t);
      const r = await MOD[t]!.check(item, { source: "import", jsRun: CHECK_GUARD_RUNNER });
      expect(r).toEqual({ ok: true });
    }
    // historial fallas fixture too
    const h = forgeItem(HIST_FALLAS_JS, "historial");
    expect(await MOD.historial!.check(h, { source: "import", jsRun: CHECK_GUARD_RUNNER })).toEqual({ ok: true });
  });
});

// ── structural rules of check (CA-E14, each with its message) ────────────────────────────────────────────────────

// Each row carries the red-check message (`esperado`, the one rc greps for and the one that names what the rule
// protects) and a substring of the real error (`contiene`, the right-reason check on the green side).
type Row = { nombre: string; tipo: ForgeType; block: string; esperado: string; contiene: string };
const ESTRUCTURAL: Row[] = [
  { nombre: "CONTRA_OTRA_FUNCION", tipo: "contraejemplo", block: CONTRA_OTRA_FUNCION, esperado: "el banco aceptó una casi correcta o una referencia que define otra función", contiene: "deben definir" },
  { nombre: "CONTRA_TESTIGO_VACIO", tipo: "contraejemplo", block: CONTRA_TESTIGO_VACIO, esperado: "el banco aceptó un testigo vacío", contiene: "el testigo no trae argumentos" },
  { nombre: "CONTRA_TESTIGO_GRANDE", tipo: "contraejemplo", block: CONTRA_TESTIGO_GRANDE, esperado: "el banco aceptó un testigo de más de 20,000 caracteres", contiene: "caracteres" },
  { nombre: "MUT_SIN_CRITICO", tipo: "mutantes", block: MUT_SIN_CRITICO, esperado: "el banco aceptó mutantes sin ningún crítico", contiene: "ningún mutante es crítico" },
  { nombre: "MUT_MINIMO_ALTO", tipo: "mutantes", block: MUT_MINIMO_ALTO, esperado: "el banco aceptó un minimo mayor que el número de mutantes", contiene: "pasa del número de mutantes" },
  { nombre: "MUT_DUPLICADO", tipo: "mutantes", block: MUT_DUPLICADO, esperado: "el banco aceptó un mutante igual a la referencia o a otro mutante", contiene: "es igual a la referencia o a otro mutante" },
  { nombre: "MUT_OTRA_FUNCION", tipo: "mutantes", block: MUT_OTRA_FUNCION, esperado: "el banco aceptó un mutante que define otra función", contiene: "no define" },
  { nombre: "DESV_NO_ANIDADO", tipo: "desvanecido", block: DESV_NO_ANIDADO, esperado: "el banco aceptó niveles que no se anidan", contiene: "no contiene al nivel" },
  { nombre: "DESV_ULTIMO_CORTO", tipo: "desvanecido", block: DESV_ULTIMO_CORTO, esperado: "el banco aceptó un último nivel que oculta menos de 2 pasos", contiene: "oculta menos de 2 pasos" },
  { nombre: "DESV_PROSA_SIN_NIVEL", tipo: "desvanecido", block: DESV_PROSA_SIN_NIVEL, esperado: "el banco aceptó un paso de prosa que ningún nivel oculta", contiene: "no se oculta en ningún nivel" },
  { nombre: "FORENSE_ID_REPETIDO", tipo: "forense", block: FORENSE_ID_REPETIDO, esperado: "el banco aceptó ids repetidos en invariantes o mentiras", contiene: "ids repetidos en invariantes o mentiras" },
  { nombre: "FORENSE_PASO_FUERA", tipo: "forense", block: FORENSE_PASO_FUERA, esperado: "el banco aceptó una mentira en un paso que no existe", contiene: "que no es un paso del pipeline" },
  { nombre: "FORENSE_INV_FALTA", tipo: "forense", block: FORENSE_INV_FALTA, esperado: "el banco aceptó una mentira con un invariante que no existe", contiene: "que no es un invariante" },
  { nombre: "FORENSE_CONTROLES_DE_MAS", tipo: "forense", block: FORENSE_CONTROLES_DE_MAS, esperado: "el banco aceptó un número de controles distinto del de mentiras", contiene: "controles de referencia para" },
  { nombre: "FORENSE_ESPERADO_TEXTO", tipo: "forense", block: FORENSE_ESPERADO_TEXTO, esperado: "el banco aceptó un esperado no numérico", contiene: "necesita esperado numérico" },
  { nombre: "FORENSE_SIN_COLUMNAS", tipo: "forense", block: FORENSE_SIN_COLUMNAS, esperado: "el banco aceptó un invariante sin columnas", contiene: "necesita columnas" },
  { nombre: "FORENSE_SOBRE_INYECTA", tipo: "forense", block: FORENSE_SOBRE_INYECTA, esperado: "el banco aceptó un identificador que no es un nombre simple", contiene: "no es un identificador simple" },
  { nombre: "FORENSE_CONTROL_CATALOGO", tipo: "forense", block: FORENSE_CONTROL_CATALOGO, esperado: "el banco aceptó un control de referencia que lee el catálogo", contiene: "no es válido" },
  { nombre: "FORENSE_CORRECCION_ILEGIBLE", tipo: "forense", block: FORENSE_CORRECCION_ILEGIBLE, esperado: "el banco aceptó una corrección sin pasos legibles", contiene: "no se puede leer" },
  { nombre: "FORENSE_PASOS_DISTINTOS", tipo: "forense", block: FORENSE_PASOS_DISTINTOS, esperado: "el banco aceptó una corrección con otros pasos", contiene: "no tiene los mismos pasos que el pipeline" },
  { nombre: "FORENSE_TOLERANCIA_NEGATIVA", tipo: "forense", block: FORENSE_TOLERANCIA_NEGATIVA, esperado: "el banco aceptó una tolerancia negativa", contiene: "tolerancia negativa" },
];

describe("check · reglas estructurales (cada fixture roto con su mensaje, CA-E14)", () => {
  it.each(ESTRUCTURAL)("$nombre: check rechaza con «$contiene» y nombra el ítem", async ({ tipo, block, esperado, contiene }) => {
    const item = forgeItem(block, tipo);
    const r = await MOD[tipo]!.check(item, { source: "import", jsRun: CHECK_GUARD_RUNNER });
    expect("ok" in r && r.ok === false, esperado).toBe(true);
    if (!("errors" in r)) throw new Error("sin errores");
    expect(r.errors.join(" | "), esperado).toContain(contiene);
    expect(r.errors.every((e) => e.startsWith(prefix(item))), "un error de ingesta no nombra el ítem (CA-E14)").toBe(true);
  });
});

// ── js.check / py.check (only at import) over fixtures and the broken ones (CA-E14) ──────────────────────────────

async function runJsCheck(mod: BankCheckModule, item: ForgeBankItem) {
  return (mod.js!.check as BankCheckJs)(item, { source: "import", jsRun: execRunner });
}

describe("js.check rechaza su fixture roto y nombra el ítem (CA-E14)", () => {
  const rows: { nombre: string; tipo: ForgeType; block: string; esperado: string; contiene: string }[] = [
    { nombre: "CONTRA_TESTIGO_IGUAL", tipo: "contraejemplo", block: CONTRA_TESTIGO_IGUAL, esperado: "el banco aceptó un testigo que no muestra la diferencia", contiene: "el testigo no muestra la diferencia" },
    { nombre: "MUT_SIN_MATAR", tipo: "mutantes", block: MUT_SIN_MATAR, esperado: "el banco aceptó un mutante que ningún caso dorado mata", contiene: "no falla ningún caso dorado" },
    { nombre: "MUT_REF_FALLA_DORADO", tipo: "mutantes", block: MUT_REF_FALLA_DORADO, esperado: "el banco aceptó una referencia que no pasa sus casos dorados", contiene: "no pasa el caso dorado" },
    { nombre: "DESV_PLANTILLA_MALA", tipo: "desvanecido", block: DESV_PLANTILLA_MALA, esperado: "la plantilla de referencia no pasa", contiene: "la plantilla de referencia no pasa el caso" },
    { nombre: "RET_SOLUCION_MALA", tipo: "retencion", block: RET_SOLUCION_MALA, esperado: "la solución de la retención no pasa sus casos", contiene: "la solución de la retención no pasa sus casos" },
    { nombre: "HIST_INGENUA_PASA", tipo: "historial", block: HIST_INGENUA_PASA, esperado: "el banco aceptó una ingenua que pasa todos los calendarios", contiene: "la ingenua pasa todos los calendarios" },
    { nombre: "HIST_SOLUCION_FALLA", tipo: "historial", block: HIST_SOLUCION_FALLA, esperado: "el banco aceptó una solución que falla un calendario", contiene: "la solución falla el calendario" },
  ];

  it.each(rows)("$nombre: js.check rechaza con «$contiene»", async ({ tipo, block, esperado, contiene }) => {
    const item = forgeItem(block, tipo);
    const r = await runJsCheck(MOD[tipo]!, item);
    expect(r.ok, esperado).toBe(false);
    if (r.ok) return;
    expect(r.errors.join(" | "), esperado).toContain(contiene);
    expect(r.errors.every((e) => e.startsWith(prefix(item))), "un error de ingesta no nombra el ítem (CA-E14)").toBe(true);
  });
});

describe("js.check acepta los fixtures buenos", () => {
  it.each([
    { nombre: "contraejemplo", tipo: "contraejemplo" as const, block: BLOCKS.contraejemplo },
    { nombre: "mutantes", tipo: "mutantes" as const, block: BLOCKS.mutantes },
    { nombre: "desvanecido", tipo: "desvanecido" as const, block: BLOCKS.desvanecido },
    { nombre: "historial fallas", tipo: "historial" as const, block: HIST_FALLAS_JS },
  ])("$nombre: js.check da { ok: true }", async ({ tipo, block }) => {
    const item = forgeItem(block, tipo);
    expect(await runJsCheck(MOD[tipo]!, item)).toEqual({ ok: true });
  });

  it("retencion de código buena pasa js.check; defensa no corre js.check", async () => {
    const ret = forgeItem(BLOCKS.retencion, "retencion");
    expect(await runJsCheck(MOD.retencion!, ret)).toEqual({ ok: true });
    const def = forgeItem(RET_DEFENSA, "retencion");
    expect(MOD.retencion!.js!.needs(def), "la defensa no debería necesitar js.check").toBe(false);
  });
});
