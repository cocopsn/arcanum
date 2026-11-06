import { fail, getSection, okData, rubricOf, type ForgeBlock, type SchemaResult } from "./_shared";

// j · giro (§9.3 j). Schema only: the statement is the twist (the constraint that changes); ### Rúbrica. One single
// `giro` per route bank, marked `rol: transferencia` (a content rule of banks.test.ts, CA-77, not of the parser).

export interface GiroData {
  rubrica: string[];
}

export const lines = [] as const;

export function parse(b: ForgeBlock): SchemaResult<GiroData> {
  const rubrica = rubricOf(getSection(b, "rubrica"));
  if (rubrica.length === 0) return fail("falta ### Rúbrica");
  return okData({ rubrica });
}
