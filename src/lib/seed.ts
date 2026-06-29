import { makeEvent, type ArcanumEvent } from "@/core/event";
import { ARCANUM_CONFIG } from "@/core/config";

// Day-0 seed: 3 goals (ITC / FrED / Alemán), their modules, and prereq edges —
// a real DAG with sealed downstream nodes. As EVENTS (not state). Fixed UUIDs
// (valid uuid, exempt from uuidv7) → re-running the seed `put`s by id without
// duplicating (spec §12). Nothing is pre-completed.

const DEVICE = "seed";
const TS = Date.UTC(2026, 5, 20, 18, 0, 0);

const G = {
  itc: "a0000000-0000-4000-8000-000000000001",
  fred: "a0000000-0000-4000-8000-000000000002",
  aleman: "a0000000-0000-4000-8000-000000000003",
} as const;

const M = {
  edd: "a0000000-0000-4000-8000-000000000101",
  arboles: "a0000000-0000-4000-8000-000000000102",
  grafos: "a0000000-0000-4000-8000-000000000103",
  proto: "a0000000-0000-4000-8000-000000000201",
  aditiva: "a0000000-0000-4000-8000-000000000202",
  a1: "a0000000-0000-4000-8000-000000000301",
  a2: "a0000000-0000-4000-8000-000000000302",
} as const;

export const SEED_GOAL_ID = G.itc;
export const SEED_MODULE_ID = M.edd;

let seq = 0;
let ts = TS;
const fixedId = () => `b0000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
const mkGoal = (goalId: string, title: string, color: string, sigil: string) =>
  makeEvent("goal.upserted", { title, priority: 1, color, sigil }, { ts: ts++, deviceId: DEVICE, goalId, id: fixedId() });
const mkModule = (moduleId: string, goalId: string, title: string) =>
  makeEvent("module.upserted", { title, prereqs: [], kind: "core" }, { ts: ts++, deviceId: DEVICE, goalId, moduleId, id: fixedId() });
const mkEdge = (from: string, to: string) =>
  makeEvent("roadmap.edge.upserted", { from, to }, { ts: ts++, deviceId: DEVICE, id: fixedId() });

const T = ARCANUM_CONFIG.topicDefaults;

export const SEED_EVENTS: ArcanumEvent[] = [
  mkGoal(G.itc, "ITC", T.ITC, "itc"),
  mkGoal(G.fred, "FrED Factory", T["FrED Factory"], "fred"),
  mkGoal(G.aleman, "Alemán", T.Alemán, "aleman"),

  mkModule(M.edd, G.itc, "Estructuras de datos: fundamentos"),
  mkModule(M.arboles, G.itc, "Árboles balanceados"),
  mkModule(M.grafos, G.itc, "Grafos y rutas"),
  mkModule(M.proto, G.fred, "Prototipado rápido"),
  mkModule(M.aditiva, G.fred, "Manufactura aditiva"),
  mkModule(M.a1, G.aleman, "A1 — fundamentos"),
  mkModule(M.a2, G.aleman, "A2 — conversación"),

  mkEdge(M.edd, M.arboles),
  mkEdge(M.arboles, M.grafos),
  mkEdge(M.proto, M.aditiva),
  mkEdge(M.a1, M.a2),
];
