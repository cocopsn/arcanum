import { structuralCheck } from "./_structural";

// REAL ingestion check of `senal` (§9.3 f): every signal appears LITERALLY in its statement; the patterns used are
// in the list and there are at least 3 distinct ones. Nothing executes.
export const check = structuralCheck("senal", (item) => {
  const { patrones, items } = item.data;
  const out: string[] = [];
  items.forEach((it, i) => {
    if (!it.enunciado.includes(it.senal)) out.push(`ítem ${i + 1}: la señal «${it.senal}» no aparece literal en su enunciado`);
    if (!patrones.includes(it.patron)) out.push(`ítem ${i + 1}: el patrón «${it.patron}» no está en ### Patrones`);
  });
  const usados = new Set(items.map((it) => it.patron));
  if (usados.size < 3) out.push(`el set mezcla ${usados.size} patrones; necesita al menos 3 distintos`);
  return out;
});
