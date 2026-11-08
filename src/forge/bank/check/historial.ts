import type { BankCheck, BankCheckJs, BankCheckModule } from "@/lib/exercises-validate";
import type { ForgeBankItem } from "@/forge/bank/registry";
import type { Lang } from "@/lib/exercise";
import { compileActors, compileInvariant, enumerateInterleavings, simulateHistory } from "@/forge/eval/history-sim";
import { gradeFaults } from "@/forge/eval/history-faults";

// Ingestion check of `historial` (design §9.3 c, §9.2, D8, §5.6).
// - Modo `traza`: everything is TypeScript over the block's data (closed grammar, no eval), so it runs in `check`
//   and never executes code: every step and the invariant parse; with `violar`, the reference history is feasible and
//   violates; with `proteger`, the reference protocol does not violate in any feasible interleaving and at least one
//   other protocol does; ≤ 50,000 feasible interleavings.
// - Modo `fallas`: `check` returns { ok: true } (the parser already demands the harness, calendars, solution and
//   naive per language); `js.check`/`py.check` run ONLY at import: the solution passes every calendar and the naive
//   one fails some. In the seed it never runs: bank-check.mjs verified it (js-verify.mjs, §5.7).

const label = (item: ForgeBankItem) => `«${item.title}» (historial)`;

export const check: BankCheck = async (item) => {
  if (item.type !== "historial") return { ok: false, errors: [`${label(item)}: el chequeo de historial recibió un ítem ${item.type}`] };
  const d = item.data;
  if (d.modo === "fallas") return { ok: true };
  const fail = (m: string) => ({ ok: false as const, errors: [`${label(item)}: ${m}`] });
  const vars = Object.keys(d.estado);
  const inv = compileInvariant(d.invariante, vars);
  if (typeof inv === "string") return fail(inv);
  try {
    if (d.objetivo === "violar") {
      const prog = compileActors(d.actores);
      if (typeof prog === "string") return fail(prog);
      if (!("historia" in d.referencia)) return fail("la referencia de violar necesita una historia");
      const r = simulateHistory(prog, d.estado, inv, d.chequeo, d.referencia.historia);
      if (!r.factible) return fail(`la historia de referencia no es factible (${r.motivo})`);
      if (!r.viola) return fail("la historia de referencia no viola el invariante");
      const e = enumerateInterleavings(prog, d.estado, inv, d.chequeo);
      if ("error" in e) return fail(e.error);
      return { ok: true };
    }
    if (!d.protocolos || !("protocolo" in d.referencia)) return fail("proteger necesita protocolos y un protocolo de referencia");
    let otherViolates = false;
    for (const [name, actores] of Object.entries(d.protocolos)) {
      const prog = compileActors(actores);
      if (typeof prog === "string") return fail(`protocolo «${name}»: ${prog}`);
      const e = enumerateInterleavings(prog, d.estado, inv, d.chequeo);
      if ("error" in e) return fail(`protocolo «${name}»: ${e.error}`);
      if (name === d.referencia.protocolo) {
        if (!e.seguro) return fail(`el protocolo de referencia «${name}» viola el invariante con ${e.historia.join(" ")}`);
      } else if (!e.seguro) otherViolates = true;
    }
    if (!otherViolates) return fail("ningún otro protocolo viola el invariante: no hay nada que distinguir");
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
};

const fallasCheck = (lang: Lang): BankCheckJs => async (item, ctx) => {
  if (item.type !== "historial" || item.data.modo !== "fallas") return { ok: false, errors: [`${label(item)}: el chequeo de fallas recibió otra cosa`] };
  const d = item.data;
  const run = lang === "python" ? ctx.pyRun! : ctx.jsRun;
  const errors: string[] = [];
  const gs = await gradeFaults(d, lang, d.solucion[lang]!, run);
  const fallanSol = gs.estado === "calificada" ? gs.calendarios.filter((c) => !c.correcto) : [{ nombre: "(todos)", fallan: [gs.estado] }];
  if (fallanSol.length) errors.push(`${label(item)}: la solución falla el calendario «${fallanSol[0]!.nombre}»: ${fallanSol[0]!.fallan.join(", ")}`);
  const gi = await gradeFaults(d, lang, d.ingenua[lang]!, run);
  const naiveFails = gi.estado === "calificada" ? gi.calendarios.some((c) => !c.correcto) : true;
  if (!naiveFails) errors.push(`${label(item)}: la ingenua pasa todos los calendarios: no hay nada que distinguir`);
  return errors.length ? { ok: false, errors } : { ok: true };
};

export const js: NonNullable<BankCheckModule["js"]> = {
  needs: (item) => item.type === "historial" && item.data.modo === "fallas" && !!item.data.arnes.js,
  check: fallasCheck("js"),
};

export const py: NonNullable<BankCheckModule["py"]> = {
  needs: (item) => item.type === "historial" && item.data.modo === "fallas" && !!item.data.arnes.python,
  check: fallasCheck("python"),
};
