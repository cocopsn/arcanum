// TYPE ONLY: ForgeRouteData, the shape of src/forge/data/routes/<slug>.json (design §5.2).
// ONE source (D11.2, integrar-fase0): the declaration lives in src/forge/data/types.ts (forge/c0-nucleo, which owns
// the data and its generator). This module only re-exports it, so loaders.ts, flow-contract.ts and the Phase 1
// branches can keep importing from "@/forge/route-data".
export type { ForgeCapability } from "@/core/forge-verdict";
export type {
  ForgeFlujo,
  ForgeCompuerta,
  ForgeCellClass,
  ForgeFamily,
  SourceRef,
  HonestyLabel,
  ForgeCellData,
  ForgeRouteData,
} from "@/forge/data/types";
