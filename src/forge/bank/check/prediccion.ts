import { structuralCheck } from "./_structural";

// REAL ingestion check of `prediccion` (§9.3 a): as `choice` plus the scale. Nothing executes.
export const check = structuralCheck("prediccion", (item) => {
  const d = item.data;
  const out: string[] = [];
  if (d.opciones.length < 2) out.push("necesita al menos 2 opciones");
  if (!Number.isInteger(d.correcta) || d.correcta < 0 || d.correcta >= d.opciones.length) out.push("la opción correcta está fuera de la lista");
  if (d.escala.length < 2 || d.escala.length > 5 || d.escala.some((n, i) => n < 50 || n > 100 || (i > 0 && n <= d.escala[i - 1]!))) {
    out.push("la escala debe tener de 2 a 5 enteros crecientes entre 50 y 100");
  }
  if (!d.justificacion.trim()) out.push("falta la justificación");
  return out;
});
