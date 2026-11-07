import type { BankCheck, BankCheckJs, BankCheckModule } from "@/lib/exercises-validate";
import type { ForgeBankItem } from "@/forge/bank/registry";
import type { Lang } from "@/lib/exercise";

// i · retencion ingestion check (design §5.5). `check` returns { ok: true } with no rules of its own: the parser
// already demands the statement (the variant), and with `forma: codigo` the signature, functionName, solution per
// language and non-empty cases; with `forma: defensa` the rubric. `js.check`/`py.check` run ONLY at import (only for
// `forma: codigo`): the solution of that language passes its cases. The content rule (variante_de and a statement
// that is not a copy of its base) lives in banks.test.ts, which sees the whole bank. In the seed it never runs (§5.7).

const label = (item: ForgeBankItem) => `«${item.title}» (retencion)`;

export const check: BankCheck = async (item) => {
  if (item.type !== "retencion") return { ok: false, errors: [`${label(item)}: el chequeo de retencion recibió un ítem ${item.type}`] };
  return { ok: true };
};

const jsCheck = (lang: Lang): BankCheckJs => async (item, ctx) => {
  if (item.type !== "retencion") return { ok: false, errors: [`${label(item)}: el chequeo de retencion recibió un ítem ${item.type}`] };
  const d = item.data;
  if (d.forma !== "codigo") return { ok: true };
  const code = d.solucion[lang];
  if (!code) return { ok: true };
  const fn = d.functionName[lang]!;
  const run = lang === "python" ? ctx.pyRun! : ctx.jsRun;
  const r = await run(code, fn, d.casos.map((c) => ({ ...c, input: structuredClone(c.input) })));
  const errors: string[] = [];
  const solPasses = r.syntaxError === null && !r.timedOut && r.cases.every((c) => c.pass);
  if (!solPasses) errors.push(`${label(item)}: la solución de la retención no pasa sus casos (${lang}, caso ${r.cases.findIndex((c) => !c.pass) + 1})`);
  return errors.length ? { ok: false, errors } : { ok: true };
};

export const js: NonNullable<BankCheckModule["js"]> = {
  needs: (item) => item.type === "retencion" && item.data.forma === "codigo" && !!item.data.solucion.js,
  check: jsCheck("js"),
};

export const py: NonNullable<BankCheckModule["py"]> = {
  needs: (item) => item.type === "retencion" && item.data.forma === "codigo" && !!item.data.solucion.python,
  check: jsCheck("python"),
};
