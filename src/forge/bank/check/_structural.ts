import type { ForgeBankItem, ForgeItemOf, ForgeType } from "@/forge/bank/registry";
import type { BankCheck } from "@/lib/exercises-validate";

// Helper for the 7 STRUCTURAL ingestion checks delivered real in Phase 0 (giro, expediente, entrevista, gameday,
// recuperacion, senal, prediccion; §9.2). They only cross data of the block: nothing executes. Every error names
// the exercise and its type (CA-31).

export function structuralCheck<T extends ForgeType>(type: T, rules: (item: ForgeItemOf<T>) => string[]): BankCheck {
  return async (item: ForgeBankItem) => {
    const label = `«${item.title}» (${item.type})`;
    if (item.type !== type) return { ok: false, errors: [`${label}: el chequeo de ${type} recibió un ítem de otro tipo`] };
    const problems = rules(item as ForgeItemOf<T>);
    return problems.length ? { ok: false, errors: problems.map((p) => `${label}: ${p}`) } : { ok: true };
  };
}

export function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) (seen.has(id) ? dup : seen).add(id);
  return [...dup];
}
