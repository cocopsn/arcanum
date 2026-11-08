import type { BankCheck, BankCheckModule, BankCheckPy } from "@/lib/exercises-validate";
import type { ForgeBankItem } from "@/forge/bank/registry";
import { pasosOf } from "@/forge/bank/types/forense";
import { FORENSE_FN, FORENSE_HARNESS_PY, FORENSE_ID_RE, forenseSpec, screenForenseControl } from "@/forge/eval/forensics";

// m · forense ingestion check (design §5.4). `check` reads the block only (never executes): the parser already
// demands the ISO cut, the sections, readable non-repeating steps in the PIPELINE, known invariant and lie types,
// columnas as a list and tolerancia numeric; here the rules close the gaps (unique ids, every lie in an existing
// step and invariant, one control per lie, per-type `esperado`/`columnas`, simple identifiers, non-negative
// tolerancia, reference controls that read data not the catalog, and a correction with the pipeline's steps in the
// same order). `py.check` runs ONLY at import: `verify_forense` (inside the harness, the same Python as bank-check)
// checks the whole item over SQLite. In the seed it never runs: bank-check.mjs verified it (forense.py, §5.7).

const labelOf = (item: ForgeBankItem) => `«${item.title}» (forense)`;

export const check: BankCheck = async (item) => {
  const label = labelOf(item);
  if (item.type !== "forense") return { ok: false, errors: [`${label}: el chequeo de forense recibió un ítem ${item.type}`] };
  const d = item.data;
  const errors: string[] = [];
  const invIds = new Set(d.invariantes.map((i) => i.id));
  const pasoIds = new Set(d.pipeline.pasos.map((p) => p.id));
  if (invIds.size !== d.invariantes.length || new Set(d.mentiras.map((m) => m.id)).size !== d.mentiras.length) errors.push(`${label}: hay ids repetidos en invariantes o mentiras`);
  for (const m of d.mentiras) {
    if (!pasoIds.has(m.paso)) errors.push(`${label}: la mentira «${m.id}» nace en «${m.paso}», que no es un paso del pipeline`);
    if (!invIds.has(m.invariante)) errors.push(`${label}: la mentira «${m.id}» rompe «${m.invariante}», que no es un invariante`);
  }
  if (d.controles.length !== d.mentiras.length) errors.push(`${label}: hay ${d.controles.length} controles de referencia para ${d.mentiras.length} mentiras`);
  for (const inv of d.invariantes) {
    const necesitaEsperado = inv.tipo === "conteo" || inv.tipo === "suma";
    if (necesitaEsperado ? typeof inv.esperado !== "number" : inv.esperado !== undefined && typeof inv.esperado !== "number") errors.push(`${label}: el invariante «${inv.id}» necesita esperado numérico`);
    if (inv.tipo !== "conteo" && (inv.columnas ?? []).length === 0) errors.push(`${label}: el invariante «${inv.id}» (${inv.tipo}) necesita columnas`);
    if (![inv.sobre, ...(inv.columnas ?? [])].every((x) => FORENSE_ID_RE.test(x))) errors.push(`${label}: el invariante «${inv.id}» usa un nombre que no es un identificador simple`);
    if (inv.tolerancia !== undefined && !(inv.tolerancia >= 0)) errors.push(`${label}: el invariante «${inv.id}» tiene tolerancia negativa`);
  }
  d.controles.forEach((c, i) => {
    const scr = screenForenseControl(c);
    if (!scr.ok) errors.push(`${label}: el control de referencia ${i + 1} no es válido: ${scr.error}`);
  });
  const pc = pasosOf(d.correccion);
  if (typeof pc === "string") errors.push(`${label}: la corrección no se puede leer: ${pc.replace("### Pipeline", "### Corrección")}`);
  const samePasos = typeof pc !== "string" && JSON.stringify(pc.map((p) => p.id)) === JSON.stringify(d.pipeline.pasos.map((p) => p.id));
  if (!samePasos) errors.push(`${label}: la corrección no tiene los mismos pasos que el pipeline, en el mismo orden`);
  return errors.length ? { ok: false, errors } : { ok: true };
};

const pyCheck: BankCheckPy = async (item, ctx) => {
  if (item.type !== "forense") return { ok: false, errors: [`${labelOf(item)}: el chequeo de forense recibió un ítem ${item.type}`] };
  const fail = (m: string) => ({ ok: false as const, errors: [`${labelOf(item)}: ${m}`] });
  const res = await ctx.pyRun(FORENSE_HARNESS_PY, FORENSE_FN.verificar, [{ input: [forenseSpec(item.data)], expected: null }]);
  if (res.timedOut) return fail("la verificación forense agotó el tiempo");
  if (res.syntaxError) return fail(`el arnés forense no corrió (${res.syntaxError})`);
  const c = res.cases[0];
  if (!c || c.error) return fail(`la verificación forense falló: ${c?.error ?? "sin resultado"}`);
  const out = c.output as { problemas?: unknown } | null | undefined;
  if (!out || !Array.isArray(out.problemas)) return fail("la verificación forense no devolvió una lista de problemas");
  const errors = out.problemas.map((p) => `${labelOf(item)}: ${String(p)}`);
  return errors.length ? { ok: false, errors } : { ok: true };
};

export const py: NonNullable<BankCheckModule["py"]> = {
  needs: (item) => item.type === "forense",
  check: pyCheck,
};
