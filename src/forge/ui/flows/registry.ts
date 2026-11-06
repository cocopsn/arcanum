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

// Each entry writes its import() INSIDE the dynamic() call, the form next/dynamic documents. FLOW_LOADERS repeats the
// same paths for the tests; webpack emits one chunk per module either way.
export const FLOWS: Record<ForgeFlujo, ComponentType<FlowProps>> = {
  mision: dynamic(() => import("./mision"), { ssr: false, loading }),
  proyecto: dynamic(() => import("./proyecto"), { ssr: false, loading }),
  entrevista: dynamic(() => import("./entrevista"), { ssr: false, loading }),
  expediente: dynamic(() => import("./expediente"), { ssr: false, loading }),
  ontologia: dynamic(() => import("./ontologia"), { ssr: false, loading }),
  gameday: dynamic(() => import("./gameday"), { ssr: false, loading }),
  diagnostico: dynamic(() => import("./diagnostico"), { ssr: false, loading }),
};
