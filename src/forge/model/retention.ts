// ENGINEERING FORGE — retention as a PRESENTER (design §8.7, RF-E i, CA-39). The extension of present() for Forge:
// the UI calls it with Date.now(); the fold never calls it and never reads the clock. PURE given `nowMs`.
// For each `retencion` item of a bank whose cell has an approved, local, independent AI verdict:
//   due = ts of the FIRST of those verdicts + dias × 86,400,000.
import type { ReadModel } from "@/core/read-model";
import { isApprovedLocal } from "@/forge/model/competence";

export const DAY_MS = 86_400_000;

/** The minimal shape of a bank this presenter needs (the full item type lives with the bank parser). */
export interface ForgeRetentionBank {
  cellId: string;
  items: readonly { id: string; type: string; dias?: number }[];
}

export interface ForgeRetentionDue {
  cellId: string;
  itemId: string;
  dias: number;
  dueMs: number;
}

export interface ForgeRetentionView {
  /** due ≤ now, oldest first */
  vencidos: ForgeRetentionDue[];
  /** due > now, soonest first */
  proximos: ForgeRetentionDue[];
}

/** Interval label (text of §5.5). */
export const RETENTION_INTERVAL_LABEL = "Intervalo propuesto por el programa; ajustable";

export function presentForgeRetention(rm: ReadModel, bancos: readonly ForgeRetentionBank[], nowMs: number): ForgeRetentionView {
  const vencidos: ForgeRetentionDue[] = [];
  const proximos: ForgeRetentionDue[] = [];
  for (const bank of bancos) {
    const first = rm.forgeVerdicts.find((v) => v.moduleId === bank.cellId && isApprovedLocal(v) && v.apoyo === "independiente");
    if (!first) continue;
    for (const it of bank.items) {
      if (it.type !== "retencion") continue;
      const dias = it.dias;
      if (typeof dias !== "number" || !Number.isInteger(dias) || dias < 1 || dias > 120) continue;
      const due: ForgeRetentionDue = { cellId: bank.cellId, itemId: it.id, dias, dueMs: first.ts + dias * DAY_MS };
      (due.dueMs <= nowMs ? vencidos : proximos).push(due);
    }
  }
  const byDue = (a: ForgeRetentionDue, b: ForgeRetentionDue) => a.dueMs - b.dueMs || (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0);
  return { vencidos: vencidos.sort(byDue), proximos: proximos.sort(byDue) };
}
