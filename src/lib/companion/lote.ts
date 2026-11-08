// Lotes de ejercicios generados por IA (design §18.1, §18.2, protección b). armarLote escribe un frontmatter propio con
// module_id: companion-<uuidv7> (NUNCA el UUID de una celda) y rechaza, por su motivo, cualquier lote fuera de contrato.
// validarLote valida con explainExercisesMd y validateBank, corriendo TODA referencia en el Worker (runJsVigilado sobre
// runJs, corte a 3 s) o en runPy; nunca con execCode en el hilo principal. Un lote con una referencia rota se rechaza
// ENTERO y nada entra a `practicables`. Los lotes viven en arcanum-companion, nunca en arcanum-exercises (§18.3).
import { uuidv7 } from "uuidv7";
import { explainExercisesMd, type ParsedExerciseBank } from "@/lib/exercises-md";
import { validateBank, type ExecRunner } from "@/lib/exercises-validate";
import { runJs } from "@/lib/js-runner";
import { runPy } from "@/lib/py-runner";
import type { CodeExercise, Exercise, TestCase } from "@/lib/exercise";
import type { MundoCmp } from "./tipos";

/** Una regla del contrato del lote (§18.1 punto 2): si `rechaza(md)` da un texto, ese es el motivo del rechazo. */
export interface ReglaLote {
  motivo: string;
  rechaza: (md: string) => boolean;
}

// Cuerpo fuera de las cercas ``` … ``` (las secciones peligrosas sólo cuentan si NO están dentro de una cerca).
function fueraDeCercas(md: string): string {
  const lineas = md.replace(/\r\n/g, "\n").split("\n");
  let dentro = false;
  const out: string[] = [];
  for (const l of lineas) {
    if (/^\s*(```|~~~)/.test(l)) {
      dentro = !dentro;
      out.push(""); // la línea de cerca no cuenta como contenido
      continue;
    }
    out.push(dentro ? "" : l);
  }
  return out.join("\n");
}

/** Los bloques `##` (ejercicios) del cuerpo, sin contar los `##` dentro de cercas. */
function contarBloques(md: string): number {
  return (fueraDeCercas(md).match(/^##\s+/gm) ?? []).length;
}

/** ¿Algún caso de un `code` trae `"hint": true`? runJs filtra esos casos y validateBank no los comprobaría
 *  (js-runner.ts:128), así que un lote que los usa para «pasar» es inválido. */
function tieneHint(md: string): boolean {
  // los casos viven en bloques ```json … ```; buscamos "hint": true dentro de cualquier cerca
  return /"hint"\s*:\s*true/.test(md);
}

/** Las reglas del contrato (§18.1 punto 2). Exportado: el tercer parámetro de armarLote existe sólo para el red-check
 *  de CA-32 (armarLote(md, meta, REGLAS_LOTE.filter(...))) y nadie más lo pasa. */
export const REGLAS_LOTE: ReglaLote[] = [
  { motivo: "longitud", rechaza: (md) => md.length > 24_000 },
  { motivo: "demasiados bloques", rechaza: (md) => contarBloques(md) > 6 },
  { motivo: "tipo fuera de contrato", rechaza: (md) => /^\s*type\s*:\s*(?!(?:code|multiple_choice|production)\s*$)\S/im.test(md) },
  { motivo: "Generador", rechaza: (md) => /^###\s+Generador\s*$/m.test(fueraDeCercas(md)) },
  { motivo: "Casos generados", rechaza: (md) => /^###\s+Casos generados\s*$/m.test(fueraDeCercas(md)) },
  { motivo: "Comprobador", rechaza: (md) => /^###\s+Comprobador\s*$/m.test(fueraDeCercas(md)) },
  { motivo: "Patrones", rechaza: (md) => /^###\s+Patrones\s*$/m.test(fueraDeCercas(md)) },
  { motivo: "hint", rechaza: (md) => tieneHint(md) },
];

export interface MetaLote {
  tema: string;
  mundo: MundoCmp | string;
  lenguaje: "javascript" | "python";
}

export type ResultadoArmar = { ok: true; md: string; moduleId: string } | { ok: false; motivo: string };

const sanear = (s: string, max: number) => s.replace(/[\r\n]+/g, " ").trim().slice(0, max);

/**
 * Arma el lote del cliente (§18.1): quita el frontmatter del modelo, aplica las reglas de contrato y escribe el
 * frontmatter propio con module_id companion-<uuidv7>. Nunca usa el UUID de una celda.
 */
export function armarLote(md: string, meta: MetaLote, reglas: ReglaLote[] = REGLAS_LOTE): ResultadoArmar {
  // 1) quitar cualquier frontmatter que traiga el modelo
  const sinFm = md.replace(/^\ufeff?---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  // 2) reglas de contrato (sobre el cuerpo sin frontmatter)
  for (const r of reglas) {
    if (r.rechaza(sinFm)) return { ok: false, motivo: r.motivo };
  }
  // 3) frontmatter del cliente
  const moduleId = "companion-" + uuidv7();
  const lenguaje = meta.lenguaje;
  const frontmatter = [
    "---",
    `module_id: ${moduleId}`,
    "kind: exercises",
    `spine: ${sanear(String(meta.mundo), 40)}`,
    `title: "Generado por IA · ${sanear(meta.tema, 80)}"`,
    `languages: [${lenguaje === "python" ? "python" : "javascript"}]`,
    'generated_by: "Compañero (IA)"',
    "version: 1",
    "---",
    "",
  ].join("\n");
  return { ok: true, md: frontmatter + sinFm.replace(/^\n+/, ""), moduleId };
}

/** runJs envuelto con la vigilancia del Worker (§18.2): corre en el Worker con corte a 3 s y anota qué funciones
 *  agotaron el tiempo. Toda referencia corre aquí, NUNCA con execCode en el hilo principal (H6). */
export const runJsVigilado: ExecRunner = async (code, functionName, cases: TestCase[]) => {
  const r = await runJs(code, functionName, cases, 3000);
  return r;
};

export interface LoteAceptado {
  md: string;
  banco: ParsedExerciseBank;
  practicables: Exercise[];
  etiquetas: Map<string, string>;
}

export type ResultadoValidar = { ok: true } & LoteAceptado | { ok: false; motivo: string };

/** Etiqueta honesta de un ejercicio practicable (§18.2 punto 4, RF-X4). */
function etiquetaHonesta(ex: Exercise): string {
  if (ex.kind === "code") return `Generado por IA · la referencia pasa sus ${(ex as CodeExercise).testCases.filter((c) => !c.hint).length} casos en tu dispositivo`;
  if (ex.kind === "choice") return "Generado por IA · clave sin verificar por ejecución";
  return "Generado por IA · autoevaluación";
}

/**
 * Valida un lote antes de ofrecerlo (§18.2, protección b). explainExercisesMd + validateBank, con runJsVigilado por
 * omisión. Si una sola referencia no pasa sus casos (o agota el tiempo, o es Python sin runtime), rechaza el lote
 * ENTERO y no devuelve `practicables`. Los tipos practicables son code, multiple_choice y production.
 */
export async function validarLote(
  md: string,
  deps: { jsRun?: ExecRunner; pyRun?: ExecRunner; validar?: typeof validateBank } = {},
): Promise<ResultadoValidar> {
  const parsed = explainExercisesMd(md);
  if (!parsed.ok) return { ok: false, motivo: `Rechazado: ${parsed.error}` };
  const banco = parsed.bank;
  const validar = deps.validar ?? validateBank;
  const jsRun = deps.jsRun ?? runJsVigilado;
  const pyRun = deps.pyRun ?? runPy;
  const resultado = await validar(banco, { source: "import", jsRun, pyRun });
  if (!resultado.ok) {
    return { ok: false, motivo: motivoDeErrores(resultado.errors) };
  }
  // los tipos practicables son code, choice (multiple_choice del contrato) y production
  const practicables = banco.exercises.filter((e) => e.kind === "code" || e.kind === "choice" || e.kind === "production");
  const etiquetas = new Map<string, string>();
  for (const ex of practicables) etiquetas.set(ex.id, etiquetaHonesta(ex));
  return { ok: true, md, banco, practicables, etiquetas };
}

/** Arma el mensaje de rechazo a partir de los errores de validateBank (§18.2 punto 3). */
function motivoDeErrores(errores: string[]): string {
  const primero = errores[0] ?? "una referencia no pasó su validación";
  if (/runtime de Python|no hay runtime para validar la solución|no se puede validar Python/i.test(primero)) {
    return "Rechazado: no se puede validar Python en este dispositivo.";
  }
  const titulo = primero.match(/«([^»]+)»/)?.[1];
  if (/NO pasa sus propios test cases|no pasa sus casos/i.test(primero)) {
    return `Rechazado: la referencia de «${titulo ?? "un ejercicio"}» no pasa sus casos (${primero.replace(/^.*?—\s*/, "")}).`;
  }
  if (/tiempo|lazo infinito/i.test(primero)) {
    return `Rechazado: la referencia de «${titulo ?? "un ejercicio"}» tardó más de 3 s (posible lazo infinito).`;
  }
  return `Rechazado: ${primero}`;
}
