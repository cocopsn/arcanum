import { codeFence, codeFences, fail, getSection, norm, okData, type ForgeBlock, type SchemaResult } from "./_shared";

// k · sql (§9.3 k). Schema only: `orden: si | no`; ### Esquema (sql fence); ### Datos (sql fence); ### Fixtures
// (sql fences, each starting with `-- fixture: <nombre>`, unique names); ### Solución; ### Ingenua. Running the
// reference and the naive query is the `py` step of the owner's check (e2-datos); in the seed it never runs (§9.2).

export interface SqlData {
  orden: boolean;
  esquema: string;
  datos: string;
  fixtures: { nombre: string; sql: string }[];
  solucion: string;
  ingenua: string;
}

export const lines = ["orden"] as const;

const SQL = ["sql"];

export function parse(b: ForgeBlock): SchemaResult<SqlData> {
  const o = b.lines.orden === undefined ? undefined : norm(b.lines.orden);
  if (o !== "si" && o !== "no") return fail("orden: debe ser si o no");
  const esquema = codeFence(getSection(b, "esquema"), SQL);
  if (!esquema) return fail("falta ### Esquema (cerca sql)");
  const datos = codeFence(getSection(b, "datos"), SQL);
  if (!datos) return fail("falta ### Datos (cerca sql)");
  const fx = codeFences(getSection(b, "fixtures"), SQL);
  if (fx.length === 0) return fail("falta ### Fixtures (cercas sql con -- fixture: <nombre>)");
  const fixtures: SqlData["fixtures"] = [];
  const names = new Set<string>();
  for (const sql of fx) {
    const first = sql.split(/\r?\n/).find((l) => l.trim()) ?? "";
    const m = first.trim().match(/^--\s*fixture:\s*(\S.*)$/);
    if (!m) return fail("### Fixtures: cada cerca empieza con -- fixture: <nombre>");
    const nombre = m[1]!.trim();
    if (names.has(nombre)) return fail(`### Fixtures: nombre repetido «${nombre}»`);
    names.add(nombre);
    fixtures.push({ nombre, sql });
  }
  const solucion = codeFence(getSection(b, "solucion"), SQL);
  if (!solucion) return fail("falta ### Solución (cerca sql)");
  const ingenua = codeFence(getSection(b, "ingenua"), SQL);
  if (!ingenua) return fail("falta ### Ingenua (cerca sql)");
  return okData({ orden: o === "si", esquema, datos, fixtures, solucion, ingenua });
}
