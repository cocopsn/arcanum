import type { CaseResult, Lang } from "@/lib/exercise";
import type { ExecRunner } from "@/lib/exercises-validate";
import type { EvidenceRM } from "@/core/read-model";
import { EVIDENCE_RM_DATA_MAX } from "@/core/evidence";
import type { DesvanecidoData } from "@/forge/bank/types/desvanecido";

// b · desvanecido evaluator (design §5.3). A step is a CODE step when the template marks its region, otherwise a
// PROSE step. The level is 1 + consecutive levels approved in the log (never by time or attempts). The template is
// painted in segments: a «fijo» segment never contains the code of a hidden region (CA-E7). Prose is
// self-verified against the model step; nothing of this type goes to the AI.

/** code of one hole */
export const HUECO_MAX = 4_000;
/** text of one prose hole (maxLength); it must also fit the read model (huecoCabe) */
export const HUECO_PROSA_MAX = 3_000;

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const asc = (a: number, b: number) => a - b;

/** Object.keys(plantilla.regiones), ascending. */
export function codeSteps(d: DesvanecidoData): number[] {
  return Object.keys(d.plantilla?.regiones ?? {}).map(Number).sort(asc);
}

/** 1..n without a region. */
export function proseSteps(d: DesvanecidoData): number[] {
  const code = new Set(codeSteps(d));
  return d.pasos.map((_, i) => i + 1).filter((n) => !code.has(n));
}

/** The hidden steps of a level, split by kind; nivel > niveles.length → both empty. */
export function levelHoles(d: DesvanecidoData, nivel: number): { codigo: number[]; prosa: number[] } {
  const lvl = d.niveles[nivel - 1];
  if (!lvl) return { codigo: [], prosa: [] };
  const code = new Set(codeSteps(d));
  const ocultos = [...new Set(lvl.ocultos)].sort(asc);
  return { codigo: ocultos.filter((n) => code.has(n)), prosa: ocultos.filter((n) => !code.has(n)) };
}

/** Code steps whose reference code may be in the DOM at level `nivel`: codeSteps(d) minus levelHoles(d, nivel).codigo.
 *  With nivel > niveles.length, all of them. */
export function visibleCodeSteps(d: DesvanecidoData, nivel: number): number[] {
  const hidden = new Set(levelHoles(d, nivel).codigo);
  return codeSteps(d).filter((n) => !hidden.has(n));
}

const levelOf = (e: EvidenceRM): number => (isRecord(e.data) && Number.isInteger(e.data.nivel) ? (e.data.nivel as number) : NaN);

/** 1 + consecutive levels with a correct "nivel" evidence of the item; > niveles.length = completed. Never looks at
 *  ts or attempts. */
export function currentLevel(evidence: readonly EvidenceRM[], cellId: string, itemId: string): number {
  const passed = new Set(evidence.filter((e) => e.moduleId === cellId && e.itemId === itemId && e.type === "desvanecido" && e.phase === "nivel" && e.outcome === "correcto").map(levelOf));
  let n = 1;
  while (passed.has(n)) n++;
  return n;
}

/** The log has a correct self-verification of the item for that level (data.nivel === nivel). */
export function autoOkFor(evidence: readonly EvidenceRM[], cellId: string, itemId: string, nivel: number): boolean {
  return evidence.some((e) => e.moduleId === cellId && e.itemId === itemId && e.type === "desvanecido" && e.phase === "autoverificacion" && e.outcome === "correcto" && levelOf(e) === nivel);
}

/** The template in segments to paint: a «fijo» segment never contains the text of a hidden region. */
export function templateSegments(code: string, lang: Lang, hidden: ReadonlySet<number>): ({ kind: "fijo"; text: string } | { kind: "hueco"; paso: number })[] {
  const marker = lang === "python" ? "#" : "//";
  const esc = marker.replace(/\//g, "\\/");
  const open = new RegExp(`^\\s*${esc}\\s*<paso\\s+(\\d+)>\\s*$`);
  const close = new RegExp(`^\\s*${esc}\\s*</paso\\s+(\\d+)>\\s*$`);
  const out: ({ kind: "fijo"; text: string } | { kind: "hueco"; paso: number })[] = [];
  let buf: string[] = [];
  let skip: number | null = null;
  const flush = () => { if (buf.length) { out.push({ kind: "fijo", text: buf.join("\n") }); buf = []; } };
  for (const line of code.split(/\r?\n/)) {
    const o = line.match(open);
    const c = line.match(close);
    if (skip !== null) { if (c && parseInt(c[1]!, 10) === skip) skip = null; continue; }
    if (o) {
      const n = parseInt(o[1]!, 10);
      flush();
      if (hidden.has(n)) { out.push({ kind: "hueco", paso: n }); skip = n; continue; }   // literal
      continue;                     // opening marker of a visible step: not painted
    }
    if (c) continue;                // closing marker of a visible step: not painted
    buf.push(line);
  }
  flush();
  return out;
}

/** The template with the regions in `fills` replaced (the markers stay, as comments). */
export function fillTemplate(code: string, lang: Lang, fills: Readonly<Record<number, string>>): string {
  const marker = lang === "python" ? "#" : "//";
  const esc = marker.replace(/\//g, "\\/");
  const open = new RegExp(`^\\s*${esc}\\s*<paso\\s+(\\d+)>\\s*$`);
  const close = new RegExp(`^\\s*${esc}\\s*</paso\\s+(\\d+)>\\s*$`);
  const out: string[] = [];
  let skip: number | null = null;
  for (const line of code.split(/\r?\n/)) {
    const o = line.match(open);
    const c = line.match(close);
    if (skip !== null) {
      if (c && parseInt(c[1]!, 10) === skip) {
        skip = null;
        out.push(line);
      }
      continue;
    }
    out.push(line);
    if (o) {
      const n = parseInt(o[1]!, 10);
      if (Object.prototype.hasOwnProperty.call(fills, n)) {
        out.push(...fills[n]!.split(/\r?\n/));
        skip = n;
      }
    }
  }
  return out.join("\n");
}

/** The evidence of a prose hole fits whole in the read model (fact 14), with 64 characters of margin. */
export function huecoCabe(data: { nivel: number; paso: number; respuesta: string }): boolean {
  return JSON.stringify(data).length <= EVIDENCE_RM_DATA_MAX - 64;
}

export type FadedCodeGrade =
  | { estado: "sin-python" }
  | { estado: "tiempo" }
  | { estado: "sintaxis"; motivo: string }
  | { estado: "calificada"; correcto: boolean; pasan: number; total: number; primerFallo?: CaseResult };

/** The filled template against the item's cases (runJs or runPy). */
export async function gradeFadedCode(d: DesvanecidoData, fills: Readonly<Record<number, string>>, run: ExecRunner): Promise<FadedCodeGrade> {
  if (!d.plantilla || !d.casos || !d.lang) return { estado: "sintaxis", motivo: "el ítem no trae plantilla con casos" };
  const program = fillTemplate(d.plantilla.code, d.lang, fills);
  const r = await run(program, d.plantilla.functionName, d.casos.map((c) => ({ ...c, input: structuredClone(c.input) })));
  if (r.pyUnavailable) return { estado: "sin-python" };
  if (r.timedOut) return { estado: "tiempo" };
  if (r.syntaxError) return { estado: "sintaxis", motivo: r.syntaxError };
  const pasan = r.cases.filter((c) => c.pass).length;
  const total = r.cases.length;
  const primerFallo = r.cases.find((c) => !c.pass);
  return { estado: "calificada", correcto: total > 0 && pasan === total, pasan, total, ...(primerFallo ? { primerFallo } : {}) };
}
