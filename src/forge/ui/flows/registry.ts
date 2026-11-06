import dynamic from "next/dynamic";
import { createElement, type ComponentType } from "react";
import type { ForgeFlujo } from "@/forge/route-data";
import type { FlowProps } from "@/forge/ui/flow-contract";

// LAZY REGISTRY of the 7 heavy flows of a Forge cell, by `flujo` (design §5.2, §9.5, §22.3). next/dynamic with
// ssr:false over a dynamic import, never a static import; nobody edits this map after Phase 0 (a branch replaces its
// flow file). The closing rule lives in flow-contract.ts: a flow with a gate ends by mounting FLOWS.mision with
// kind = compuerta. Tests call FLOW_LOADERS.

type Loader = () => Promise<{ default: ComponentType<FlowProps> }>;

export const FLOW_LOADERS: Record<ForgeFlujo, Loader> = {
  mision: () => import("./mision"),
  proyecto: () => import("./proyecto"),
  entrevista: () => import("./entrevista"),
  expediente: () => import("./expediente"),
  ontologia: () => import("./ontologia"),
  gameday: () => import("./gameday"),
  diagnostico: () => import("./diagnostico"),
};

const loading = () => createElement("p", { role: "status" }, "Cargando…");

export const FLOWS = Object.fromEntries(
  (Object.keys(FLOW_LOADERS) as ForgeFlujo[]).map((f) => [f, dynamic(FLOW_LOADERS[f], { ssr: false, loading })]),
) as Record<ForgeFlujo, ComponentType<FlowProps>>;
