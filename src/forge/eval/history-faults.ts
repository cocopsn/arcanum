import type { Lang } from "@/lib/exercise";
import type { ExecRunner } from "@/lib/exercises-validate";
import type { HistorialData } from "@/forge/bank/types/historial";

// c · historial in mode `fallas` (design §5.6). The learner's function and the bank's harness run as one program
// (learner first, so with two `function arnes` the bank's wins). The harness mounts the simulated service, runs one
// calendar and returns its properties; a calendar is correct when every property of `espera` has its value. Each
// calendar is cloned before the run: execCode passes the same object, and a harness or a learner that empties the
// calendar would change the bank's calendars for the next attempt.

export const FALLAS_CODE_MAX = 20_000;

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/** Learner's code + bank's harness, in that order. */
export function faultsProgram(alumno: string, arnes: string): string {
  return `${alumno}\n;\n${arnes}`;
}

/** Properties of `espera` whose value is not the one in the harness output. */
export function failingProps(output: unknown, espera: Record<string, boolean>): string[] {
  if (!isRecord(output)) return Object.keys(espera);
  const o = output;
  const fallan: string[] = [];
  for (const k of Object.keys(espera)) if (o[k] !== espera[k]) fallan.push(k);
  return fallan;
}

export interface CalendarResult {
  nombre: string;
  correcto: boolean;
  fallan: string[];
  error?: string;
}
export type FaultsGrade =
  | { estado: "sin-python" }
  | { estado: "tiempo" }
  | { estado: "sintaxis"; motivo: string }
  | { estado: "calificada"; correcto: boolean; calendarios: CalendarResult[] };

export async function gradeFaults(d: Extract<HistorialData, { modo: "fallas" }>, lang: Lang, code: string, run: ExecRunner): Promise<FaultsGrade> {
  const arnes = d.arnes[lang];
  if (!arnes) return { estado: "sintaxis", motivo: `el ítem no trae arnés en ${lang}` };
  const r = await run(faultsProgram(code, arnes), "arnes", d.calendarios.map((c) => ({ name: c.nombre, input: [structuredClone(c)], expected: c.espera })));
  if (r.pyUnavailable) return { estado: "sin-python" };
  if (r.timedOut) return { estado: "tiempo" };
  if (r.syntaxError) return { estado: "sintaxis", motivo: r.syntaxError };
  const calendarios: CalendarResult[] = d.calendarios.map((cal, i) => {
    const c = r.cases[i];
    const todas = Object.keys(cal.espera);
    if (!c) return { nombre: cal.nombre, correcto: false, fallan: todas, error: "sin resultado" };
    if (c.error !== undefined) return { nombre: cal.nombre, correcto: false, fallan: todas, error: c.error };
    const fallan = failingProps(c.output, cal.espera);
    return { nombre: cal.nombre, correcto: fallan.length === 0, fallan };
  });
  return { estado: "calificada", correcto: calendarios.length > 0 && calendarios.every((c) => c.correcto), calendarios };
}
