import dynamic from "next/dynamic";
import { createElement, type ComponentType } from "react";
import type { ReadModel } from "@/core/read-model";
import type { ForgeBankItem, ForgeType } from "@/forge/bank/registry";

// LAZY REGISTRY of the practice runners of the Forge types that appear in ExerciseMode's «Evaluaciones» list
// (design §9.5, §22.3): a–f, k, `retencion` (forma codigo) and l–p where they are bank practice. `entrevista`,
// `expediente`, `giro` and `retencion` in forma defensa are NOT here: the cell's flows consume them. Every entry is
// next/dynamic with ssr:false over a dynamic import, never a static import; nobody edits this map after Phase 0 (a
// branch replaces its <Tipo>Runner.tsx file). Tests call RUNNER_LOADERS (the components themselves are imported
// statically in UI tests).

export interface RunnerProps {
  item: ForgeBankItem;
  cellCode: string;
  cellId: string;
  readModel: ReadModel;
  onClose: () => void;
}

export type RunnerType = Exclude<ForgeType, "entrevista" | "expediente" | "giro">;

type Loader = () => Promise<{ default: ComponentType<RunnerProps> }>;

export const RUNNER_LOADERS: Record<RunnerType, Loader> = {
  prediccion: () => import("./PrediccionRunner"),
  desvanecido: () => import("./DesvanecidoRunner"),
  historial: () => import("./HistorialRunner"),
  mutantes: () => import("./MutantesRunner"),
  contraejemplo: () => import("./ContraejemploRunner"),
  senal: () => import("./SenalRunner"),
  sql: () => import("./SqlRunner"),
  retencion: () => import("./RetencionRunner"),
  ontologia: () => import("./OntologiaRunner"),
  forense: () => import("./ForenseRunner"),
  permisos: () => import("./PermisosRunner"),
  recuperacion: () => import("./RecuperacionRunner"),
  gameday: () => import("./GamedayRunner"),
};

const loading = () => createElement("p", { role: "status" }, "Cargando evaluación…");

export const RUNNERS = Object.fromEntries(
  (Object.keys(RUNNER_LOADERS) as RunnerType[]).map((t) => [t, dynamic(RUNNER_LOADERS[t], { ssr: false, loading })]),
) as Record<RunnerType, ComponentType<RunnerProps>>;

/** Whether an item is offered in the «Evaluaciones» list (retencion only in forma codigo). */
export function isSelectable(item: ForgeBankItem): boolean {
  if (item.type === "entrevista" || item.type === "expediente" || item.type === "giro") return false;
  if (item.type === "retencion") return item.data.forma === "codigo";
  return true;
}
