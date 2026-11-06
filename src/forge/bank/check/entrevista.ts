import { duplicates, structuralCheck } from "./_structural";

// REAL ingestion check of `entrevista` (§9.3 g): unique ids; every fact points to a persona; every persona has at
// least one hidden fact. Nothing executes.
export const check = structuralCheck("entrevista", (item) => {
  const { personas, hechos } = item.data;
  const out: string[] = [];
  for (const id of duplicates(personas.map((p) => p.id))) out.push(`id de persona repetido «${id}»`);
  for (const id of duplicates(hechos.map((h) => h.id))) out.push(`id de hecho repetido «${id}»`);
  const ids = new Set(personas.map((p) => p.id));
  for (const h of hechos) if (!ids.has(h.persona)) out.push(`el hecho «${h.id}» apunta a la persona «${h.persona}», que no existe`);
  for (const p of personas) if (!hechos.some((h) => h.persona === p.id && h.oculto)) out.push(`la persona «${p.id}» no tiene ningún hecho oculto`);
  return out;
});
