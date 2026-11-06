import {
  eachObj,
  fail,
  getSection,
  isNoJson,
  isStr,
  jsonFence,
  norm,
  okData,
  rubricOf,
  sectionText,
  type ForgeBlock,
  type SchemaResult,
} from "./_shared";

// g · entrevista (§9.3 g). Schema only: `fases: preguntas 10, estructuracion 10, defensa 10` (visible minutes);
// the statement is the visible brief; ### Personas (JSON [{ id, nombre, rol, estilo }]); ### Hechos (JSON [{ id,
// persona, texto, oculto, revela_si }], ≤ 30, texto ≤ 400); ### Entregable; ### Rúbrica. There is NO
// ### Variación: the constraint that changes in the defense is the bank's `giro` (type j), so a cell never has two
// twists. A block that brings one is rejected.

export interface EntrevistaData {
  fases: { preguntas: number; estructuracion: number; defensa: number };
  personas: { id: string; nombre: string; rol: string; estilo: string }[];
  hechos: { id: string; persona: string; texto: string; oculto: boolean; revela_si: string }[];
  entregable: string;
  rubrica: string[];
}

export const lines = ["fases"] as const;

export const VARIACION_RECHAZO = "la variación de una entrevista es el giro del banco (tipo j)";
export const MAX_HECHOS = 30;
export const MAX_TEXTO_HECHO = 400;

const FASES = ["preguntas", "estructuracion", "defensa"] as const;

export function parse(b: ForgeBlock): SchemaResult<EntrevistaData> {
  if (getSection(b, "variacion")) return fail(VARIACION_RECHAZO);
  if (b.lines.fases === undefined) return fail("falta la línea fases: preguntas N, estructuracion N, defensa N");
  const parts = b.lines.fases.split(",").map((p) => norm(p));
  if (parts.length !== 3) return fail("fases: deben ser preguntas, estructuracion y defensa, en ese orden");
  const fases = { preguntas: 0, estructuracion: 0, defensa: 0 };
  for (let i = 0; i < 3; i++) {
    const m = parts[i]!.match(/^([a-z]+)\s+(\d+)$/);
    if (!m || m[1] !== FASES[i] || parseInt(m[2]!, 10) <= 0) return fail("fases: deben ser preguntas N, estructuracion N, defensa N (minutos > 0)");
    fases[FASES[i]!] = parseInt(m[2]!, 10);
  }
  const personas = jsonFence(getSection(b, "personas"));
  if (isNoJson(personas) || !Array.isArray(personas) || personas.length === 0) return fail("falta ### Personas (cerca json con al menos una persona)");
  const ep = eachObj(personas, "### Personas", (o) => (isStr(o.id) && isStr(o.nombre) && isStr(o.rol) && isStr(o.estilo) ? null : "necesita id, nombre, rol y estilo"));
  if (ep) return fail(ep);
  const hechos = jsonFence(getSection(b, "hechos"));
  if (isNoJson(hechos) || !Array.isArray(hechos) || hechos.length === 0) return fail("falta ### Hechos (cerca json con al menos un hecho)");
  if (hechos.length > MAX_HECHOS) return fail(`### Hechos: como máximo ${MAX_HECHOS}`);
  const eh = eachObj(hechos, "### Hechos", (o) => {
    if (!isStr(o.id) || !isStr(o.persona) || !isStr(o.texto)) return "necesita id, persona y texto";
    if ((o.texto as string).length > MAX_TEXTO_HECHO) return `texto de más de ${MAX_TEXTO_HECHO} caracteres`;
    if (typeof o.oculto !== "boolean") return "oculto debe ser booleano";
    if (o.oculto && !isStr(o.revela_si)) return "un hecho oculto necesita revela_si";
    if (o.revela_si !== undefined && typeof o.revela_si !== "string") return "revela_si debe ser texto";
    return null;
  });
  if (eh) return fail(eh);
  const entregable = sectionText(getSection(b, "entregable"));
  if (!entregable) return fail("falta ### Entregable");
  const rubrica = rubricOf(getSection(b, "rubrica"));
  if (rubrica.length === 0) return fail("falta ### Rúbrica");
  return okData({
    fases,
    personas: personas as EntrevistaData["personas"],
    hechos: (hechos as Record<string, unknown>[]).map((h) => ({
      id: h.id as string,
      persona: h.persona as string,
      texto: h.texto as string,
      oculto: h.oculto as boolean,
      revela_si: typeof h.revela_si === "string" ? h.revela_si : "",
    })),
    entregable,
    rubrica,
  });
}
