import { structuralCheck } from "./_structural";

// REAL ingestion check of `giro` (§9.3 j): the twist (statement) and its rubric exist. Nothing executes. The rule
// «exactly one giro per route bank, marked rol: transferencia» is a content rule of banks.test.ts (CA-77).
export const check = structuralCheck("giro", (item) => {
  const out: string[] = [];
  if (!item.statement.trim()) out.push("el giro no dice qué restricción cambia");
  if (item.data.rubrica.length === 0) out.push("falta la rúbrica del giro");
  return out;
});
