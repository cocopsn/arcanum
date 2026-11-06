import { verifyOntology } from "@/forge/eval/ontology";
import { duplicates, structuralCheck } from "./_structural";

// REAL ingestion check of `ontologia` (design §9.3 l). Nothing executes (D8: `check` never calls ctx.jsRun): it
// crosses data of the block. Unique decision ids; well-formed ### Fuentes and ### Exigencias; and the author's
// reference passes the structural verifier with ZERO findings, which includes meeting every requirement.
const EXIGENCIA_KEYS = new Set(["objetos", "links", "acciones", "propiedades", "interfaces"]);

export const check = structuralCheck("ontologia", (item) => {
  const { decisiones, fuentes, exigencias, referencia } = item.data;
  const out: string[] = [];
  for (const id of duplicates(decisiones.map((d) => d.id))) out.push(`id de decisión repetido «${id}»`);
  if (fuentes) {
    for (const id of duplicates(fuentes.map((f) => f.id))) out.push(`### Fuentes: id repetido «${id}»`);
    for (const f of fuentes) if (f.columnas.length === 0) out.push(`### Fuentes: «${f.id}» no tiene columnas`);
  }
  if (exigencias) {
    for (const [k, v] of Object.entries(exigencias)) {
      if (!EXIGENCIA_KEYS.has(k)) out.push(`### Exigencias: clave desconocida «${k}» (usa objetos, links, acciones, propiedades o interfaces)`);
      else if (!Array.isArray(v)) out.push(`### Exigencias: «${k}» debe ser una lista`);
    }
  }
  for (const id of duplicates(referencia.objetos.map((o) => o.id))) out.push(`### Referencia: id de objeto repetido «${id}»`);
  for (const id of duplicates(referencia.links.map((l) => l.id))) out.push(`### Referencia: id de link repetido «${id}»`);
  for (const id of duplicates(referencia.acciones.map((a) => a.id))) out.push(`### Referencia: id de acción repetido «${id}»`);
  for (const h of verifyOntology(referencia, { decisiones, fuentes, exigencias })) out.push(`### Referencia: ${h.codigo} en «${h.elemento}»: ${h.mensaje}`);
  return out;
});
