import type { BankCheck, BankCheckJs, BankCheckModule } from "@/lib/exercises-validate";
import type { ForgeBankItem } from "@/forge/bank/registry";
import { deriveFunctionName } from "@/forge/bank/types/_shared";
import { killedBy } from "@/forge/eval/mutants";

// d · mutantes ingestion check (design §5.2). `check` reads the block only (never executes): the parser already
// demands `minimo` ≥ 1, unique mutant ids and one fence per mutant; here four rules close the gaps (at least one
// critical mutant, `minimo` within range, no mutant equal to the reference or another, and every mutant defines the
// signature's function). `js.check` runs ONLY at import: the reference passes every golden case and each mutant is
// killed by some golden case. In the seed it never runs: bank-check.mjs verified it and recorded it (§5.7).

const labelOf = (item: ForgeBankItem) => `«${item.title}» (mutantes)`;

export const check: BankCheck = async (item) => {
  const label = labelOf(item);
  if (item.type !== "mutantes") return { ok: false, errors: [`${label}: el chequeo de mutantes recibió un ítem ${item.type}`] };
  const d = item.data;
  const errors: string[] = [];
  if (!d.mutantes.some((m) => m.critico)) errors.push(`${label}: ningún mutante es crítico`);
  if (d.minimo > d.mutantes.length) errors.push(`${label}: minimo (${d.minimo}) pasa del número de mutantes (${d.mutantes.length})`);
  const sinEspacios = (s: string) => s.replace(/\s+/g, "");
  const vistos = new Set([sinEspacios(d.referencia)]);
  for (const m of d.mutantes) {
    if (vistos.has(sinEspacios(m.code))) errors.push(`${label}: el mutante «${m.id}» es igual a la referencia o a otro mutante`);
    vistos.add(sinEspacios(m.code));
    if (deriveFunctionName(m.code, "js") !== d.functionName) errors.push(`${label}: el mutante «${m.id}» no define ${d.functionName}`);
  }
  return errors.length ? { ok: false, errors } : { ok: true };
};

const jsCheck: BankCheckJs = async (item, ctx) => {
  const label = labelOf(item);
  if (item.type !== "mutantes") return { ok: false, errors: [`${label}: el chequeo de mutantes recibió un ítem ${item.type}`] };
  const d = item.data;
  const fn = d.functionName;
  const dorados = () => d.dorados.map((c) => ({ input: structuredClone(c.input), expected: c.expected }));
  const errors: string[] = [];
  const ref = await ctx.jsRun(d.referencia, fn, dorados());
  const refPasaDorados = ref.syntaxError === null && !ref.timedOut && ref.cases.every((c) => c.pass);
  if (!refPasaDorados) errors.push(`${label}: la referencia no pasa el caso dorado ${ref.cases.findIndex((c) => !c.pass) + 1}`);
  for (const m of d.mutantes) {
    const killedByGolden = killedBy(await ctx.jsRun(m.code, fn, dorados()));
    if (!killedByGolden) errors.push(`${label}: el mutante «${m.id}» no falla ningún caso dorado`);
  }
  return errors.length ? { ok: false, errors } : { ok: true };
};

export const js: NonNullable<BankCheckModule["js"]> = {
  needs: (item) => item.type === "mutantes",
  check: jsCheck,
};
