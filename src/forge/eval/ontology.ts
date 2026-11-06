import { CARDINALIDADES, type OntologyModel } from "@/forge/bank/types/ontologia";

// STRUCTURAL VERIFIER of Ontology Forge (design §9.3 l). PURE and over data: it never executes anything of the
// learner or of the author, so it runs on the main thread (§9.2) with the limits of parseOntologyModel. It returns the
// structural findings of a model against the brief of its item (decisions, sources and the author's requirements).
// `correcto` = zero findings. The same function validates the author's reference at ingestion (check/ontologia.ts).

export type OntologyFindingCode =
  | "llave-ausente"
  | "llave-invalida"
  | "cardinalidad-invalida"
  | "link-roto"
  | "link-duplicado"
  | "sin-justificacion"
  | "decision-sin-cubrir"
  | "huerfano"
  | "tabla-renombrada"
  | "accion-sin-precondicion"
  | "parametro-invalido"
  | "accion-sin-objeto"
  | "interfaz-incompleta"
  | "exigencia-faltante";

export interface OntologyFinding {
  codigo: OntologyFindingCode;
  /** id of the element the finding points to (object, link, action, decision or `exigencia:<n>`) */
  elemento: string;
  mensaje: string;
}

export interface OntologyBrief {
  decisiones: { id: string; texto: string }[];
  fuentes?: { id: string; nombre: string; columnas: string[] }[] | null;
  exigencias?: Record<string, unknown> | null;
}

/** Name normalization: lowercase, no accents, only letters and digits («Cita_ID» = «citaid»). */
export function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const KEY_TYPES = new Set(["texto", "entero"]);
const nonEmpty = (xs: string[] | undefined) => (xs ?? []).some((x) => typeof x === "string" && x.trim().length > 0);

/** Find an object by id or by (normalized) name. */
function findObject(model: OntologyModel, ref: string) {
  const n = normName(ref);
  return model.objetos.find((o) => o.id === ref) ?? model.objetos.find((o) => normName(o.nombre) === n);
}

function requirementFindings(model: OntologyModel, exigencias: Record<string, unknown>): OntologyFinding[] {
  const out: OntologyFinding[] = [];
  let n = 0;
  const miss = (texto: string) => out.push({ codigo: "exigencia-faltante", elemento: `exigencia:${n}`, mensaje: `Falta lo que el brief exige: ${texto}.` });
  const list = (k: string): unknown[] => (Array.isArray(exigencias[k]) ? (exigencias[k] as unknown[]) : []);
  for (const o of list("objetos")) {
    n++;
    const ref = typeof o === "string" ? o : o && typeof o === "object" && typeof (o as { nombre?: unknown }).nombre === "string" ? (o as { nombre: string }).nombre : "";
    if (!ref || !findObject(model, ref)) miss(`el objeto «${ref}»`);
  }
  for (const l of list("links")) {
    n++;
    const x = (l ?? {}) as { de?: unknown; a?: unknown; cardinalidad?: unknown; nombre?: unknown };
    const de = typeof x.de === "string" ? findObject(model, x.de) : undefined;
    const a = typeof x.a === "string" ? findObject(model, x.a) : undefined;
    const card = typeof x.cardinalidad === "string" ? x.cardinalidad : undefined;
    const ok =
      !!de &&
      !!a &&
      model.links.some((k) => {
        const forward = k.de === de.id && k.a === a.id && (card === undefined || k.cardinalidad === card);
        const backward = k.de === a.id && k.a === de.id && (card === undefined || k.cardinalidad === flip(card));
        return (forward || backward) && (typeof x.nombre !== "string" || normName(k.nombre) === normName(x.nombre));
      });
    if (!ok) miss(`el link ${String(x.de)} → ${String(x.a)}${x.cardinalidad ? ` (${String(x.cardinalidad)})` : ""}`);
  }
  for (const a of list("acciones")) {
    n++;
    const x = typeof a === "string" ? { nombre: a } : ((a ?? {}) as { nombre?: unknown; objeto?: unknown });
    const nombre = typeof x.nombre === "string" ? x.nombre : "";
    const obj = typeof x.objeto === "string" ? findObject(model, x.objeto) : undefined;
    const ok = !!nombre && model.acciones.some((k) => normName(k.nombre) === normName(nombre) && (x.objeto === undefined || (!!obj && k.objeto === obj.id)));
    if (!ok) miss(`la acción «${nombre}»`);
  }
  for (const p of list("propiedades")) {
    n++;
    const x = (p ?? {}) as { objeto?: unknown; nombre?: unknown; propiedad?: unknown; tipo?: unknown; requerido?: unknown };
    const pname = typeof x.propiedad === "string" ? x.propiedad : typeof x.nombre === "string" ? x.nombre : "";
    const obj = typeof x.objeto === "string" ? findObject(model, x.objeto) : undefined;
    const prop = obj?.propiedades.find((q) => normName(q.nombre) === normName(pname) || q.id === pname);
    const ok = !!prop && (x.tipo === undefined || prop.tipo === x.tipo) && (x.requerido === undefined || prop.requerido === x.requerido);
    if (!ok) miss(`la propiedad «${pname}» en «${String(x.objeto)}»`);
  }
  for (const i of list("interfaces")) {
    n++;
    const ref = typeof i === "string" ? i : i && typeof i === "object" && typeof (i as { nombre?: unknown }).nombre === "string" ? (i as { nombre: string }).nombre : "";
    const ok = !!ref && (model.interfaces ?? []).some((k) => k.id === ref || normName(k.nombre) === normName(ref));
    if (!ok) miss(`la interfaz «${ref}»`);
  }
  return out;
}

/** The cardinality seen from the other end (N:1 read backwards is 1:N). */
export function flip(c: string): string {
  const [a, b] = c.split(":");
  return `${b}:${a}`;
}

/** Verify an OntologyModel against its brief. Zero findings = structurally correct. */
export function verifyOntology(model: OntologyModel, brief: OntologyBrief): OntologyFinding[] {
  const out: OntologyFinding[] = [];
  const push = (codigo: OntologyFindingCode, elemento: string, mensaje: string) => out.push({ codigo, elemento, mensaje });
  const decisionIds = new Set(brief.decisiones.map((d) => d.id));
  const objectIds = new Set(model.objetos.map((o) => o.id));
  const justifiedActions = new Set(model.acciones.filter((a) => a.justifica.some((j) => decisionIds.has(j))).map((a) => a.id));
  const fuentes = brief.fuentes ?? [];

  for (const o of model.objetos) {
    const label = o.nombre || o.id;
    if (!o.llave || !o.llave.trim()) push("llave-ausente", o.id, `«${label}» no declara su llave primaria.`);
    else {
      const k = o.propiedades.find((p) => p.id === o.llave) ?? o.propiedades.find((p) => normName(p.nombre) === normName(o.llave));
      if (!k) push("llave-invalida", o.id, `La llave «${o.llave}» de «${label}» no es una de sus propiedades.`);
      else if (!k.requerido || !KEY_TYPES.has(k.tipo)) push("llave-invalida", o.id, `La llave «${k.nombre}» de «${label}» debe ser requerida y de tipo texto o entero.`);
    }
    if (!o.justifica.some((j) => decisionIds.has(j) || justifiedActions.has(j))) {
      push("sin-justificacion", o.id, `«${label}» no cita ninguna decisión del brief (ni una acción que la cite).`);
    }
    const inLink = model.links.some((l) => l.de === o.id || l.a === o.id);
    const inAction = model.acciones.some((a) => a.objeto === o.id);
    if (!inLink && !inAction) push("huerfano", o.id, `«${label}» no está en ningún link ni es el objeto de ninguna acción.`);
    if (o.fuente && !inLink && !inAction) {
      const f = fuentes.find((s) => s.id === o.fuente) ?? fuentes.find((s) => normName(s.nombre) === normName(o.fuente!));
      if (f) {
        const cols = new Set(f.columnas.map(normName));
        const props = new Set(o.propiedades.map((p) => normName(p.nombre)));
        if (cols.size === props.size && [...cols].every((c) => props.has(c))) {
          push("tabla-renombrada", o.id, `«${label}» copia las columnas de la fuente «${f.nombre}» y no participa en ningún link ni acción: es una tabla renombrada, no un objeto.`);
        }
      }
    }
    for (const iid of o.implementa ?? []) {
      const itf = (model.interfaces ?? []).find((i) => i.id === iid);
      if (!itf) {
        push("interfaz-incompleta", o.id, `«${label}» implementa «${iid}», que no existe en el modelo.`);
        continue;
      }
      const falta = itf.propiedades.filter((ip) => !o.propiedades.some((p) => normName(p.nombre) === normName(ip.nombre) && p.tipo === ip.tipo));
      if (falta.length) push("interfaz-incompleta", o.id, `«${label}» implementa «${itf.nombre}» pero le falta ${falta.map((p) => `«${p.nombre}» (${p.tipo})`).join(", ")}.`);
    }
  }

  const seenLinks = new Set<string>();
  for (const l of model.links) {
    const label = l.nombre || l.id;
    if (!(CARDINALIDADES as readonly string[]).includes(l.cardinalidad)) push("cardinalidad-invalida", l.id, `El link «${label}» tiene la cardinalidad «${l.cardinalidad}»; usa 1:1, 1:N, N:1 o N:N.`);
    if (!objectIds.has(l.de) || !objectIds.has(l.a)) push("link-roto", l.id, `El link «${label}» une un extremo que no existe en el modelo.`);
    const sig = `${l.de}\u0000${l.a}\u0000${normName(l.nombre)}`;
    if (seenLinks.has(sig)) push("link-duplicado", l.id, `Hay dos links «${label}» con los mismos extremos.`);
    seenLinks.add(sig);
  }

  for (const a of model.acciones) {
    const label = a.nombre || a.id;
    if (!objectIds.has(a.objeto)) push("accion-sin-objeto", a.id, `La acción «${label}» actúa sobre un objeto que no existe en el modelo.`);
    if (!nonEmpty(a.precondiciones)) push("accion-sin-precondicion", a.id, `La acción «${label}» no tiene ninguna precondición (criterio de envío).`);
    for (const p of a.parametros) {
      if (!p.nombre.trim() || !p.tipo.trim()) push("parametro-invalido", a.id, `Un parámetro de «${label}» no tiene nombre o tipo.`);
    }
    if (!a.justifica.some((j) => decisionIds.has(j))) push("sin-justificacion", a.id, `La acción «${label}» no cita ninguna decisión del brief.`);
  }

  for (const d of brief.decisiones) {
    const covered = model.objetos.some((o) => o.justifica.includes(d.id)) || model.acciones.some((a) => a.justifica.includes(d.id));
    if (!covered) push("decision-sin-cubrir", d.id, `Ningún objeto ni acción cubre la decisión «${d.texto}».`);
  }

  if (brief.exigencias) out.push(...requirementFindings(model, brief.exigencias));
  return out;
}
