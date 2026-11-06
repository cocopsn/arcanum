import type { Actores } from "@/forge/bank/types/historial";
import { evalExpr, parseExpr, parseStep, type Expr, type Step } from "./history-dsl";

// c · historial, modo traza: the simulator and the exhaustive enumeration (design §9.3 c). Pure TypeScript over the
// block's data (no eval, no worker): it runs in the main thread with the limits of §16 (≤ 3 actors, ≤ 14 steps,
// ≤ 50,000 feasible interleavings). Writes go straight to the shared state (last writer wins); `validar` false and a
// failed `cas` abort the actor (its later steps do nothing and its locks are released); `commit` releases its locks.
// A step that needs a lock another actor holds makes the history impossible («B1 espera el candado r, tomado por A1»).
// The violation is ALWAYS computed here: the API takes a history (or a protocol) and never the learner's claim.

export const MAX_INTERCALACIONES = 50_000;

export interface Program {
  actors: string[];
  steps: Record<string, Step[]>;
  src: Record<string, string[]>;
}

export const stepId = (actor: string, i: number) => `${actor}${i + 1}`;

/** Compile the actors' steps with the closed grammar. The error names the step (e.g. «A3: paso fuera del lenguaje»). */
export function compileActors(a: Actores): Program | string {
  const actors = Object.keys(a);
  const steps: Record<string, Step[]> = {};
  for (const actor of actors) {
    steps[actor] = [];
    for (let i = 0; i < a[actor]!.length; i++) {
      const s = parseStep(a[actor]![i]!);
      if (typeof s === "string") return `${stepId(actor, i)}: ${s}`;
      steps[actor]!.push(s);
    }
  }
  return { actors, steps, src: a };
}

/** Compile the invariant: a boolean expression over the shared variables only. */
export function compileInvariant(src: string, vars: string[]): Expr | string {
  const e = parseExpr(src.trim());
  if (typeof e === "string") return `invariante: ${e}`;
  const names: string[] = [];
  const walk = (x: Expr): void => {
    if (x.k === "name") names.push(x.n);
    else if (x.k === "bin") {
      walk(x.a);
      walk(x.b);
    }
  };
  walk(e);
  const unknown = names.find((n) => !vars.includes(n));
  if (unknown) return `invariante: «${unknown}» no es una variable del estado`;
  return e;
}

/** «B12» → { actor: "B", idx: 11 } (longest actor-name prefix whose rest is a number). */
export function parseStepId(id: string, actors: string[]): { actor: string; idx: number } | null {
  const hits = actors.filter((a) => id.startsWith(a) && /^\d+$/.test(id.slice(a.length))).sort((x, y) => y.length - x.length);
  const a = hits[0];
  if (!a) return null;
  const n = Number(id.slice(a.length));
  return n >= 1 ? { actor: a, idx: n - 1 } : null;
}

interface Sim {
  state: Record<string, number>;
  regs: Record<string, Record<string, number>>;
  pc: Record<string, number>;
  aborted: Record<string, boolean>;
  /** candado → step id that took it */
  locks: Record<string, { actor: string; by: string }>;
}

const clone = (s: Sim): Sim => ({
  state: { ...s.state },
  regs: Object.fromEntries(Object.entries(s.regs).map(([k, v]) => [k, { ...v }])),
  pc: { ...s.pc },
  aborted: { ...s.aborted },
  locks: { ...s.locks },
});

function initSim(prog: Program, estado: Record<string, number>): Sim {
  return {
    state: { ...estado },
    regs: Object.fromEntries(prog.actors.map((a) => [a, {}])),
    pc: Object.fromEntries(prog.actors.map((a) => [a, 0])),
    aborted: Object.fromEntries(prog.actors.map((a) => [a, false])),
    locks: {},
  };
}

const release = (s: Sim, actor: string) => {
  for (const [c, h] of Object.entries(s.locks)) if (h.actor === actor) delete s.locks[c];
};

const done = (prog: Program, s: Sim, actor: string) => s.aborted[actor] || s.pc[actor]! >= prog.steps[actor]!.length;

/** Apply the next step of `actor` in place. Returns null, or the lock wait that makes it impossible now. */
function apply(prog: Program, s: Sim, actor: string): { espera: string; por: string } | null {
  const i = s.pc[actor]!;
  const step = prog.steps[actor]![i]!;
  const id = stepId(actor, i);
  const regs = s.regs[actor]!;
  const lookup = (n: string) => (n in regs ? regs[n] : s.state[n]);
  const num = (e: Expr) => {
    const v = evalExpr(e, lookup);
    if (typeof v !== "number") throw new Error(`${id}: se esperaba un número`);
    return v;
  };
  switch (step.k) {
    case "leer":
      if (!(step.v in s.state)) throw new Error(`${id}: «${step.v}» no es una variable del estado`);
      regs[step.reg] = s.state[step.v]!;
      break;
    case "escribir":
      if (!(step.v in s.state)) throw new Error(`${id}: «${step.v}» no es una variable del estado`);
      s.state[step.v] = num(step.e);
      break;
    case "validar": {
      const v = evalExpr(step.e, lookup);
      if (typeof v !== "boolean") throw new Error(`${id}: validar necesita una comparación`);
      if (!v) {
        s.aborted[actor] = true;
        release(s, actor);
      }
      break;
    }
    case "bloquear": {
      const h = s.locks[step.c];
      if (h && h.actor !== actor) return { espera: step.c, por: h.by };
      s.locks[step.c] = { actor, by: id };
      break;
    }
    case "liberar":
      if (s.locks[step.c]?.actor === actor) delete s.locks[step.c];
      break;
    case "cas": {
      if (!(step.v in s.state)) throw new Error(`${id}: «${step.v}» no es una variable del estado`);
      if (!(step.reg in regs)) throw new Error(`${id}: el registro «${step.reg}» no está definido`);
      if (s.state[step.v] === regs[step.reg]) s.state[step.v] = num(step.e);
      else {
        s.aborted[actor] = true;
        release(s, actor);
      }
      break;
    }
    case "commit":
      release(s, actor);
      break;
  }
  s.pc[actor] = i + 1;
  return null;
}

function holds(inv: Expr, state: Record<string, number>): boolean {
  const v = evalExpr(inv, (n) => state[n]);
  if (typeof v !== "boolean") throw new Error("el invariante no es una comparación");
  return v;
}

export interface TraceRow {
  paso: string;
  texto: string;
  estado: Record<string, number>;
  nota?: string;
}

export type SimResult =
  | { factible: false; motivo: string }
  | { factible: true; viola: boolean; traza: TraceRow[]; final: Record<string, number> };

/** Run ONE history (step ids in order). It must contain every step of every actor, each once, in each actor's order. */
export function simulateHistory(
  prog: Program,
  estado: Record<string, number>,
  inv: Expr,
  chequeo: "final" | "cada-paso",
  historia: string[],
): SimResult {
  const total = prog.actors.reduce((n, a) => n + prog.steps[a]!.length, 0);
  const s = initSim(prog, estado);
  const seen = new Set<string>();
  const next: Record<string, number> = Object.fromEntries(prog.actors.map((a) => [a, 0]));
  const traza: TraceRow[] = [];
  let viola = false;
  for (const id of historia) {
    const p = parseStepId(id, prog.actors);
    if (!p || p.idx >= prog.steps[p.actor]!.length) return { factible: false, motivo: `«${id}» no es un paso de los actores` };
    if (seen.has(id)) return { factible: false, motivo: `${id} aparece dos veces` };
    seen.add(id);
    if (p.idx !== next[p.actor]) return { factible: false, motivo: `${id} va antes de ${stepId(p.actor, next[p.actor]!)}` };
    next[p.actor] = p.idx + 1;
    const texto = prog.src[p.actor]![p.idx]!;
    if (s.aborted[p.actor]) {
      traza.push({ paso: id, texto, estado: { ...s.state }, nota: `no hace nada: ${p.actor} abortó` });
      continue;
    }
    const w = apply(prog, s, p.actor);
    if (w) return { factible: false, motivo: `${id} espera el candado ${w.espera}, tomado por ${w.por}` };
    traza.push({ paso: id, texto, estado: { ...s.state }, ...(s.aborted[p.actor] ? { nota: `${p.actor} aborta` } : {}) });
    if (chequeo === "cada-paso" && !holds(inv, s.state)) viola = true;
  }
  if (seen.size !== total) {
    const missing = prog.actors.flatMap((a) => prog.steps[a]!.map((_, i) => stepId(a, i))).filter((x) => !seen.has(x));
    return { factible: false, motivo: `la historia está incompleta: faltan ${missing.join(", ")}` };
  }
  if (!holds(inv, s.state)) viola = true;
  return { factible: true, viola, traza, final: { ...s.state } };
}

export type TrazaData = {
  objetivo: "violar" | "proteger";
  chequeo: "final" | "cada-paso";
  estado: Record<string, number>;
  actores: Actores;
  invariante: string;
  protocolos: Record<string, Actores> | null;
};

export type TrazaGrade =
  | { estado: "invalida"; motivo: string }
  | { estado: "violar"; correcto: boolean; sim: Extract<SimResult, { factible: true }> }
  | { estado: "proteger"; correcto: boolean; protocolo: string; resultado: EnumResult };

/** Grade a learner's answer in modo traza. ONLY `historia` (violar) or `protocolo` (proteger) are read: whatever else
 *  the answer carries (a label, a claim that it violates) is ignored, the simulator decides. */
export function gradeTraza(d: TrazaData, respuesta: { historia?: string[]; protocolo?: string }): TrazaGrade {
  const inv = compileInvariant(d.invariante, Object.keys(d.estado));
  if (typeof inv === "string") return { estado: "invalida", motivo: inv };
  if (d.objetivo === "violar") {
    const prog = compileActors(d.actores);
    if (typeof prog === "string") return { estado: "invalida", motivo: prog };
    const r = simulateHistory(prog, d.estado, inv, d.chequeo, respuesta.historia ?? []);
    if (!r.factible) return { estado: "invalida", motivo: r.motivo };
    return { estado: "violar", correcto: r.viola, sim: r };
  }
  const name = respuesta.protocolo ?? "";
  const actores = d.protocolos?.[name];
  if (!actores) return { estado: "invalida", motivo: `elige uno de los protocolos` };
  const prog = compileActors(actores);
  if (typeof prog === "string") return { estado: "invalida", motivo: prog };
  const e = enumerateInterleavings(prog, d.estado, inv, d.chequeo);
  if ("error" in e) return { estado: "invalida", motivo: e.error };
  return { estado: "proteger", correcto: e.seguro, protocolo: name, resultado: e };
}

export type EnumResult =
  | { seguro: true; intercalaciones: number }
  | { seguro: false; historia: string[]; intercalaciones: number }
  | { error: string };

/** Enumerate every feasible interleaving (DFS). Aborted actors skip their later no-op steps; a deadlock is a dead end,
 *  not a violation. Returns the first violating history, or «seguro». */
export function enumerateInterleavings(
  prog: Program,
  estado: Record<string, number>,
  inv: Expr,
  chequeo: "final" | "cada-paso",
  limit = MAX_INTERCALACIONES,
): EnumResult {
  let count = 0;
  let found: string[] | null = null;
  let over = false;
  function dfs(s: Sim, hist: string[]) {
    if (found || over) return;
    const live = prog.actors.filter((a) => !done(prog, s, a));
    if (live.length === 0) {
      count++;
      if (count > limit) over = true;
      else if (!holds(inv, s.state)) found = hist;
      return;
    }
    let moved = false;
    for (const a of live) {
      const n = clone(s);
      const id = stepId(a, n.pc[a]!);
      if (apply(prog, n, a)) continue; // waits on a lock: not possible now
      moved = true;
      if (chequeo === "cada-paso" && !holds(inv, n.state)) {
        found = [...hist, id];
        return;
      }
      dfs(n, [...hist, id]);
      if (found || over) return;
    }
    if (!moved) {
      count++; // deadlock: a dead end of the enumeration
      if (count > limit) over = true;
    }
  }
  dfs(initSim(prog, estado), []);
  if (over) return { error: `más de ${limit.toLocaleString("en-US")} intercalaciones factibles` };
  return found ? { seguro: false, historia: found, intercalaciones: count } : { seguro: true, intercalaciones: count };
}
