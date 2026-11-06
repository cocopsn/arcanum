import {
  eachObj,
  fail,
  getSection,
  isInt,
  isNoJson,
  isObj,
  isStr,
  isStrArr,
  jsonFence,
  okData,
  rubricOf,
  type ForgeBlock,
  type SchemaResult,
} from "./_shared";

// p · gameday (§9.3 p). Schema only: ### Línea de tiempo (JSON [{ t, tipo, fuente, texto, valor? }], ≤ 200);
// ### Causas (JSON [{ id, texto }]); ### Acciones (JSON [{ id, texto, tipo }]); ### Clave (JSON { causa,
// evidencia, acciones_validas, acciones_peligrosas }, reserved); ### Rúbrica (for the communication). The
// cross-checks are the real ingestion check in check/gameday.ts.

export const EVENTO_TIPOS = ["alerta", "log", "metrica", "despliegue", "cambio"] as const;
export const ACCION_TIPOS = ["rollback", "compensacion", "mitigacion", "esperar"] as const;
export const MAX_EVENTOS = 200;

export interface GamedayData {
  linea: { t: string | number; tipo: (typeof EVENTO_TIPOS)[number]; fuente: string; texto: string; valor?: unknown }[];
  causas: { id: string; texto: string }[];
  acciones: { id: string; texto: string; tipo: (typeof ACCION_TIPOS)[number] }[];
  clave: { causa: string; evidencia: number[]; acciones_validas: string[]; acciones_peligrosas: string[] };
  rubrica: string[];
}

export const lines = [] as const;

export function parse(b: ForgeBlock): SchemaResult<GamedayData> {
  const linea = jsonFence(getSection(b, "linea de tiempo"));
  if (isNoJson(linea) || !Array.isArray(linea) || linea.length === 0) return fail("falta ### Línea de tiempo (cerca json)");
  if (linea.length > MAX_EVENTOS) return fail(`### Línea de tiempo: como máximo ${MAX_EVENTOS} eventos`);
  const el = eachObj(linea, "### Línea de tiempo", (o) => {
    if (!(typeof o.t === "string" || typeof o.t === "number")) return "necesita t";
    if (!(EVENTO_TIPOS as readonly unknown[]).includes(o.tipo)) return "tipo debe ser alerta, log, metrica, despliegue o cambio";
    return isStr(o.fuente) && isStr(o.texto) ? null : "necesita fuente y texto";
  });
  if (el) return fail(el);
  const causas = jsonFence(getSection(b, "causas"));
  if (isNoJson(causas) || !Array.isArray(causas) || causas.length === 0) return fail("falta ### Causas (cerca json)");
  const ec = eachObj(causas, "### Causas", (o) => (isStr(o.id) && isStr(o.texto) ? null : "necesita id y texto"));
  if (ec) return fail(ec);
  const acciones = jsonFence(getSection(b, "acciones"));
  if (isNoJson(acciones) || !Array.isArray(acciones) || acciones.length === 0) return fail("falta ### Acciones (cerca json)");
  const ea = eachObj(acciones, "### Acciones", (o) =>
    isStr(o.id) && isStr(o.texto) && (ACCION_TIPOS as readonly unknown[]).includes(o.tipo) ? null : "necesita id, texto y tipo (rollback|compensacion|mitigacion|esperar)",
  );
  if (ea) return fail(ea);
  const clave = jsonFence(getSection(b, "clave"));
  if (isNoJson(clave) || !isObj(clave)) return fail("falta ### Clave (cerca json)");
  if (!isStr(clave.causa) || !Array.isArray(clave.evidencia) || !clave.evidencia.every(isInt) || !isStrArr(clave.acciones_validas) || !isStrArr(clave.acciones_peligrosas)) {
    return fail("### Clave necesita causa, evidencia (índices), acciones_validas y acciones_peligrosas");
  }
  const rubrica = rubricOf(getSection(b, "rubrica"));
  if (rubrica.length === 0) return fail("falta ### Rúbrica");
  return okData({
    linea: linea as GamedayData["linea"],
    causas: causas as GamedayData["causas"],
    acciones: acciones as GamedayData["acciones"],
    clave: clave as unknown as GamedayData["clave"],
    rubrica,
  });
}
