import { duplicates, structuralCheck } from "./_structural";

// REAL ingestion check of `gameday` (§9.3 p): the key's ids exist; evidence indices are valid; at least one valid
// and one dangerous action (disjoint); the timeline is ordered. Nothing executes.
function tOrder(t: string | number): number {
  return typeof t === "number" ? t : Date.parse(t);
}

export const check = structuralCheck("gameday", (item) => {
  const { linea, causas, acciones, clave } = item.data;
  const out: string[] = [];
  for (const id of duplicates(causas.map((c) => c.id))) out.push(`id de causa repetido «${id}»`);
  for (const id of duplicates(acciones.map((a) => a.id))) out.push(`id de acción repetido «${id}»`);
  if (!causas.some((c) => c.id === clave.causa)) out.push(`la clave cita la causa «${clave.causa}», que no existe`);
  if (clave.evidencia.length === 0) out.push("la clave no cita ningún evento como evidencia");
  for (const i of clave.evidencia) if (!Number.isInteger(i) || i < 0 || i >= linea.length) out.push(`la clave cita el evento ${i}, fuera de la línea de tiempo`);
  const accIds = new Set(acciones.map((a) => a.id));
  for (const id of [...clave.acciones_validas, ...clave.acciones_peligrosas]) if (!accIds.has(id)) out.push(`la clave cita la acción «${id}», que no existe`);
  if (clave.acciones_validas.length === 0) out.push("la clave necesita al menos una acción válida");
  if (clave.acciones_peligrosas.length === 0) out.push("la clave necesita al menos una acción peligrosa");
  for (const id of clave.acciones_validas) if (clave.acciones_peligrosas.includes(id)) out.push(`la acción «${id}» es válida y peligrosa a la vez`);
  const ts = linea.map((e) => tOrder(e.t));
  if (ts.some((t) => !Number.isFinite(t))) out.push("la línea de tiempo tiene un instante t que no es fecha ni número");
  else for (let i = 1; i < ts.length; i++) if (ts[i]! < ts[i - 1]!) {
    out.push(`la línea de tiempo no está ordenada (evento ${i})`);
    break;
  }
  return out;
});
