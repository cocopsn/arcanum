import {
  eachObj,
  fail,
  getSection,
  isInt,
  isIsoInstant,
  isNoJson,
  isObj,
  isStr,
  isStrArr,
  jsonFence,
  okData,
  type ForgeBlock,
  type SchemaResult,
} from "./_shared";

// o · recuperacion (retrieval with abstention, §9.3 o). Schema only: `corte:` (fixed ISO instant for «vencido»);
// ### Corpus (JSON [{ id, titulo, fecha, vigente_hasta?, texto }], ≤ 40, texto ≤ 4,000); ### Preguntas (JSON
// [{ id, pregunta }]); ### Clave (JSON, reserved); ### Contradicciones (JSON [[docA, docB]]); ### Inyección (JSON
// { doc, inicio, fin, obediencia }). The cross-checks are the real ingestion check in check/recuperacion.ts.

export type Span = { doc: string; inicio: number; fin: number };

export interface RecuperacionData {
  corte: string;
  corpus: { id: string; titulo: string; fecha: string; vigente_hasta?: string; texto: string }[];
  preguntas: { id: string; pregunta: string }[];
  clave: Record<string, { abstenerse: true } | { spans: Span[] }>;
  contradicciones: [string, string][];
  inyeccion: Span & { obediencia: string[] };
}

export const lines = ["corte"] as const;

export const MAX_DOCS = 40;
export const MAX_TEXTO_DOC = 4000;

const isSpan = (s: unknown): s is Span => isObj(s) && isStr(s.doc) && isInt(s.inicio) && isInt(s.fin);

export function parse(b: ForgeBlock): SchemaResult<RecuperacionData> {
  if (!isIsoInstant(b.lines.corte)) return fail("corte: debe ser un instante ISO fijo");
  const corpus = jsonFence(getSection(b, "corpus"));
  if (isNoJson(corpus) || !Array.isArray(corpus) || corpus.length === 0) return fail("falta ### Corpus (cerca json)");
  if (corpus.length > MAX_DOCS) return fail(`### Corpus: como máximo ${MAX_DOCS} documentos`);
  const ec = eachObj(corpus, "### Corpus", (o) => {
    if (!isStr(o.id) || !isStr(o.titulo) || !isStr(o.fecha) || !isStr(o.texto)) return "necesita id, titulo, fecha y texto";
    if ((o.texto as string).length > MAX_TEXTO_DOC) return `texto de más de ${MAX_TEXTO_DOC} caracteres`;
    if (o.vigente_hasta !== undefined && !isStr(o.vigente_hasta)) return "vigente_hasta debe ser una fecha";
    return null;
  });
  if (ec) return fail(ec);
  const preg = jsonFence(getSection(b, "preguntas"));
  if (isNoJson(preg) || !Array.isArray(preg) || preg.length === 0) return fail("falta ### Preguntas (cerca json)");
  const ep = eachObj(preg, "### Preguntas", (o) => (isStr(o.id) && isStr(o.pregunta) ? null : "necesita id y pregunta"));
  if (ep) return fail(ep);
  const clave = jsonFence(getSection(b, "clave"));
  if (isNoJson(clave) || !isObj(clave)) return fail("falta ### Clave (cerca json)");
  for (const [k, v] of Object.entries(clave)) {
    if (!isObj(v)) return fail(`### Clave: «${k}» debe ser { abstenerse: true } o { spans: [...] }`);
    if (v.abstenerse === true) continue;
    if (!Array.isArray(v.spans) || v.spans.length === 0 || !v.spans.every(isSpan)) return fail(`### Clave: «${k}» necesita spans [{ doc, inicio, fin }]`);
  }
  const con = jsonFence(getSection(b, "contradicciones"));
  if (isNoJson(con) || !Array.isArray(con)) return fail("falta ### Contradicciones (cerca json [[docA, docB]])");
  if (!con.every((p) => Array.isArray(p) && p.length === 2 && isStr(p[0]) && isStr(p[1]))) return fail("### Contradicciones: cada par es [docA, docB]");
  const iny = jsonFence(getSection(b, "inyeccion"));
  if (isNoJson(iny) || !isSpan(iny) || !isStrArr((iny as Record<string, unknown>).obediencia)) {
    return fail("falta ### Inyección (cerca json { doc, inicio, fin, obediencia: [...] })");
  }
  return okData({
    corte: b.lines.corte!,
    corpus: corpus as RecuperacionData["corpus"],
    preguntas: preg as RecuperacionData["preguntas"],
    clave: clave as RecuperacionData["clave"],
    contradicciones: con as [string, string][],
    inyeccion: iny as RecuperacionData["inyeccion"],
  });
}
