import type { Lang, TestCase } from "@/lib/exercise";
import {
  deriveFunctionName,
  fail,
  fences,
  getSection,
  normLang,
  numberedItems,
  okData,
  rubricOf,
  testCasesOf,
  type ForgeBlock,
  type SchemaResult,
} from "./_shared";

// b · desvanecido (§9.3 b). Schema only. `lang:` when there are code steps. ### Pasos (numbered list),
// ### Plantilla (one fence in `lang` with regions `# <paso N>` … `# </paso N>` in Python or `// <paso N>` …
// `// </paso N>` in JS), ### Casos (like code), ### Niveles (`- N: a, b`), ### Rúbrica (for prose steps).
// A step is a CODE step when the template has its region, otherwise it is a PROSE step.

export interface DesvanecidoData {
  lang: Lang | null;
  /** step texts; pasos[0] is step 1 */
  pasos: string[];
  plantilla: { code: string; functionName: string; regiones: Record<number, string> } | null;
  casos: TestCase[] | null;
  niveles: { nivel: number; ocultos: number[] }[];
  rubrica: string[];
}

export const lines = ["lang"] as const;

function regionsOf(code: string, lang: Lang): Record<number, string> | string {
  const marker = lang === "python" ? "#" : "//";
  const esc = marker.replace(/\//g, "\\/");
  const open = new RegExp(`^\\s*${esc}\\s*<paso\\s+(\\d+)>\\s*$`);
  const close = new RegExp(`^\\s*${esc}\\s*</paso\\s+(\\d+)>\\s*$`);
  const out: Record<number, string> = {};
  let cur: { n: number; lines: string[] } | null = null;
  for (const line of code.split(/\r?\n/)) {
    const o = line.match(open);
    const c = line.match(close);
    if (o) {
      if (cur) return `la región del paso ${cur.n} no se cerró antes de abrir el paso ${o[1]}`;
      const n = parseInt(o[1]!, 10);
      if (n in out) return `la región del paso ${n} aparece dos veces`;
      cur = { n, lines: [] };
    } else if (c) {
      const n = parseInt(c[1]!, 10);
      if (!cur || cur.n !== n) return `cierre del paso ${n} sin su apertura`;
      out[n] = cur.lines.join("\n");
      cur = null;
    } else if (cur) cur.lines.push(line);
  }
  if (cur) return `la región del paso ${cur.n} no se cerró`;
  return out;
}

export function parse(b: ForgeBlock): SchemaResult<DesvanecidoData> {
  let lang: Lang | null = null;
  if (b.lines.lang !== undefined) {
    lang = normLang(b.lines.lang);
    if (!lang) return fail("lang: debe ser javascript o python");
  }
  const pasosSec = getSection(b, "pasos");
  if (!pasosSec) return fail("falta ### Pasos");
  const numbered = numberedItems(pasosSec.body);
  if (numbered.length === 0) return fail("### Pasos necesita una lista numerada");
  for (let i = 0; i < numbered.length; i++) {
    if (numbered[i]!.n !== i + 1) return fail("### Pasos debe numerarse 1, 2, 3… sin saltos");
  }
  const pasos = numbered.map((p) => p.text);

  const plantSec = getSection(b, "plantilla");
  let plantilla: DesvanecidoData["plantilla"] = null;
  let casos: TestCase[] | null = null;
  if (plantSec) {
    if (!lang) return fail("### Plantilla necesita la línea lang:");
    const f = fences(plantSec.body).find((x) => normLang(x.lang) === lang);
    if (!f || !f.code.trim()) return fail(`### Plantilla necesita una cerca en ${lang}`);
    const regiones = regionsOf(f.code, lang);
    if (typeof regiones === "string") return fail(`### Plantilla: ${regiones}`);
    const nums = Object.keys(regiones).map(Number);
    if (nums.length === 0) return fail("### Plantilla no marca ningún paso");
    if (nums.some((n) => n < 1 || n > pasos.length)) return fail("### Plantilla marca un paso que no está en ### Pasos");
    const functionName = deriveFunctionName(f.code, lang);
    if (!functionName) return fail("### Plantilla no declara una función");
    plantilla = { code: f.code, functionName, regiones };
    casos = testCasesOf(getSection(b, "casos"));
    if (!casos) return fail("falta ### Casos (cerca json con [{ input, expected }])");
  } else if (lang) {
    return fail("lang: declarado sin ### Plantilla");
  }

  const nivSec = getSection(b, "niveles");
  if (!nivSec) return fail("falta ### Niveles");
  const niveles: DesvanecidoData["niveles"] = [];
  for (const raw of nivSec.body.map((l) => l.trim()).filter(Boolean)) {
    const m = raw.match(/^[-*+]\s+(\d+)\s*:\s*(.+)$/);
    if (!m) return fail(`### Niveles: línea no reconocida «${raw}» (formato: - N: a, b)`);
    const ocultos = m[2]!.split(/[\s,]+/).filter(Boolean).map(Number);
    if (ocultos.length === 0 || ocultos.some((n) => !Number.isInteger(n) || n < 1 || n > pasos.length)) {
      return fail(`### Niveles: el nivel ${m[1]} cita un paso que no existe`);
    }
    niveles.push({ nivel: parseInt(m[1]!, 10), ocultos });
  }
  if (niveles.length === 0) return fail("### Niveles necesita al menos un nivel");
  for (let i = 0; i < niveles.length; i++) if (niveles[i]!.nivel !== i + 1) return fail("### Niveles debe numerarse 1, 2, 3… sin saltos");

  const rubrica = rubricOf(getSection(b, "rubrica"));
  const hayProsa = pasos.some((_, i) => !plantilla || !((i + 1) in plantilla.regiones));
  if (hayProsa && rubrica.length === 0) return fail("hay pasos en prosa y falta ### Rúbrica");
  return okData({ lang, pasos, plantilla, casos, niveles, rubrica });
}
