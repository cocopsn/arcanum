import type { PermisosData, PermisosModelo } from "@/forge/bank/types/permisos";

// PROPAGATION EVALUATOR of `permisos` (design §9.3 n). PURE, over data. These are the RULES OF THE EXERCISE, not a
// description of the product («Modelo simplificado del ejercicio; contrástalo con [SEC] y [MARK]»). A user may perform
// an operation on a resource when (1) the user or one of their groups holds, in the `acceso` of THAT resource, a role
// that includes the operation, and (2) the user is a member, directly or through a group, of EVERY effective marking of
// the resource. Effective markings = its own ∪ its parent's (`de`) ∪ those of everything it derives from (`deriva_de`),
// transitively. Role access is NOT inherited through derivation: each derivative has its own.

export const PERMISOS_LABEL = "Modelo simplificado del ejercicio; contrástalo con [SEC] y [MARK]";

type Pregunta = PermisosData["preguntas"][number];

export interface EffectiveMarking {
  id: string;
  /** the resource the marking comes from (the resource itself when it is its own) */
  origen: string;
  /** how it arrived: "propio", "padre" (de) or "derivacion" (deriva_de), the first hop from the asked resource */
  via: "propio" | "padre" | "derivacion";
}

export interface PermisoResultado {
  permitido: boolean;
  razon: string;
}

/** Effective markings of a resource, with where each one comes from. Cycle-safe (a visited set). */
export function effectiveMarkings(modelo: PermisosModelo, recursoId: string): EffectiveMarking[] {
  const byId = new Map(modelo.recursos.map((r) => [r.id, r]));
  const out = new Map<string, EffectiveMarking>();
  const seen = new Set<string>();
  const walk = (id: string, via: EffectiveMarking["via"]) => {
    if (seen.has(id)) return;
    seen.add(id);
    const r = byId.get(id);
    if (!r) return;
    for (const m of r.markings) if (!out.has(m)) out.set(m, { id: m, origen: id, via });
    if (r.de) walk(r.de, via === "propio" ? "padre" : via);
    for (const d of r.deriva_de ?? []) walk(d, via === "propio" ? "derivacion" : via);
  };
  walk(recursoId, "propio");
  return [...out.values()];
}

function principalsOf(modelo: PermisosModelo, usuario: string): Set<string> {
  const u = modelo.usuarios.find((x) => x.id === usuario);
  return new Set([usuario, ...(u?.grupos ?? [])]);
}

/** The evaluator's answer for one question, with its reason. */
export function evaluatePermission(modelo: PermisosModelo, q: Pick<Pregunta, "usuario" | "operacion" | "recurso">): PermisoResultado {
  const r = modelo.recursos.find((x) => x.id === q.recurso);
  if (!r) return { permitido: false, razon: `denegado: el recurso «${q.recurso}» no existe en el modelo` };
  const who = principalsOf(modelo, q.usuario);
  const roles = new Map(modelo.roles.map((x) => [x.id, x]));
  const grant = r.acceso.find((a) => who.has(a.principal) && (roles.get(a.rol)?.permisos ?? []).includes(q.operacion));
  if (!grant) {
    const inherited = (r.deriva_de ?? []).length > 0 ? " (el acceso por rol no se hereda por derivación)" : "";
    return { permitido: false, razon: `denegado: ni ${q.usuario} ni sus grupos tienen en «${r.id}» un rol que incluya «${q.operacion}»${inherited}` };
  }
  const markings = new Map(modelo.markings.map((m) => [m.id, m]));
  for (const em of effectiveMarkings(modelo, r.id)) {
    const m = markings.get(em.id);
    const miembros = new Set(m?.miembros ?? []);
    if (![...who].some((p) => miembros.has(p))) {
      const nombre = m?.nombre ?? em.id;
      const how = em.via === "propio" ? "propio del recurso" : em.via === "padre" ? `heredado de «${em.origen}», su objeto padre` : `heredado de «${em.origen}» por la derivación`;
      return { permitido: false, razon: `denegado: ${q.usuario} no es miembro del marking ${nombre} (${how})` };
    }
  }
  const ms = effectiveMarkings(modelo, r.id).map((em) => markings.get(em.id)?.nombre ?? em.id);
  return { permitido: true, razon: `permitido: ${q.usuario} tiene el rol «${grant.rol}» vía ${grant.principal}${ms.length ? ` y es miembro de ${ms.join(", ")}` : ""}` };
}

export interface PermisosCalificacion {
  correcto: boolean;
  aciertos: number;
  total: number;
  porPregunta: { id: string; respuesta: boolean | null; esperado: boolean; ok: boolean; razon: string }[];
}

/** Grade the learner's answers AGAINST THE EVALUATOR (never against the bank's ### Solución). All right = correct. */
export function gradePermisos(data: PermisosData, respuestas: Record<string, boolean | undefined>): PermisosCalificacion {
  const porPregunta = data.preguntas.map((q) => {
    const ev = evaluatePermission(data.modelo, q);
    const respuesta = typeof respuestas[q.id] === "boolean" ? (respuestas[q.id] as boolean) : null;
    return { id: q.id, respuesta, esperado: ev.permitido, ok: respuesta === ev.permitido, razon: ev.razon };
  });
  const aciertos = porPregunta.filter((p) => p.ok).length;
  return { correcto: aciertos === porPregunta.length, aciertos, total: porPregunta.length, porPregunta };
}

/** Is a resource derived (by join, function or export)? Used by the ingestion quota. */
export function isDerived(r: PermisosModelo["recursos"][number]): boolean {
  return (r.deriva_de ?? []).length > 0 || r.tipo === "funcion" || r.tipo === "exportacion";
}
