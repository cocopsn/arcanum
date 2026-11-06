import { describe, it, expect } from "vitest";
import { makeEvent, type ArcanumEvent } from "@/core/event";
import { project, applyEvents } from "@/core/projector";
import { FORGE_GOAL_ID, type ForgeVerdictFields } from "@/core/forge-verdict";
import { FORGE_EVIDENCE_TYPES } from "@/core/evidence";

// Engineering Forge in the FOLD (design §7.4, §7.5): the rule that rules, evidence that never opens anything,
// native verdicts that never open, and incremental == rebuild over random mixed logs (CA-12).

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 10, 15, 0, 0);
const CELL = "cf000000-0000-4000-8000-0050322d3036"; // P2-06
const CELL2 = "cf000000-0000-4000-8000-0050322d3037"; // P2-07
const DIAG = "cf000000-0000-4000-8000-000000004431"; // D1
const OTHER_GOAL = "a0000000-0000-4000-8000-000000000001";
const OTHER = "ca000000-0000-4000-8000-000000000001";
const PATH = "a1000000-0000-4000-8000-000000000013";

let n = 0;
const nid = () => `c7000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
function ev(type: Parameters<typeof makeEvent>[0], payload: unknown, ts: number, goalId: string | null, moduleId: string | null): ArcanumEvent {
  return makeEvent(type, payload as never, { ts, deviceId: "t", goalId, moduleId, id: nid() });
}

const base = (): ArcanumEvent[] => [
  ev("goal.upserted", { title: "Engineering Forge", priority: 1, color: "#ffffff", sigil: "forge" }, T0, FORGE_GOAL_ID, null),
  ev("path.upserted", { path_id: PATH, slug: "p2", name: "P2", description: "d", order: 0 }, T0 + 1, FORGE_GOAL_ID, null),
  ev("module.upserted", { title: "P2-06", prereqs: [], kind: "mission", pathId: PATH }, T0 + 2, FORGE_GOAL_ID, CELL),
  ev("module.upserted", { title: "P2-07", prereqs: [], kind: "mission", pathId: PATH }, T0 + 3, FORGE_GOAL_ID, CELL2),
  ev("module.upserted", { title: "D1", prereqs: [], kind: "diagnostic" }, T0 + 4, FORGE_GOAL_ID, DIAG),
  ev("roadmap.edge.upserted", { from: CELL, to: CELL2 }, T0 + 5, null, null),
  ev("goal.upserted", { title: "ITC", priority: 1, color: "#25B0C9", sigil: "itc" }, T0 + 6, OTHER_GOAL, null),
  ev("module.upserted", { title: "ITC-0", prereqs: [], kind: "mission" }, T0 + 7, OTHER_GOAL, OTHER),
];

const passing = (over: Partial<ForgeVerdictFields> = {}): ForgeVerdictFields => ({
  v: 1,
  kind: "mision",
  essential: ["abstraccion", "sistemas"],
  capabilities: { abstraccion: 3, sistemas: 4 },
  critical: [{ id: "consistencia", passed: true }],
  failureMode: null,
  scope: "local",
  apoyo: "independiente",
  ...over,
});
const gate = (moduleId: string, ts: number, extra: Record<string, unknown>) =>
  ev("gate.evaluated", { passed: true, score: 0.9, summary: "s", feedback: "f", source: "ai", provider: "azure", ...extra }, ts, FORGE_GOAL_ID, moduleId);
const mod = (rm: ReturnType<typeof project>, id: string) => rm.modules.find((m) => m.id === id)!;

describe("gate.evaluated in a Forge cell — the rule rules in the fold (§7.4, CA-34)", () => {
  it("a passing AI verdict with Forge fields opens the compuerta and is recorded once in forgeVerdicts", () => {
    const rm = project([...base(), gate(CELL, T0 + DAY, { forge: passing() })]);
    expect(mod(rm, CELL).gatePassed).toBe(true);
    expect(rm.forgeVerdicts).toHaveLength(1);
    expect(rm.forgeVerdicts[0]).toMatchObject({ moduleId: CELL, source: "ai", passed: true, scope: "local", apoyo: "independiente", kind: "mision", queueId: null });
    expect(rm.gates.find((g) => g.moduleId === CELL)?.forge?.kind).toBe("mision");
  });

  it("without Forge fields a Forge verdict opens nothing (but elsewhere it opens as before)", () => {
    const rm = project([...base(), gate(CELL, T0 + DAY, {}), ev("gate.evaluated", { passed: true, score: 1, summary: "", feedback: "", source: "ai", provider: "x" }, T0 + DAY + 1, OTHER_GOAL, OTHER)]);
    expect(mod(rm, CELL).gatePassed).toBe(false);
    expect(rm.gates.find((g) => g.moduleId === CELL)?.passed).toBe(false);
    expect(mod(rm, OTHER).gatePassed).toBe(true);
  });

  it("CA-34: passed:true with a failed critical condition, or an essential at 2, stays failed in the fold", () => {
    const rm1 = project([...base(), gate(CELL, T0 + DAY, { forge: passing({ critical: [{ id: "consistencia", passed: false }] }) })]);
    expect(mod(rm1, CELL).gatePassed, "el pliegue no aplicó la regla: una condición crítica fallida abrió la celda").toBe(false);
    expect(rm1.forgeVerdicts[0]!.passed, "el pliegue no aplicó la regla: una condición crítica fallida quedó aprobada").toBe(false);
    const rm2 = project([...base(), gate(CELL, T0 + DAY, { forge: passing({ capabilities: { abstraccion: 2, sistemas: 4 } }) })]);
    expect(mod(rm2, CELL).gatePassed, "el pliegue no aplicó la regla: una capacidad esencial en 2 abrió la celda").toBe(false);
    expect(rm2.forgeVerdicts[0]!.passed, "el pliegue no aplicó la regla: una capacidad esencial en 2 quedó aprobada").toBe(false);
  });

  it("a retention or diagnosis verdict that meets the rule never opens (forgeKindOpens)", () => {
    for (const kind of ["retencion", "diagnostico"] as const) {
      const rm = project([...base(), gate(CELL, T0 + DAY, { forge: passing({ kind }) })]);
      expect(mod(rm, CELL).gatePassed, "un veredicto de retención abrió la compuerta").toBe(false);
      expect(rm.forgeVerdicts[0]!.passed, "un veredicto de retención abrió la compuerta").toBe(false);
    }
  });

  it("review NIT 5: an absent or unknown kind, or an invalid scope or apoyo, never passes", () => {
    const bad = [
      { ...passing(), kind: undefined },
      { ...passing(), kind: "otro" },
      { ...passing(), scope: "remoto" },
      { ...passing(), apoyo: "mucho" },
      { ...passing(), apoyo: undefined },
    ];
    for (const forge of bad) {
      const rm = project([...base(), gate(CELL, T0 + DAY, { forge })]);
      expect(mod(rm, CELL).gatePassed, `un veredicto con kind, scope o apoyo inválido abrió la celda: ${JSON.stringify(forge)}`).toBe(false);
      expect(rm.forgeVerdicts.every((v) => !v.passed)).toBe(true);
    }
  });

  it("a heuristic verdict with approved Forge fields is recorded as heuristic and opens nothing", () => {
    const rm = project([...base(), gate(CELL, T0 + DAY, { source: "heuristic", forge: passing() })]);
    expect(mod(rm, CELL).gatePassed, "un veredicto que no es de IA abrió la compuerta").toBe(false);
    expect(rm.forgeVerdicts[0]!.source).toBe("heuristic");
    expect(rm.forgeVerdicts[0]!.passed, "un veredicto que no es de IA quedó aprobado en el pliegue").toBe(false);
  });

  it("a diagnostic cell is never opened, even by a passing AI verdict", () => {
    const rm = project([...base(), gate(DIAG, T0 + DAY, { forge: passing() })]);
    expect(mod(rm, DIAG).gatePassed, "una celda de diagnóstico se abrió con un veredicto").toBe(false);
  });

  it("a non-Forge verdict that CARRIES Forge fields must pass the rule", () => {
    const rm = project([...base(), ev("gate.evaluated", { passed: true, score: 1, summary: "", feedback: "", source: "ai", provider: "x", forge: passing({ critical: [] }) }, T0 + DAY, OTHER_GOAL, OTHER)]);
    expect(mod(rm, OTHER).gatePassed).toBe(false);
  });
});

describe("native verdicts (RF-V7, CA-35)", () => {
  it("a passing native verdict is recorded in nativeGates and forgeVerdicts and never touches gates nor gatePassed", () => {
    const q = ev("ai.queued", { queueId: "q-nat", kind: "forge", input: {} }, T0 + DAY, FORGE_GOAL_ID, CELL);
    const rm = project([...base(), q, gate(CELL, T0 + DAY + 1, { passed: false, queueId: "q-nat", forge: passing({ scope: "nativa", nativePassed: true }) })]);
    expect(mod(rm, CELL).gatePassed).toBe(false);
    expect(rm.gates.find((g) => g.moduleId === CELL)).toBeUndefined();
    expect(rm.nativeGates).toHaveLength(1);
    expect(rm.nativeGates[0]!.passed).toBe(true);
    expect(rm.forgeVerdicts[0]).toMatchObject({ scope: "nativa", passed: true, queueId: "q-nat" });
    expect(rm.pendingAi).toHaveLength(0);
  });

  it("a native verdict without nativePassed, or not from AI, is recorded as failed", () => {
    const rm = project([...base(), gate(CELL, T0 + DAY, { forge: passing({ scope: "nativa" }) }), gate(CELL2, T0 + DAY + 1, { source: "heuristic", forge: passing({ scope: "nativa", nativePassed: true }) })]);
    expect(rm.nativeGates.every((g) => g.passed === false)).toBe(true);
    expect(rm.forgeVerdicts.every((v) => v.passed === false)).toBe(true);
  });
});

describe("evidence.recorded never opens anything (CA-33)", () => {
  it("every evidence type, approved, leaves gatePassed false, XP and mastery untouched", () => {
    const before = project(base());
    const evs = FORGE_EVIDENCE_TYPES.map((type, i) =>
      ev("evidence.recorded", { itemId: `item-${i}`, type, phase: "respuesta", outcome: "aprobado", data: { i }, source: "ai", verdict: passing() }, T0 + DAY + i, FORGE_GOAL_ID, CELL),
    );
    const rm = project([...base(), ...evs]);
    expect(rm.evidence).toHaveLength(FORGE_EVIDENCE_TYPES.length);
    expect(mod(rm, CELL).gatePassed).toBe(false);
    expect(rm.stats.totalXp).toBe(before.stats.totalXp);
    expect(mod(rm, CELL).S).toBe(mod(before, CELL).S);
    expect(mod(rm, CELL).reinforceCount).toBe(0);
    expect(rm.qualifiedDays).toEqual(before.qualifiedDays);
    expect(rm.evidence.every((e) => e.passed === true)).toBe(true);
  });

  it("invalid evidence is ignored; a verdict passes only with source ai + aprobado + the rule; data over 4,096 characters is a stub", () => {
    const rm = project([
      ...base(),
      ev("evidence.recorded", { itemId: "X", type: "sql", phase: "respuesta", outcome: "correcto", data: {}, source: "local" }, T0 + DAY, FORGE_GOAL_ID, CELL),
      ev("evidence.recorded", { itemId: "ok-1", type: "nope", phase: "respuesta", outcome: "correcto", data: {}, source: "local" }, T0 + DAY + 1, FORGE_GOAL_ID, CELL),
      ev("evidence.recorded", { itemId: "ok-2", type: "sql", phase: "respuesta", outcome: "correcto", data: {}, source: "local" }, T0 + DAY + 2, FORGE_GOAL_ID, null),
      ev("evidence.recorded", { itemId: "ok-3", type: "retencion", phase: "respuesta", outcome: "aprobado", data: {}, source: "self", verdict: passing() }, T0 + DAY + 3, FORGE_GOAL_ID, CELL),
      ev("evidence.recorded", { itemId: "ok-4", type: "sql", phase: "respuesta", outcome: "correcto", data: { big: "x".repeat(5000) }, source: "local" }, T0 + DAY + 4, FORGE_GOAL_ID, CELL),
    ]);
    expect(rm.evidence.map((e) => e.itemId)).toEqual(["ok-3", "ok-4"]);
    expect(rm.evidence[0]!.passed).toBe(false);
    expect(rm.evidence[1]!.passed).toBeNull();
    expect(rm.evidence[1]!.data).toEqual({ truncated: true, bytes: JSON.stringify({ big: "x".repeat(5000) }).length });
  });

  it("an evidence with queueId resolves the queued entry", () => {
    const rm = project([
      ...base(),
      ev("ai.queued", { queueId: "q-ev", kind: "forge", input: { cellCode: "P2-06" } }, T0 + DAY, FORGE_GOAL_ID, CELL),
      ev("evidence.recorded", { itemId: "giro-1", type: "giro", phase: "respuesta", outcome: "registrado", data: {}, source: "ai", queueId: "q-ev" }, T0 + DAY + 1, FORGE_GOAL_ID, CELL),
    ]);
    expect(rm.pendingAi).toHaveLength(0);
  });
});

describe("ai.queued and mission.submitted (additive payloads)", () => {
  it("kind forge is kept, any other unknown kind is gate", () => {
    const rm = project([
      ...base(),
      ev("ai.queued", { queueId: "q1", kind: "forge", input: {} }, T0 + DAY, FORGE_GOAL_ID, CELL),
      ev("ai.queued", { queueId: "q2", kind: "raro", input: {} }, T0 + DAY + 1, FORGE_GOAL_ID, CELL),
      ev("ai.queued", { queueId: "q3", kind: "mission", input: {} }, T0 + DAY + 2, FORGE_GOAL_ID, CELL),
    ]);
    expect(rm.pendingAi.map((p) => p.kind)).toEqual(["forge", "gate", "mission"]);
  });

  it("entrega is kept only with exactly the 9 text keys; apoyo only with one of its two values", () => {
    const entrega = { problema: "p", supuestos: "s", enfoque: "e", implementacion: "i", pruebas: "t", complejidad: "c", fallos: "f", herramientas: "h", defensa: "d" };
    const rm = project([...base(), ev("mission.submitted", { notes: "n", entrega, apoyo: "con_apoyo" }, T0 + DAY, FORGE_GOAL_ID, CELL)]);
    expect(rm.missions[0]).toMatchObject({ entrega, apoyo: "con_apoyo" });
    const { defensa: _drop, ...eight } = entrega;
    void _drop;
    const rm2 = project([...base(), ev("mission.submitted", { notes: "n", entrega: eight, apoyo: "otro" }, T0 + DAY, FORGE_GOAL_ID, CELL)]);
    expect(rm2.missions[0]!.entrega).toBeUndefined();
    expect(rm2.missions[0]!.apoyo).toBeUndefined();
    const rm3 = project([...base(), ev("mission.submitted", { notes: "n", entrega: { ...entrega, extra: "x" } }, T0 + DAY, FORGE_GOAL_ID, CELL)]);
    expect(rm3.missions[0]!.entrega).toBeUndefined();
  });
});

// ── CA-12: incremental == rebuild over ≥ 200 random sequences with a fixed seed ──────────────────────────────
/** The first path where two JSON values differ (with both values), or null when equal. */
function firstDiff(a: unknown, b: unknown, path: string): string | null {
  if (a === b) return null;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null || Array.isArray(a) !== Array.isArray(b)) {
    return `${path}: ${JSON.stringify(a)?.slice(0, 160)} != ${JSON.stringify(b)?.slice(0, 160)}`;
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) return `${path}.length: ${a.length} != ${b.length}`;
  const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
  for (const k of keys) {
    const d = firstDiff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`);
    if (d) return d;
  }
  return null;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Precondition of the generator, the same as production: every ai.queued mints a FRESH queueId (a UUID in the
// app); resolutions (gate.evaluated / evidence.recorded) may repeat a known one (two devices draining the same
// submission) or name an unknown one. Re-enqueuing an already-resolved queueId on a newer day is not a reachable
// state (it makes the pre-existing fast path keep a pending the rebuild drops; found by this test, not Forge-specific).
let queued: string[] = [];
let qn = 0;
function randomEvent(r: () => number, ts: number): ArcanumEvent {
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const cell = pick([CELL, CELL2, DIAG, OTHER]);
  const goal = cell === OTHER ? OTHER_GOAL : FORGE_GOAL_ID;
  const q = queued.length > 0 && r() < 0.8 ? pick(queued) : `q-unknown-${Math.floor(r() * 3)}`;
  const k = Math.floor(r() * 10);
  const forge = passing({
    kind: pick(["mision", "mision", "retencion", "diagnostico", "entrevista"] as const),
    scope: pick(["local", "local", "nativa"] as const),
    apoyo: pick(["independiente", "con_apoyo"] as const),
    capabilities: { abstraccion: pick([2, 3, 4]), sistemas: pick([3, 4]) },
    critical: [{ id: "consistencia", passed: r() < 0.8 }],
    failureMode: pick([null, "ejecucion", "concepto"] as const),
    nativePassed: r() < 0.5,
  });
  switch (k) {
    case 0:
    case 1:
      return ev("gate.evaluated", { passed: r() < 0.7, score: 0.5, summary: "s", feedback: "f", source: r() < 0.85 ? "ai" : "heuristic", provider: "p", ...(r() < 0.8 ? { forge } : {}), ...(r() < 0.4 ? { queueId: q } : {}) }, ts, goal, cell);
    case 2:
    case 3:
      return ev("evidence.recorded", { itemId: pick(["it-a", "it-b", "leccion-ligera", "BAD"]), type: pick(["sql", "retencion", "remediacion", "giro", "nope"]), phase: pick(["respuesta", "leccion", "pasada-1"]), outcome: pick(["correcto", "incorrecto", "aprobado", "reprobado", "registrado"]), data: { k: Math.floor(r() * 100), forma: pick(["codigo", "defensa"]) }, source: pick(["local", "ai", "self"]), ...(r() < 0.3 ? { verdict: forge } : {}), ...(r() < 0.3 ? { queueId: q } : {}) }, ts, goal, cell);
    case 4: {
      const fresh = `q-${++qn}`;
      queued.push(fresh);
      return ev("ai.queued", { queueId: fresh, kind: pick(["gate", "mission", "forge", "zz"]), input: {} }, ts, goal, cell);
    }
    case 5:
      return ev("mission.submitted", { notes: "n", ...(r() < 0.5 ? { entrega: { problema: "p", supuestos: "s", enfoque: "e", implementacion: "i", pruebas: "t", complejidad: "c", fallos: "f", herramientas: "h", defensa: "d" } } : {}), ...(r() < 0.5 ? { apoyo: pick(["independiente", "con_apoyo", "x"]) } : {}) }, ts, goal, cell);
    case 6:
      return ev("checkpoint.passed", { score: r() }, ts, goal, cell);
    case 7:
      return ev("module.started", {}, ts, goal, cell);
    case 8:
      return ev("session.ended", { duration_ms: Math.floor(r() * 3_600_000) }, ts, goal, cell);
    default:
      return ev("module.completed", {}, ts, goal, cell);
  }
}

describe("CA-12 — applyEvents == project over ≥ 200 random mixed sequences (fixed seed)", () => {
  it("holds on the fast path (newer days) and on the rebuild path (same day, out of order)", () => {
    const r = mulberry32(20261106);
    let fast = 0;
    let rebuilt = 0;
    for (let s = 0; s < 240; s++) {
      queued = [];
      const events = base();
      let ts = T0 + DAY;
      const len = 5 + Math.floor(r() * 25);
      for (let i = 0; i < len; i++) {
        ts += r() < 0.35 ? DAY + Math.floor(r() * 1000) : Math.floor(r() * 5000);
        events.push(randomEvent(r, ts));
      }
      const cut = 1 + Math.floor(r() * (events.length - 1));
      const shuffledTail = events.slice(cut);
      if (r() < 0.3) shuffledTail.reverse();
      const prev = project(events.slice(0, cut));
      const res = applyEvents(prev, shuffledTail, events);
      if (res.rebuilt) rebuilt++;
      else fast++;
      const full = project(events);
      const d = firstDiff(JSON.parse(JSON.stringify(res.model)), JSON.parse(JSON.stringify(full)), "rm");
      expect(d, `secuencia ${s} (rebuilt=${res.rebuilt}): incremental != rebuild en ${d}`).toBeNull();
    }
    expect(fast).toBeGreaterThan(20);
    expect(rebuilt).toBeGreaterThan(20);
  });
});
