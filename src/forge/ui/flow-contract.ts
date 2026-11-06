import type { ReadModel } from "@/core/read-model";
import type { ForgeCompuerta, ForgeFlujo, ForgeRouteData } from "@/forge/route-data";
import type { ForgeVerdictKind } from "@/forge/ai-port";

// CONTRACT of every Forge flow (design §9.5, §22.3). Frozen in Phase 0.
//
// CLOSING RULE (single rule): every flow whose cell has `compuerta !== null` ENDS by mounting the `mision` flow of
// the registry (ForgeMission) with `kind = cell.compuerta`. If its artifact already is the evidence, it FIRST leaves
// it in the log and passes `attachments = { eventIds }` with the ids of those evidence.recorded. ForgeMission is the
// ONLY component that asks for a gate verdict, in this fixed order: (1) delivery in full or artifact mode with
// `apoyo` and scope without a default value; (2) `await fire("mission.submitted", { notes, entrega, apoyo })`, and
// it does not advance if the write fails; (3) if the bank brings a `giro`, it reveals it and asks for the answer;
// (4) «Pedir veredicto» calls submitForgeVerdict({ cellCode, kind, scope, artefactoEventIds, giroRespuesta }).

export interface FlowProps {
  cellCode: string;
  cellId: string;
  route: ForgeRouteData;
  readModel: ReadModel;
  /** only for the `mision` flow: the kind it closes (= cell.compuerta) */
  kind?: ForgeVerdictKind;
  /** artifact mode: ids of the evidence.recorded that are the artifact */
  attachments?: { eventIds: string[] };
  onClose: () => void;
}

/** Text of every stub surface and of every pending item (§6.3, §22.5). */
export const PENDING_TEXT = "Este tipo de evaluación aún no está disponible en esta versión";

/** Text when ForgeMission receives an inconsistent configuration (§9.5 step 1). */
export const MISCONFIGURED_TEXT = "Este flujo no está bien configurado";

/** What a flow must mount at its end: null (diagnostic, no gate) or the mission flow with its kind and attachments. */
export function closingMount(compuerta: ForgeCompuerta, artifactEventIds?: string[]): { flujo: "mision"; kind: ForgeVerdictKind; attachments?: { eventIds: string[] } } | null {
  if (compuerta === null) return null;
  return artifactEventIds && artifactEventIds.length ? { flujo: "mision", kind: compuerta, attachments: { eventIds: artifactEventIds } } : { flujo: "mision", kind: compuerta };
}

/** ForgeMission's first check (§9.5 step 1): kind must be the cell's gate, and artifact mode needs eventIds. */
export function missionConfigError(cellCompuerta: ForgeCompuerta, kind: ForgeVerdictKind | undefined, mode: "completo" | "artefacto", attachments?: { eventIds: string[] }): string | null {
  if (cellCompuerta === null || kind !== cellCompuerta) return MISCONFIGURED_TEXT;
  if (mode === "artefacto" && !(attachments && attachments.eventIds.length > 0)) return MISCONFIGURED_TEXT;
  return null;
}

export type { ForgeFlujo };
