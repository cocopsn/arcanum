import { structuralCheck } from "./_structural";

// REAL ingestion check of `expediente` (§9.3 h): passes 2 and 3 not empty; rubric not empty. Nothing executes.
export const check = structuralCheck("expediente", (item) => {
  const out: string[] = [];
  if (!item.data.pasada2.trim()) out.push("la pasada 2 está vacía");
  if (!item.data.pasada3.trim()) out.push("la pasada 3 está vacía");
  if (item.data.rubrica.length === 0) out.push("la rúbrica está vacía");
  return out;
});
