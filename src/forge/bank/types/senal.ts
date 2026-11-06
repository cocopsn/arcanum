import { eachObj, fail, getSection, isNoJson, isStr, jsonFence, listItems, okData, type ForgeBlock, type SchemaResult } from "./_shared";

// f · senal (§9.3 f). Schema only: `semilla: N`; ### Patrones (list, ≥ 3); ### Ítems (JSON [{ enunciado, patron,
// senal }], ≥ 3). The cross-checks (each signal literal in its statement, ≥ 3 distinct patterns used) are the
// real ingestion check in check/senal.ts.

export interface SenalData {
  semilla: number;
  patrones: string[];
  items: { enunciado: string; patron: string; senal: string }[];
}

export const lines = ["semilla"] as const;

export function parse(b: ForgeBlock): SchemaResult<SenalData> {
  const semilla = Number(b.lines.semilla);
  if (b.lines.semilla === undefined || !Number.isInteger(semilla) || semilla < 0 || semilla > 0xffffffff) {
    return fail("semilla: debe ser un entero entre 0 y 4294967295");
  }
  const patSec = getSection(b, "patrones");
  if (!patSec) return fail("falta ### Patrones");
  const patrones = listItems(patSec.body);
  if (patrones.length < 3) return fail("### Patrones necesita al menos 3 patrones");
  const items = jsonFence(getSection(b, "items"));
  if (isNoJson(items) || !Array.isArray(items)) return fail("falta ### Ítems (cerca json)");
  if (items.length < 3) return fail("### Ítems necesita al menos 3 ítems");
  const err = eachObj(items, "### Ítems", (o) => (isStr(o.enunciado) && isStr(o.patron) && isStr(o.senal) ? null : "necesita enunciado, patron y senal"));
  if (err) return fail(err);
  return okData({ semilla, patrones, items: items as SenalData["items"] });
}
