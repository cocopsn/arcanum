import type { BankCheck, BankCheckJs, BankCheckModule } from "@/lib/exercises-validate";
import type { ForgeBankItem } from "@/forge/bank/registry";
import type { Lang } from "@/lib/exercise";
import { proseSteps } from "@/forge/eval/faded";

// b · desvanecido ingestion check (design §5.3). `check` reads the block only (never executes): the parser already
// demands numbered steps and levels that cite steps that exist; here three rules close the gaps (the levels nest and
// each hides more than the last, the last level hides at least two steps, and every prose step is hidden in some
// level so it is practised). `js.check`/`py.check` run ONLY at import: the full template (its regions are the
// reference code) passes every `### Casos`. In the seed it never runs: bank-check.mjs verified it (§5.7).

const labelOf = (item: ForgeBankItem) => `«${item.title}» (desvanecido)`;

export const check: BankCheck = async (item) => {
  const label = labelOf(item);
  if (item.type !== "desvanecido") return { ok: false, errors: [`${label}: el chequeo de desvanecido recibió un ítem ${item.type}`] };
  const d = item.data;
  const errors: string[] = [];
  for (let k = 1; k < d.niveles.length; k++) {
    const prev = d.niveles[k - 1]!.ocultos, cur = d.niveles[k]!.ocultos;
    if (!prev.every((n) => cur.includes(n)) || cur.length <= prev.length) errors.push(`${label}: el nivel ${k + 1} no contiene al nivel ${k} o no oculta más pasos`);
  }
  if (d.niveles[d.niveles.length - 1]!.ocultos.length < 2) errors.push(`${label}: el último nivel oculta menos de 2 pasos`);
  const prosaSinNivel = proseSteps(d).filter((n) => !d.niveles.some((l) => l.ocultos.includes(n)));
  if (prosaSinNivel.length) errors.push(`${label}: el paso de prosa ${prosaSinNivel[0]} no se oculta en ningún nivel: nunca se practica`);
  return errors.length ? { ok: false, errors } : { ok: true };
};

const jsCheck = (lang: Lang): BankCheckJs => async (item, ctx) => {
  const label = labelOf(item);
  if (item.type !== "desvanecido") return { ok: false, errors: [`${label}: el chequeo de desvanecido recibió un ítem ${item.type}`] };
  const d = item.data;
  if (!d.plantilla || !d.casos) return { ok: false, errors: [`${label}: falta la plantilla con casos`] };
  const run = lang === "python" ? ctx.pyRun! : ctx.jsRun;
  const r = await run(d.plantilla.code, d.plantilla.functionName, d.casos.map((c) => ({ ...c, input: structuredClone(c.input) })));
  const errors: string[] = [];
  const refPasses = r.syntaxError === null && !r.timedOut && r.cases.every((c) => c.pass);
  if (!refPasses) errors.push(`${label}: la plantilla de referencia no pasa el caso ${r.cases.findIndex((c) => !c.pass) + 1}`);
  return errors.length ? { ok: false, errors } : { ok: true };
};

export const js: NonNullable<BankCheckModule["js"]> = {
  needs: (item) => item.type === "desvanecido" && item.data.lang === "js" && !!item.data.plantilla,
  check: jsCheck("js"),
};

export const py: NonNullable<BankCheckModule["py"]> = {
  needs: (item) => item.type === "desvanecido" && item.data.lang === "python" && !!item.data.plantilla,
  check: jsCheck("python"),
};
