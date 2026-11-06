import { fail, getSection, okData, rubricOf, sectionText, type ForgeBlock, type SchemaResult } from "./_shared";

// h · expediente (§9.3 h). Schema only: the statement is the decision and pressure of the case; ### Pasada 2 (new
// demand or constraint); ### Pasada 3 (incident); ### Rúbrica. The 18-section template and the 6 ADR fields are
// fixed in code (owner e3-ia: eval/expediente.ts).

export interface ExpedienteData {
  pasada2: string;
  pasada3: string;
  rubrica: string[];
}

export const lines = [] as const;

export function parse(b: ForgeBlock): SchemaResult<ExpedienteData> {
  const pasada2 = sectionText(getSection(b, "pasada 2"));
  if (!pasada2) return fail("falta ### Pasada 2");
  const pasada3 = sectionText(getSection(b, "pasada 3"));
  if (!pasada3) return fail("falta ### Pasada 3");
  const rubrica = rubricOf(getSection(b, "rubrica"));
  if (rubrica.length === 0) return fail("falta ### Rúbrica");
  return okData({ pasada2, pasada3, rubrica });
}
