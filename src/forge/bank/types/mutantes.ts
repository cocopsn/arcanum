import type { TestCase } from "@/lib/exercise";
import {
  codeFence,
  deriveFunctionName,
  fail,
  getSection,
  ITEM_ID_RE,
  norm,
  okData,
  sectionText,
  splitH4,
  testCasesOf,
  type ForgeBlock,
  type SchemaResult,
} from "./_shared";

// d · mutantes (§9.3 d). Schema only: `minimo: N`; ### Firma (javascript); ### Referencia (javascript);
// ### Mutantes with `#### <id>` or `#### <id> · crítico`, each with a javascript fence; ### Casos dorados (JSON as
// in code); ### Formato de casos (prose). Running the reference and the mutants is the owner's check (e3-ia),
// and in the seed it never runs (M1, §9.2).

export interface MutantesData {
  minimo: number;
  firma: string;
  functionName: string;
  referencia: string;
  mutantes: { id: string; critico: boolean; code: string }[];
  dorados: TestCase[];
  formato: string;
}

export const lines = ["minimo"] as const;

const JS = ["javascript", "js"];

export function parse(b: ForgeBlock): SchemaResult<MutantesData> {
  const minimo = Number(b.lines.minimo);
  if (b.lines.minimo === undefined || !Number.isInteger(minimo) || minimo < 1) return fail("minimo: debe ser un entero ≥ 1");
  const firma = codeFence(getSection(b, "firma"), JS);
  if (!firma) return fail("falta ### Firma (cerca javascript)");
  const referencia = codeFence(getSection(b, "referencia"), JS);
  if (!referencia) return fail("falta ### Referencia (cerca javascript)");
  const functionName = deriveFunctionName(firma, "js") ?? deriveFunctionName(referencia, "js");
  if (!functionName) return fail("### Firma no declara una función");
  const mutSec = getSection(b, "mutantes");
  if (!mutSec) return fail("falta ### Mutantes");
  const { parts } = splitH4(mutSec.body);
  if (parts.length === 0) return fail("### Mutantes necesita al menos un #### <id>");
  const mutantes: MutantesData["mutantes"] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const m = p.heading.match(/^(\S+?)(?:\s*·\s*(\S+))?\s*$/);
    if (!m || !ITEM_ID_RE.test(m[1]!)) return fail(`### Mutantes: encabezado no válido «${p.heading}» (#### <id> o #### <id> · crítico)`);
    if (m[2] !== undefined && norm(m[2]) !== "critico") return fail(`### Mutantes: marca desconocida «${m[2]}» (sólo «crítico»)`);
    if (seen.has(m[1]!)) return fail(`### Mutantes: id repetido «${m[1]}»`);
    seen.add(m[1]!);
    const code = codeFence({ heading: p.heading, key: "", body: p.body }, JS);
    if (!code) return fail(`### Mutantes: «${m[1]}» necesita una cerca javascript`);
    mutantes.push({ id: m[1]!, critico: m[2] !== undefined, code });
  }
  const dorados = testCasesOf(getSection(b, "casos dorados"));
  if (!dorados) return fail("falta ### Casos dorados (cerca json con [{ input, expected }])");
  const formato = sectionText(getSection(b, "formato de casos"));
  if (!formato) return fail("falta ### Formato de casos");
  return okData({ minimo, firma, functionName, referencia, mutantes, dorados, formato });
}
