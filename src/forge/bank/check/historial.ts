import type { BankCheck } from "@/lib/exercises-validate";
import type { ForgeBankItem } from "@/forge/bank/registry";
import { compileActors, compileInvariant, enumerateInterleavings, simulateHistory } from "@/forge/eval/history-sim";

// Ingestion check of `historial` (design §9.3 c, §9.2, D8).
// - Modo `traza`: everything is TypeScript over the block's data (closed grammar, no eval), so it runs in `check`
//   and never executes code: every step and the invariant parse; with `violar`, the reference history is feasible and
//   violates; with `proteger`, the reference protocol does not violate in any feasible interleaving and at least one
//   other protocol does; ≤ 50,000 feasible interleavings.
// - Modo `fallas`: its grading (the learner's code + the harness in the Worker) is not in this version yet, so the item
//   stays PENDING (`{ disponible: false }`): accepted, never offered, and the bank at most «Autorado» (§9.2, §22.5).

const label = (item: ForgeBankItem) => `«${item.title}» (historial)`;

export const check: BankCheck = async (item) => {
  if (item.type !== "historial") return { ok: false, errors: [`${label(item)}: el chequeo de historial recibió un ítem ${item.type}`] };
  const d = item.data;
  if (d.modo === "fallas") return { disponible: false };
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
