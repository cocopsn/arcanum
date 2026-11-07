import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseExercisesMd } from "@/lib/exercises-md";
import type { ForgeBankItem, ForgeItemOf, ForgeType } from "@/forge/bank/registry";
import { BLOCKS, bankMd } from "@/forge/__tests__/fixtures/forge-blocks";

// Fixture blocks of the evaluators (design §11, §11.1). They are NOT keys of BLOCKS (phase0-contracts walks BLOCKS).
// Valid ones: RET_DEFENSA and HIST_FALLAS_JS. Every broken block starts from a valid one and breaks ONE rule, so the
// message a test looks for is that rule's: the desvanecido ones keep their prose step hidden in some level, the
// forense ones keep their steps and their control, and so on. `swap` throws when the text to replace is missing, so
// a fixture can never silently stop breaking what it claims to break.

const forgeItems = (md: string) => (parseExercisesMd(md)?.exercises ?? []).filter((e): e is ForgeBankItem => e.kind === "forge");

/** The parsed item of one fixture block, narrowed to its type (throws if the block does not parse as that type). */
export function forgeItem<T extends ForgeType>(block: string, type: T): ForgeItemOf<T> {
  const it = forgeItems(bankMd([block]))[0];
  if (!it || it.type !== type) throw new Error(`el bloque no parsea como ${type}: ${block.split("\n")[0]}`);
  return it as ForgeItemOf<T>;
}

/** A real item of content/forge/exercises/<code>.md (lowercase file name), narrowed to its type. */
export function realForgeItem<T extends ForgeType>(code: string, itemId: string, type: T): ForgeItemOf<T> {
  const md = readFileSync(join(process.cwd(), "content", "forge", "exercises", `${code.toLowerCase()}.md`), "utf8");
  const it = forgeItems(md).find((e) => e.itemId === itemId);
  if (!it || it.type !== type) throw new Error(`no encontré el ítem ${type} ${itemId} en ${code}`);
  return it as ForgeItemOf<T>;
}

/** Every real item of one type across the 128 banks. */
export function realForgeItems<T extends ForgeType>(type: T): ForgeItemOf<T>[] {
  const dir = join(process.cwd(), "content", "forge", "exercises");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .flatMap((f) => forgeItems(readFileSync(join(dir, f), "utf8")).filter((e): e is ForgeItemOf<T> => e.type === type));
}

function swap(block: string, from: string, to: string): string {
  if (!block.includes(from)) throw new Error(`evaluator-blocks: no encontré «${from.slice(0, 60)}» en el bloque base`);
  return block.replace(from, to);
}
/** A new `id:` so two fixtures can live in one bank. */
const withId = (block: string, from: string, to: string) => swap(block, `id: ${from}\n`, `id: ${to}\n`);

// ── valid ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Retention in `forma: defensa`, rubric of two criteria. */
export const RET_DEFENSA = `## Retención de la reserva
type: retencion
id: ret-defensa
rol: recuperacion
dias: 7
variante_de: mision
forma: defensa

Defiende, sin mirar el libro, por qué dos reservas simultáneas del último cupo no pueden confirmar las dos.

### Rúbrica
- Da una historia concreta en la que las dos reservas leen el mismo cupo.
- Propone una protección y nombra su costo.`;

/** historial in `modo: fallas`, JavaScript, two calendars, solution and naive. The naive sends without a key and,
 *  when the first answer is lost, applies the operation twice (fails `una_operacion` in calendar 2). */
export const HIST_FALLAS_JS = `## Envío con respuesta perdida
type: historial
id: hist-fallas
modo: fallas

Implementa \`enviar(servicio, pedido)\`: manda el pedido a un servicio que a veces pierde la respuesta.

### Firma
~~~javascript
function enviar(servicio, pedido) {
  // servicio.enviar(clave) → "ok" | "timeout"; devuelve "confirmada" o "desconocida"
}
~~~

### Arnés
~~~javascript
function arnes(calendario) {
  const eventos = calendario.eventos.slice();
  const aplicadas = [];
  const servicio = {
    enviar(clave) {
      if (clave == null) aplicadas.push(null);
      else if (!aplicadas.includes(clave)) aplicadas.push(clave);
      const ev = eventos.length ? eventos.shift() : "ok";
      return ev === "pierde" ? "timeout" : "ok";
    },
  };
  let r = null;
  try { r = enviar(servicio, calendario.pedido); } catch (e) { r = null; }
  return { una_operacion: aplicadas.length === 1, confirmada: r === "confirmada" };
}
~~~

### Calendarios
~~~json
[
  { "nombre": "directo", "pedido": { "clave": "p-1" }, "eventos": ["ok"], "espera": { "una_operacion": true, "confirmada": true } },
  { "nombre": "respuesta perdida", "pedido": { "clave": "p-2" }, "eventos": ["pierde", "ok"], "espera": { "una_operacion": true, "confirmada": true } }
]
~~~

### Solución
~~~javascript
function enviar(servicio, pedido) {
  for (let i = 0; i < 3; i++) if (servicio.enviar(pedido.clave) === "ok") return "confirmada";
  return "desconocida";
}
~~~

### Ingenua
~~~javascript
function enviar(servicio, pedido) {
  for (let i = 0; i < 3; i++) if (servicio.enviar(null) === "ok") return "confirmada";
  return "desconocida";
}
~~~`;

// ── broken for the executable rules of CA-E14 ────────────────────────────────────────────────────────────────────

/** The witness has a single job: the almost-correct version and the reference both return 1. */
export const CONTRA_TESTIGO_IGUAL = swap(BLOCKS.contraejemplo, `[[{ "r": 1 }, { "r": 2 }]]`, `[[{ "r": 1 }]]`);
/** Only one golden case, on which m-primero (critical) returns the maximum: no golden case kills it. */
export const MUT_SIN_MATAR = swap(BLOCKS.mutantes, `[{ "input": [[3, 1, 2]], "expected": 3 }, { "input": [[1, 2, 3]], "expected": 3 }]`, `[{ "input": [[3, 2, 1]], "expected": 3 }]`);
/** The reference skips the first element: it fails the golden case [3, 1, 2]; both mutants are still killed. */
export const MUT_REF_FALLA_DORADO = swap(BLOCKS.mutantes, "function maximo(xs) { return Math.max(...xs); }", "function maximo(xs) { return Math.max(...xs.slice(1)); }");
/** The template's accumulator starts at 1: the full template (the reference) fails its case. */
export const DESV_PLANTILLA_MALA = swap(BLOCKS.desvanecido, "  let t = 0;", "  let t = 1;");
/** The prose step (3) is hidden in no level (the old fixture's levels). */
export const DESV_PROSA_SIN_NIVEL = swap(BLOCKS.desvanecido, "- 2: 1, 2, 3", "- 2: 1, 2");
/** The retention's solution adds instead of subtracting: it fails its case. */
export const RET_SOLUCION_MALA = swap(BLOCKS.retencion, "function reservar(stock, n) { return stock - n; }", "function reservar(stock, n) { return stock + n; }");
/** The naive version is the solution: it passes every calendar. */
export const HIST_INGENUA_PASA = swap(withId(HIST_FALLAS_JS, "hist-fallas", "hist-ingenua-pasa"), "servicio.enviar(null)", "servicio.enviar(pedido.clave)");
/** The solution never retries: it fails calendar «respuesta perdida» (the naive still fails it too). */
export const HIST_SOLUCION_FALLA = swap(
  withId(HIST_FALLAS_JS, "hist-fallas", "hist-solucion-falla"),
  `  for (let i = 0; i < 3; i++) if (servicio.enviar(pedido.clave) === "ok") return "confirmada";\n  return "desconocida";`,
  `  return servicio.enviar(pedido.clave) === "ok" ? "confirmada" : "desconocida";`,
);

// forense, starting from the new BLOCKS.forense (§5.4): pipeline `unir` joins on p.id >= l.id (3 rows), the
// correction on p.id = l.id (2 rows), invariant conteo = 2 on `unidos`, lie m1 in `unir`.
const F = BLOCKS.forense;
const F_INV = `[{ "id": "inv-conteo", "tipo": "conteo", "sobre": "unidos", "esperado": 2 }]`;
const F_MENTIRA = `[{ "id": "m1", "paso": "unir", "tipo": "join-multiplica", "invariante": "inv-conteo" }]`;
const F_CONTROL = "SELECT id FROM unidos GROUP BY id HAVING COUNT(*) > 1";
const F_CORR_UNIR = "-- paso: unir\nCREATE VIEW unidos AS SELECT l.id, l.total FROM limpios l JOIN pedidos p ON p.id = l.id;";
const F_PIPE = "-- paso: limpiar\nCREATE VIEW limpios AS SELECT * FROM pedidos;\n-- paso: unir\nCREATE VIEW unidos AS SELECT l.id, l.total FROM limpios l JOIN pedidos p ON p.id >= l.id;";
const F_CORR = "### Corrección\n~~~sql\n-- paso: limpiar\nCREATE VIEW limpios AS SELECT * FROM pedidos;\n";

/** The correction names its second step `juntar`: not the pipeline's steps (rule 2 of verify_forense, rc57). */
export const FORENSE_PASOS_DISTINTOS = swap(F, F_CORR_UNIR, F_CORR_UNIR.replace("-- paso: unir", "-- paso: juntar"));
/** The lie says it is born in `limpiar`, which is the same in both pipelines (rule 5). */
export const FORENSE_NO_NACE = swap(F, F_MENTIRA, F_MENTIRA.replace(`"paso": "unir"`, `"paso": "limpiar"`));
/** The lying `limpiar` drops row 2 and hides the duplication of `unir`: the lying pipeline still has 2 rows, so the
 *  invariant is not broken there (rule 3); with only `unir` as in the lying one it is (rule 5 holds). */
export const FORENSE_NO_ROMPE = swap(F, F_PIPE, F_PIPE.replace("CREATE VIEW limpios AS SELECT * FROM pedidos;", "CREATE VIEW limpios AS SELECT * FROM pedidos WHERE id <> 2;"));
/** A second invariant (no lie) that fails everywhere, also in the corrected pipeline (rule 4). */
export const FORENSE_CORREGIDO_ROTO = swap(F, F_INV, `[{ "id": "inv-conteo", "tipo": "conteo", "sobre": "unidos", "esperado": 2 }, { "id": "inv-suma", "tipo": "suma", "sobre": "pedidos", "columnas": ["total"], "esperado": 99 }]`);
/** The reference control never returns rows (rule 6). */
export const FORENSE_CONTROL_MUDO = swap(F, F_CONTROL, "SELECT id FROM unidos WHERE id < 0");
/** The lying pipeline's `unir` does not compile (rule 1). */
export const FORENSE_NO_CARGA = swap(F, "CREATE VIEW unidos AS SELECT l.id, l.total FROM limpios l JOIN pedidos p ON p.id >= l.id;", "CREATE VIEW unidos AS SELEC 1;");
/** `SELECT 1;` before the first `-- paso:` of the correction (rule 2 through the None branch of _pasos, rc100). */
export const FORENSE_SQL_ANTES_DEL_PASO = swap(F, F_CORR, F_CORR.replace("~~~sql\n", "~~~sql\nSELECT 1;\n"));

// ── broken for the structural rules of check (table of check-modules.test.ts, §11.1) ────────────────────────────

export const CONTRA_OTRA_FUNCION = swap(BLOCKS.contraejemplo, "function elegir(trabajos) { return trabajos.length > 1 ? 1 : trabajos.length; }", "function otra(trabajos) { return trabajos.length > 1 ? 1 : trabajos.length; }");
export const CONTRA_TESTIGO_VACIO = swap(BLOCKS.contraejemplo, `[[{ "r": 1 }, { "r": 2 }]]`, "[]");
/** 20,001 characters of JSON: ["x…x"] with 19,997 x. */
export const CONTRA_TESTIGO_GRANDE = swap(BLOCKS.contraejemplo, `[[{ "r": 1 }, { "r": 2 }]]`, JSON.stringify(["x".repeat(19_997)]));
export const MUT_SIN_CRITICO = swap(BLOCKS.mutantes, "#### m-primero · crítico", "#### m-primero");
export const MUT_MINIMO_ALTO = swap(BLOCKS.mutantes, "minimo: 1\n", "minimo: 9\n");
/** m-ultimo with m-primero's code, with other spaces and line breaks. */
export const MUT_DUPLICADO = swap(BLOCKS.mutantes, "function maximo(xs) { return xs[xs.length - 1]; }", "function maximo(xs) {\n  return xs[0];\n}");
export const MUT_OTRA_FUNCION = swap(BLOCKS.mutantes, "function maximo(xs) { return xs[xs.length - 1]; }", "function otra(xs) { return xs[xs.length - 1]; }");
/** Levels 1: 1, 3 and 2: 2, 3 (code steps 1 and 2, prose 3): level 2 does not contain level 1. */
export const DESV_NO_ANIDADO = swap(BLOCKS.desvanecido, "- 1: 1\n- 2: 1, 2, 3", "- 1: 1, 3\n- 2: 2, 3");
/** A single level hiding only the prose step 3. */
export const DESV_ULTIMO_CORTO = swap(BLOCKS.desvanecido, "- 1: 1\n- 2: 1, 2, 3", "- 1: 3");
export const FORENSE_ID_REPETIDO = swap(F, F_INV, `[{ "id": "inv-conteo", "tipo": "conteo", "sobre": "unidos", "esperado": 2 }, { "id": "inv-conteo", "tipo": "conteo", "sobre": "unidos", "esperado": 2 }]`);
export const FORENSE_PASO_FUERA = swap(F, F_MENTIRA, F_MENTIRA.replace(`"paso": "unir"`, `"paso": "agrupar"`));
export const FORENSE_INV_FALTA = swap(F, F_MENTIRA, F_MENTIRA.replace(`"invariante": "inv-conteo"`, `"invariante": "inv-otro"`));
export const FORENSE_CONTROLES_DE_MAS = swap(F, `${F_CONTROL}\n~~~`, `${F_CONTROL}\n~~~\n~~~sql\nSELECT id FROM unidos WHERE id > 1\n~~~`);
export const FORENSE_ESPERADO_TEXTO = swap(F, F_INV, F_INV.replace(`"esperado": 2`, `"esperado": "2"`));
export const FORENSE_SIN_COLUMNAS = swap(F, F_INV, `[{ "id": "inv-conteo", "tipo": "conteo", "sobre": "unidos", "esperado": 2 }, { "id": "inv-unico", "tipo": "unicidad", "sobre": "unidos" }]`);
export const FORENSE_SOBRE_INYECTA = swap(F, F_INV, F_INV.replace(`"sobre": "unidos"`, `"sobre": "unidos; DROP TABLE pedidos"`));
export const FORENSE_CONTROL_CATALOGO = swap(F, F_CONTROL, "SELECT 1 FROM sqlite_master WHERE name = 'unidos' AND sql LIKE '%>=%'");
/** The correction has no `-- paso:` line at all (only a comment). */
export const FORENSE_CORRECCION_ILEGIBLE = swap(
  F,
  "### Corrección\n~~~sql\n-- paso: limpiar\nCREATE VIEW limpios AS SELECT * FROM pedidos;\n-- paso: unir\nCREATE VIEW unidos AS SELECT l.id, l.total FROM limpios l JOIN pedidos p ON p.id = l.id;\n~~~",
  "### Corrección\n~~~sql\n-- la corrección todavía no se escribió\n~~~",
);
export const FORENSE_TOLERANCIA_NEGATIVA = swap(F, F_INV, F_INV.replace(`"esperado": 2 }`, `"esperado": 2, "tolerancia": -1 }`));
