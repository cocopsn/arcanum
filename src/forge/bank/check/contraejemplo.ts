import type { BankCheck, BankCheckJs, BankCheckModule } from "@/lib/exercises-validate";
import type { ForgeBankItem } from "@/forge/bank/registry";
import { deriveFunctionName } from "@/forge/bank/types/_shared";
import { CONTRA_ARGS_MAX, gradeCounterexample } from "@/forge/eval/counterexample";

// e · contraejemplo ingestion check (design §5.1). `check` reads the block only (never executes): the parser already
// demands the signature with a function, `pre` named `pre` and the witness as an array; here three rules close the
// gaps (both the almost-correct version and the reference define the signature's function, the witness is non-empty
// and within the size limit). `js.check` runs ONLY when the bank is imported: the witness must be a real
// counterexample (the almost-correct version and the reference differ, or the invariant is violated). In the seed it
// never runs: bank-check.mjs verified it (scripts/forge/bank-check/js-verify.mjs) and recorded it in
// verification/<código>.json (§5.7).

const labelOf = (item: ForgeBankItem) => `«${item.title}» (contraejemplo)`;

export const check: BankCheck = async (item) => {
  const label = labelOf(item);
  if (item.type !== "contraejemplo") return { ok: false, errors: [`${label}: el chequeo de contraejemplo recibió un ítem ${item.type}`] };
  const d = item.data;
  const errors: string[] = [];
  if (deriveFunctionName(d.casi, "js") !== d.functionName || deriveFunctionName(d.referencia, "js") !== d.functionName) errors.push(`${label}: la casi correcta y la referencia deben definir ${d.functionName}`);
  if (d.testigo.length === 0) errors.push(`${label}: el testigo no trae argumentos`);
  if (JSON.stringify(d.testigo).length > CONTRA_ARGS_MAX) errors.push(`${label}: el testigo pasa de ${CONTRA_ARGS_MAX.toLocaleString("en-US")} caracteres`);
  return errors.length ? { ok: false, errors } : { ok: true };
};

const jsCheck: BankCheckJs = async (item, ctx) => {
  const label = labelOf(item);
  if (item.type !== "contraejemplo") return { ok: false, errors: [`${label}: el chequeo de contraejemplo recibió un ítem ${item.type}`] };
  const fail = (m: string) => ({ ok: false as const, errors: [`${label}: ${m}`] });
  const g = await gradeCounterexample(item.data, item.data.testigo, ctx.jsRun);
  if (!(g.estado === "calificada" && g.correcto)) return fail(`el testigo no muestra la diferencia (${g.estado === "calificada" ? g.motivo : g.estado === "error-item" ? g.motivo : g.estado})`);
  return { ok: true };
};

export const js: NonNullable<BankCheckModule["js"]> = {
  needs: (item) => item.type === "contraejemplo",
  check: jsCheck,
};
