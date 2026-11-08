import {
  codeFence,
  codeFences,
  eachObj,
  fail,
  getSection,
  isIsoInstant,
  isNoJson,
  isStr,
  isStrArr,
  jsonFence,
  okData,
  type ForgeBlock,
  type SchemaResult,
} from "./_shared";

// m · forense (pipeline forensics, §9.3 m). Schema only: `corte:` (fixed ISO instant, never the clock); ### Esquema
// and ### Datos (sql); ### Pipeline (sql with `-- paso: <id>` steps); ### Invariantes (JSON); ### Mentiras (JSON,
// reserved); ### Corrección (sql); ### Control de referencia (one sql fence per lie); ### Datos limpios (optional
// sql). Running the SQL is the `py` step of the owner's check (e2-datos); in the seed it never runs (§9.2).

export const INVARIANTE_TIPOS = ["conteo", "unicidad", "frescura", "nulos", "suma"] as const;
export const MENTIRA_TIPOS = ["join-multiplica", "fuente-vieja", "dedupe-pierde", "nulos-cuentan"] as const;

export interface ForenseData {
  corte: string;
  esquema: string;
  datos: string;
  pipeline: { sql: string; pasos: { id: string; sql: string }[] };
  invariantes: {
    id: string;
    tipo: (typeof INVARIANTE_TIPOS)[number];
    sobre: string;
    columnas?: string[];
    esperado?: unknown;
    tolerancia?: number;
  }[];
  mentiras: { id: string; paso: string; tipo: (typeof MENTIRA_TIPOS)[number]; invariante: string }[];
  correccion: string;
  controles: string[];
  datosLimpios: string | null;
}

export const lines = ["corte"] as const;

const SQL = ["sql"];

export function pasosOf(sql: string): { id: string; sql: string }[] | string {
  const out: { id: string; lines: string[] }[] = [];
  for (const line of sql.split(/\r?\n/)) {
    const m = line.trim().match(/^--\s*paso:\s*(\S+)\s*$/);
    if (m) out.push({ id: m[1]!, lines: [] });
    else if (out.length) out[out.length - 1]!.lines.push(line);
    else if (line.trim() && !line.trim().startsWith("--")) return "### Pipeline: hay SQL antes del primer -- paso:";
  }
  if (out.length === 0) return "### Pipeline necesita pasos -- paso: <id>";
  const ids = new Set<string>();
  for (const p of out) {
    if (ids.has(p.id)) return `### Pipeline: paso repetido «${p.id}»`;
    ids.add(p.id);
  }
  return out.map((p) => ({ id: p.id, sql: p.lines.join("\n") }));
}

export function parse(b: ForgeBlock): SchemaResult<ForenseData> {
  if (!isIsoInstant(b.lines.corte)) return fail("corte: debe ser un instante ISO fijo (por ejemplo 2026-11-01T00:00:00Z)");
  const esquema = codeFence(getSection(b, "esquema"), SQL);
  if (!esquema) return fail("falta ### Esquema (cerca sql)");
  const datos = codeFence(getSection(b, "datos"), SQL);
  if (!datos) return fail("falta ### Datos (cerca sql)");
  const pipeSql = codeFence(getSection(b, "pipeline"), SQL);
  if (!pipeSql) return fail("falta ### Pipeline (cerca sql)");
  const pasos = pasosOf(pipeSql);
  if (typeof pasos === "string") return fail(pasos);
  const inv = jsonFence(getSection(b, "invariantes"));
  if (isNoJson(inv) || !Array.isArray(inv) || inv.length === 0) return fail("falta ### Invariantes (cerca json)");
  const ei = eachObj(inv, "### Invariantes", (o) => {
    if (!isStr(o.id) || !isStr(o.sobre)) return "necesita id y sobre";
    if (!(INVARIANTE_TIPOS as readonly unknown[]).includes(o.tipo)) return "tipo debe ser conteo, unicidad, frescura, nulos o suma";
    if (o.columnas !== undefined && !isStrArr(o.columnas)) return "columnas debe ser una lista";
    if (o.tolerancia !== undefined && typeof o.tolerancia !== "number") return "tolerancia debe ser numérica";
    return null;
  });
  if (ei) return fail(ei);
  const men = jsonFence(getSection(b, "mentiras"));
  if (isNoJson(men) || !Array.isArray(men) || men.length === 0) return fail("falta ### Mentiras (cerca json)");
  const em = eachObj(men, "### Mentiras", (o) => {
    if (!isStr(o.id) || !isStr(o.paso) || !isStr(o.invariante)) return "necesita id, paso e invariante";
    if (!(MENTIRA_TIPOS as readonly unknown[]).includes(o.tipo)) return "tipo debe ser join-multiplica, fuente-vieja, dedupe-pierde o nulos-cuentan";
    return null;
  });
  if (em) return fail(em);
  const correccion = codeFence(getSection(b, "correccion"), SQL);
  if (!correccion) return fail("falta ### Corrección (cerca sql)");
  const controles = codeFences(getSection(b, "control de referencia"), SQL).filter((c) => c.trim());
  if (controles.length === 0) return fail("falta ### Control de referencia (una cerca sql por mentira)");
  const dlSec = getSection(b, "datos limpios");
  const datosLimpios = dlSec ? codeFence(dlSec, SQL) : null;
  if (dlSec && !datosLimpios) return fail("### Datos limpios debe traer una cerca sql");
  return okData({
    corte: b.lines.corte!,
    esquema,
    datos,
    pipeline: { sql: pipeSql, pasos },
    invariantes: inv as ForenseData["invariantes"],
    mentiras: men as ForenseData["mentiras"],
    correccion,
    controles,
    datosLimpios,
  });
}
