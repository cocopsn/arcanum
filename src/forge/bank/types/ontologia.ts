import {
  eachObj,
  fail,
  getSection,
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

// l · ontologia (Ontology Forge, §9.3 l). Schema only: ### Decisiones (JSON [{ id, texto }], ≥ 2); ### Fuentes
// (optional JSON [{ id, nombre, columnas }]); ### Exigencias (optional JSON object); ### Referencia (JSON with the
// author's model, same schema as the learner's); ### Rúbrica. The structural verifier is the owner's (e1-modelos,
// eval/ontology.ts). `parseOntologyModel` is the frozen shape of OntologyModel (also usable on a learner's model).

export const PROPIEDAD_TIPOS = ["texto", "entero", "decimal", "fecha", "booleano"] as const;
export const CARDINALIDADES = ["1:1", "1:N", "N:1", "N:N"] as const;

export interface OntologyModel {
  objetos: {
    id: string;
    nombre: string;
    llave: string;
    justifica: string[];
    fuente?: string;
    implementa?: string[];
    propiedades: { id: string; nombre: string; tipo: (typeof PROPIEDAD_TIPOS)[number]; requerido: boolean }[];
  }[];
  interfaces?: { id: string; nombre: string; propiedades: { nombre: string; tipo: string }[] }[];
  links: { id: string; nombre: string; de: string; a: string; cardinalidad: (typeof CARDINALIDADES)[number]; justifica?: string[] }[];
  acciones: {
    id: string;
    nombre: string;
    objeto: string;
    precondiciones: string[];
    efectos: string[];
    justifica: string[];
    parametros: { id: string; nombre: string; tipo: string; requerido: boolean }[];
  }[];
}

export const ONTOLOGY_LIMITS = { objetos: 40, links: 60, acciones: 30, propiedades: 40, bytes: 30 * 1024 };

export interface OntologiaData {
  decisiones: { id: string; texto: string }[];
  fuentes: { id: string; nombre: string; columnas: string[] }[] | null;
  exigencias: Record<string, unknown> | null;
  referencia: OntologyModel;
  rubrica: string[];
}

export const lines = [] as const;

/** Shape of an OntologyModel (structure only; the verifier's findings are another matter). Error text or the model. */
export function parseOntologyModel(v: unknown): OntologyModel | string {
  if (!isObj(v)) return "el modelo debe ser un objeto JSON";
  if (JSON.stringify(v).length > ONTOLOGY_LIMITS.bytes) return "el modelo pasa de 30 KB";
  if (!Array.isArray(v.objetos) || !Array.isArray(v.links) || !Array.isArray(v.acciones)) return "el modelo necesita objetos, links y acciones";
  if (v.objetos.length > ONTOLOGY_LIMITS.objetos) return `como máximo ${ONTOLOGY_LIMITS.objetos} objetos`;
  if (v.links.length > ONTOLOGY_LIMITS.links) return `como máximo ${ONTOLOGY_LIMITS.links} links`;
  if (v.acciones.length > ONTOLOGY_LIMITS.acciones) return `como máximo ${ONTOLOGY_LIMITS.acciones} acciones`;
  const eo = eachObj(v.objetos, "objetos", (o) => {
    if (!isStr(o.id) || !isStr(o.nombre) || typeof o.llave !== "string") return "necesita id, nombre y llave";
    if (!isStrArr(o.justifica)) return "justifica debe ser una lista de ids";
    if (o.fuente !== undefined && typeof o.fuente !== "string") return "fuente debe ser texto";
    if (o.implementa !== undefined && !isStrArr(o.implementa)) return "implementa debe ser una lista";
    if (!Array.isArray(o.propiedades) || o.propiedades.length > ONTOLOGY_LIMITS.propiedades) return `propiedades: lista de hasta ${ONTOLOGY_LIMITS.propiedades}`;
    return eachObj(o.propiedades, "propiedades", (p) =>
      isStr(p.id) && isStr(p.nombre) && (PROPIEDAD_TIPOS as readonly unknown[]).includes(p.tipo) && typeof p.requerido === "boolean"
        ? null
        : "necesita id, nombre, tipo (texto|entero|decimal|fecha|booleano) y requerido",
    );
  });
  if (eo) return eo;
  if (v.interfaces !== undefined) {
    const ei = eachObj(v.interfaces, "interfaces", (i) => {
      if (!isStr(i.id) || !isStr(i.nombre) || !Array.isArray(i.propiedades)) return "necesita id, nombre y propiedades";
      return eachObj(i.propiedades, "propiedades", (p) => (isStr(p.nombre) && isStr(p.tipo) ? null : "necesita nombre y tipo"));
    });
    if (ei) return ei;
  }
  const el = eachObj(v.links, "links", (l) => {
    if (!isStr(l.id) || !isStr(l.nombre) || typeof l.de !== "string" || typeof l.a !== "string") return "necesita id, nombre, de y a";
    if (typeof l.cardinalidad !== "string") return "necesita cardinalidad";
    if (l.justifica !== undefined && !isStrArr(l.justifica)) return "justifica debe ser una lista";
    return null;
  });
  if (el) return el;
  const ea = eachObj(v.acciones, "acciones", (a) => {
    if (!isStr(a.id) || !isStr(a.nombre) || typeof a.objeto !== "string") return "necesita id, nombre y objeto";
    if (!isStrArr(a.precondiciones) || !isStrArr(a.efectos) || !isStrArr(a.justifica)) return "precondiciones, efectos y justifica deben ser listas";
    if (!Array.isArray(a.parametros)) return "parametros debe ser una lista";
    return eachObj(a.parametros, "parametros", (p) =>
      typeof p.id === "string" && typeof p.nombre === "string" && typeof p.tipo === "string" && typeof p.requerido === "boolean" ? null : "necesita id, nombre, tipo y requerido",
    );
  });
  if (ea) return ea;
  return v as unknown as OntologyModel;
}

export function parse(b: ForgeBlock): SchemaResult<OntologiaData> {
  const dec = jsonFence(getSection(b, "decisiones"));
  if (isNoJson(dec) || !Array.isArray(dec)) return fail("falta ### Decisiones (cerca json)");
  if (dec.length < 2) return fail("### Decisiones necesita al menos 2 decisiones");
  const ed = eachObj(dec, "### Decisiones", (o) => (isStr(o.id) && isStr(o.texto) ? null : "necesita id y texto"));
  if (ed) return fail(ed);
  let fuentes: OntologiaData["fuentes"] = null;
  const fSec = getSection(b, "fuentes");
  if (fSec) {
    const f = jsonFence(fSec);
    if (isNoJson(f) || !Array.isArray(f)) return fail("### Fuentes debe ser una cerca json con una lista");
    const ef = eachObj(f, "### Fuentes", (o) => (isStr(o.id) && isStr(o.nombre) && isStrArr(o.columnas) ? null : "necesita id, nombre y columnas"));
    if (ef) return fail(ef);
    fuentes = f as OntologiaData["fuentes"];
  }
  let exigencias: Record<string, unknown> | null = null;
  const eSec = getSection(b, "exigencias");
  if (eSec) {
    const e = jsonFence(eSec);
    if (isNoJson(e) || !isObj(e)) return fail("### Exigencias debe ser una cerca json con un objeto");
    exigencias = e;
  }
  const ref = jsonFence(getSection(b, "referencia"));
  if (isNoJson(ref)) return fail("falta ### Referencia (cerca json con el modelo)");
  const referencia = parseOntologyModel(ref);
  if (typeof referencia === "string") return fail(`### Referencia: ${referencia}`);
  const rubrica = rubricOf(getSection(b, "rubrica"));
  if (rubrica.length === 0) return fail("falta ### Rúbrica");
  return okData({ decisiones: dec as OntologiaData["decisiones"], fuentes, exigencias, referencia, rubrica });
}
