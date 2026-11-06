import { evaluatePermission, isDerived } from "@/forge/eval/permissions";
import { duplicates, structuralCheck } from "./_structural";

// REAL ingestion check of `permisos` (design §9.3 n). Nothing executes (D8): it crosses data of the block. Ids that
// exist; no cycles in deriva_de / de; ≥ 2 questions whose answer is «denegado» and ≥ 1 over a derived resource; and
// ### Solución matches THE EVALUATOR on every question (otherwise the bank is rejected naming the question).
export const check = structuralCheck("permisos", (item) => {
  const { modelo, preguntas, solucion } = item.data;
  const out: string[] = [];
  const users = new Set(modelo.usuarios.map((u) => u.id));
  const groups = new Set(modelo.grupos.map((g) => g.id));
  const roles = new Set(modelo.roles.map((r) => r.id));
  const markings = new Set(modelo.markings.map((m) => m.id));
  const recursos = new Map(modelo.recursos.map((r) => [r.id, r]));
  for (const [what, ids] of [
    ["usuario", modelo.usuarios.map((u) => u.id)],
    ["grupo", modelo.grupos.map((g) => g.id)],
    ["rol", modelo.roles.map((r) => r.id)],
    ["marking", modelo.markings.map((m) => m.id)],
    ["recurso", modelo.recursos.map((r) => r.id)],
    ["pregunta", preguntas.map((p) => p.id)],
  ] as const) {
    for (const id of duplicates([...ids])) out.push(`id de ${what} repetido «${id}»`);
  }
  for (const u of modelo.usuarios) for (const g of u.grupos) if (!groups.has(g)) out.push(`el usuario «${u.id}» está en el grupo «${g}», que no existe`);
  for (const m of modelo.markings) for (const p of m.miembros) if (!users.has(p) && !groups.has(p)) out.push(`el marking «${m.id}» tiene el miembro «${p}», que no es usuario ni grupo`);
  for (const r of modelo.recursos) {
    if (r.de !== undefined && !recursos.has(r.de)) out.push(`el recurso «${r.id}» tiene como padre «${r.de}», que no existe`);
    for (const d of r.deriva_de ?? []) if (!recursos.has(d)) out.push(`el recurso «${r.id}» deriva de «${d}», que no existe`);
    for (const m of r.markings) if (!markings.has(m)) out.push(`el recurso «${r.id}» lleva el marking «${m}», que no existe`);
    for (const a of r.acceso) {
      if (!users.has(a.principal) && !groups.has(a.principal)) out.push(`el acceso de «${r.id}» nombra a «${a.principal}», que no es usuario ni grupo`);
      if (!roles.has(a.rol)) out.push(`el acceso de «${r.id}» usa el rol «${a.rol}», que no existe`);
    }
  }
  // cycles over de ∪ deriva_de (DFS with colors)
  const color = new Map<string, 0 | 1 | 2>();
  const cyc = (id: string): boolean => {
    const c = color.get(id) ?? 0;
    if (c === 1) return true;
    if (c === 2) return false;
    color.set(id, 1);
    const r = recursos.get(id);
    const next = r ? [...(r.de ? [r.de] : []), ...(r.deriva_de ?? [])] : [];
    for (const n of next) if (recursos.has(n) && cyc(n)) return true;
    color.set(id, 2);
    return false;
  };
  for (const id of recursos.keys()) if (cyc(id)) {
    out.push(`hay un ciclo de derivación que pasa por «${id}»`);
    break;
  }
  if (out.length) return out;
  for (const q of preguntas) {
    if (!users.has(q.usuario)) out.push(`la pregunta «${q.id}» nombra al usuario «${q.usuario}», que no existe`);
    if (!recursos.has(q.recurso)) out.push(`la pregunta «${q.id}» nombra el recurso «${q.recurso}», que no existe`);
  }
  const qids = new Set(preguntas.map((q) => q.id));
  for (const k of Object.keys(solucion)) if (!qids.has(k)) out.push(`### Solución responde «${k}», que no es una pregunta`);
  if (out.length) return out;
  let denegadas = 0;
  for (const q of preguntas) {
    const ev = evaluatePermission(modelo, q);
    if (!ev.permitido) denegadas++;
    if (typeof solucion[q.id] !== "boolean") out.push(`### Solución no responde la pregunta «${q.id}»`);
    else if (solucion[q.id] !== ev.permitido) out.push(`### Solución contradice al evaluador en «${q.id}»: el evaluador dice ${ev.razon}`);
  }
  if (denegadas < 2) out.push(`necesita al menos 2 preguntas con respuesta «denegado» (hay ${denegadas})`);
  if (!preguntas.some((q) => { const r = recursos.get(q.recurso); return !!r && isDerived(r); })) out.push("necesita al menos 1 pregunta sobre un recurso derivado por join, función o exportación");
  return out;
});
