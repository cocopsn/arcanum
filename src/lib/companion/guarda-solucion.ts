// Guarda de solución de la tarea abierta (design §18.6). Refuerza «nunca da la respuesta final de una tarea evaluable»
// donde se puede comprobar ejecutando. Si el aprendiz tiene abierto un ejercicio `code` curado en ExerciseMode, se busca
// con loadBankForModule (SÓLO lectura, nunca materializa) por título y lenguaje; cada bloque de código de la respuesta
// que define la función del ejercicio se corre con runJs contra sus casos y, si pasa TODOS, se retira; una referencia de
// un lote generado que resuelve el ejercicio abierto hace que el lote se rechace. Las variantes procedurales no se
// comprueban (no están en el banco).
import { loadBankForModule } from "@/lib/exercise-store";
import { runJs } from "@/lib/js-runner";
import { runPy } from "@/lib/py-runner";
import { evaluateRun, type CodeExercise, type Exercise, type Lang } from "@/lib/exercise";
import type { ExecRunner } from "@/lib/exercises-validate";

const RETIRADO = "[código retirado: resolvía tu ejercicio en curso]";

export interface EjercicioAbierto {
  /** id de la celda/módulo del ejercicio abierto (del sensor) */
  moduleId: string;
  /** título del h2 que ve el sensor */
  titulo: string;
  /** lenguaje del ejercicio en curso */
  lenguaje: Lang;
}

export interface DepsGuarda {
  cargarBanco?: (moduleId: string) => Promise<Exercise[]>;
  jsRun?: ExecRunner;
  pyRun?: ExecRunner;
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Busca en el banco curado el ejercicio `code` abierto por título y lenguaje (sólo lectura). */
async function ejercicioCurado(abierto: EjercicioAbierto, deps: DepsGuarda): Promise<CodeExercise | null> {
  const cargar = deps.cargarBanco ?? loadBankForModule;
  const banco = await cargar(abierto.moduleId).catch(() => [] as Exercise[]);
  const found = banco.find(
    (ex): ex is CodeExercise => ex.kind === "code" && (ex as CodeExercise).lang === abierto.lenguaje && norm(ex.title) === norm(abierto.titulo),
  );
  return found ?? null;
}

/** ¿Un bloque de código resuelve el ejercicio abierto? Corre la función contra TODOS los casos del ejercicio. */
async function resuelve(codigo: string, ejercicio: CodeExercise, deps: DepsGuarda): Promise<boolean> {
  const jsRun = deps.jsRun ?? ((c, f, cs) => runJs(c, f, cs, 3000));
  const pyRun = deps.pyRun ?? runPy;
  const correr = ejercicio.lang === "python" ? pyRun : jsRun;
  try {
    const r = await correr(codigo, ejercicio.functionName, ejercicio.testCases);
    return evaluateRun(r).allPass;
  } catch {
    return false;
  }
}

/** Extrae los bloques de código de un lenguaje de un markdown (cercas ``` con info-string del lenguaje). */
function bloquesDeCodigo(md: string, lang: Lang): { bloque: string; inicio: number; fin: number }[] {
  const out: { bloque: string; inicio: number; fin: number }[] = [];
  const re = /```([^\n]*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const info = m[1]!.trim().toLowerCase();
    const esJs = lang === "js" && (info === "js" || info === "javascript" || info === "node" || info === "");
    const esPy = lang === "python" && (info === "py" || info === "python");
    if (esJs || esPy) out.push({ bloque: m[2]!, inicio: m.index, fin: m.index + m[0].length });
  }
  return out;
}

/**
 * Revisa la respuesta del modelo (§18.6): retira cada bloque de código que resuelve el ejercicio abierto. Devuelve el
 * markdown saneado y cuántos bloques se retiraron. Si no hay ejercicio abierto o no se encuentra curado, devuelve el
 * texto igual.
 */
export async function guardarRespuesta(
  md: string,
  abierto: EjercicioAbierto | null,
  deps: DepsGuarda = {},
): Promise<{ md: string; retirados: number }> {
  if (!abierto) return { md, retirados: 0 };
  const ejercicio = await ejercicioCurado(abierto, deps);
  if (!ejercicio) return { md, retirados: 0 };
  const bloques = bloquesDeCodigo(md, ejercicio.lang);
  if (bloques.length === 0) return { md, retirados: 0 };
  // decidimos por bloque; reconstruimos de atrás hacia adelante para no mover los índices
  const aRetirar: { inicio: number; fin: number }[] = [];
  for (const b of bloques) {
    if (/^\s*$/.test(b.bloque)) continue;
    // sólo nos interesa si el bloque define la función del ejercicio
    if (!new RegExp(`\\b${ejercicio.functionName}\\b`).test(b.bloque)) continue;
    if (await resuelve(b.bloque, ejercicio, deps)) aRetirar.push({ inicio: b.inicio, fin: b.fin });
  }
  if (aRetirar.length === 0) return { md, retirados: 0 };
  let salida = md;
  for (const r of aRetirar.sort((a, c) => c.inicio - a.inicio)) {
    salida = salida.slice(0, r.inicio) + RETIRADO + salida.slice(r.fin);
  }
  return { md: salida, retirados: aRetirar.length };
}

/**
 * Comprueba si un lote generado resuelve el ejercicio abierto (§18.6): si la referencia de algún ejercicio `code` del
 * lote pasa TODOS los casos del ejercicio en curso, el lote se rechaza. Devuelve el motivo o null si pasa la guarda.
 */
export async function guardarLote(
  practicables: Exercise[],
  abierto: EjercicioAbierto | null,
  deps: DepsGuarda = {},
): Promise<{ rechazado: true; motivo: string } | { rechazado: false }> {
  if (!abierto) return { rechazado: false };
  const ejercicio = await ejercicioCurado(abierto, deps);
  if (!ejercicio) return { rechazado: false };
  for (const ex of practicables) {
    if (ex.kind !== "code") continue;
    const ref = (ex as CodeExercise).referenceSolution;
    if (!ref || !new RegExp(`\\b${ejercicio.functionName}\\b`).test(ref)) continue;
    if (await resuelve(ref, ejercicio, deps)) return { rechazado: true, motivo: "Rechazado: el lote resolvía tu ejercicio en curso." };
  }
  return { rechazado: false };
}

export { RETIRADO };
