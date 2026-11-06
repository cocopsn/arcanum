import { eachObj, fail, getSection, isNoJson, isObj, isStr, isStrArr, jsonFence, okData, type ForgeBlock, type SchemaResult } from "./_shared";

// n · permisos (permission matrix and markings, §9.3 n). Schema only: ### Modelo (JSON: usuarios, grupos, roles,
// markings, recursos); ### Preguntas (JSON [{ id, usuario, operacion, recurso }], ≥ 6); ### Solución (JSON
// { preguntaId: boolean }). The propagation evaluator and the cross-checks are the owner's (e1-modelos).

export const OPERACIONES = ["ver", "editar", "ejecutar", "exportar"] as const;
export const RECURSO_TIPOS = ["objeto", "propiedad", "dataset", "funcion", "exportacion"] as const;

export interface PermisosModelo {
  usuarios: { id: string; grupos: string[] }[];
  grupos: { id: string }[];
  roles: { id: string; permisos: (typeof OPERACIONES)[number][] }[];
  markings: { id: string; nombre: string; miembros: string[] }[];
  recursos: {
    id: string;
    tipo: (typeof RECURSO_TIPOS)[number];
    de?: string;
    deriva_de?: string[];
    acceso: { principal: string; rol: string }[];
    markings: string[];
  }[];
}

export interface PermisosData {
  modelo: PermisosModelo;
  preguntas: { id: string; usuario: string; operacion: (typeof OPERACIONES)[number]; recurso: string }[];
  solucion: Record<string, boolean>;
}

export const lines = [] as const;

export function parse(b: ForgeBlock): SchemaResult<PermisosData> {
  const m = jsonFence(getSection(b, "modelo"));
  if (isNoJson(m) || !isObj(m)) return fail("falta ### Modelo (cerca json)");
  const checks: [string, string | null][] = [
    ["usuarios", eachObj(m.usuarios, "usuarios", (o) => (isStr(o.id) && isStrArr(o.grupos) ? null : "necesita id y grupos"))],
    ["grupos", eachObj(m.grupos, "grupos", (o) => (isStr(o.id) ? null : "necesita id"))],
    [
      "roles",
      eachObj(m.roles, "roles", (o) =>
        isStr(o.id) && isStrArr(o.permisos) && o.permisos.every((p) => (OPERACIONES as readonly string[]).includes(p)) ? null : "necesita id y permisos (ver|editar|ejecutar|exportar)",
      ),
    ],
    ["markings", eachObj(m.markings, "markings", (o) => (isStr(o.id) && isStr(o.nombre) && isStrArr(o.miembros) ? null : "necesita id, nombre y miembros"))],
    [
      "recursos",
      eachObj(m.recursos, "recursos", (o) => {
        if (!isStr(o.id) || !(RECURSO_TIPOS as readonly unknown[]).includes(o.tipo)) return "necesita id y tipo (objeto|propiedad|dataset|funcion|exportacion)";
        if (o.de !== undefined && typeof o.de !== "string") return "de debe ser texto";
        if (o.deriva_de !== undefined && !isStrArr(o.deriva_de)) return "deriva_de debe ser una lista";
        if (!isStrArr(o.markings)) return "markings debe ser una lista";
        return eachObj(o.acceso, "acceso", (a) => (isStr(a.principal) && isStr(a.rol) ? null : "necesita principal y rol"));
      }),
    ],
  ];
  for (const [, e] of checks) if (e) return fail(`### Modelo: ${e}`);
  const preg = jsonFence(getSection(b, "preguntas"));
  if (isNoJson(preg) || !Array.isArray(preg)) return fail("falta ### Preguntas (cerca json)");
  if (preg.length < 6) return fail("### Preguntas necesita al menos 6 preguntas");
  const ep = eachObj(preg, "### Preguntas", (o) =>
    isStr(o.id) && isStr(o.usuario) && isStr(o.recurso) && (OPERACIONES as readonly unknown[]).includes(o.operacion) ? null : "necesita id, usuario, operacion y recurso",
  );
  if (ep) return fail(ep);
  const sol = jsonFence(getSection(b, "solucion"));
  if (isNoJson(sol) || !isObj(sol)) return fail("falta ### Solución (cerca json { preguntaId: true | false })");
  for (const [k, v] of Object.entries(sol)) if (typeof v !== "boolean") return fail(`### Solución: «${k}» debe ser true o false`);
  return okData({ modelo: m as unknown as PermisosModelo, preguntas: preg as PermisosData["preguntas"], solucion: sol as Record<string, boolean> });
}
