import {
  codeFence,
  deriveFunctionName,
  fail,
  getSection,
  isNoJson,
  jsonFence,
  okData,
  type ForgeBlock,
  type SchemaResult,
} from "./_shared";

// e · contraejemplo (§9.3 e). Schema only: ### Firma (javascript); ### Precondición (`function pre(...args)`);
// ### Casi correcta; ### Referencia; ### Comparador optional (`function same(a, b, args)`); ### Invariante optional
// (`function prop(args, out)`); ### Testigo (JSON array of arguments). Running them is the owner's check (e3-ia).

export interface ContraejemploData {
  firma: string;
  functionName: string;
  pre: string;
  casi: string;
  referencia: string;
  comparador: string | null;
  invariante: string | null;
  testigo: unknown[];
}

export const lines = [] as const;

const JS = ["javascript", "js"];

export function parse(b: ForgeBlock): SchemaResult<ContraejemploData> {
  const firma = codeFence(getSection(b, "firma"), JS);
  if (!firma) return fail("falta ### Firma (cerca javascript)");
  const functionName = deriveFunctionName(firma, "js");
  if (!functionName) return fail("### Firma no declara una función");
  const pre = codeFence(getSection(b, "precondicion"), JS);
  if (!pre || deriveFunctionName(pre, "js") !== "pre") return fail("falta ### Precondición (cerca javascript con function pre(...))");
  const casi = codeFence(getSection(b, "casi correcta"), JS);
  if (!casi) return fail("falta ### Casi correcta (cerca javascript)");
  const referencia = codeFence(getSection(b, "referencia"), JS);
  if (!referencia) return fail("falta ### Referencia (cerca javascript)");
  const compSec = getSection(b, "comparador");
  const comparador = compSec ? codeFence(compSec, JS) : null;
  if (compSec && (!comparador || deriveFunctionName(comparador, "js") !== "same")) return fail("### Comparador debe definir function same(a, b, args)");
  const invSec = getSection(b, "invariante");
  const invariante = invSec ? codeFence(invSec, JS) : null;
  if (invSec && (!invariante || deriveFunctionName(invariante, "js") !== "prop")) return fail("### Invariante debe definir function prop(args, out)");
  const testigo = jsonFence(getSection(b, "testigo"));
  if (isNoJson(testigo) || !Array.isArray(testigo)) return fail("falta ### Testigo (cerca json con la lista de argumentos)");
  return okData({ firma, functionName, pre, casi, referencia, comparador, invariante, testigo });
}
