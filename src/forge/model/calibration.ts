import type { EvidenceRM, ReadModel } from "@/core/read-model";

// CALIBRATION of the predictions (design §9.3 a, CA-43). PURE over the read model. Only the FIRST prediction of each item
// counts (fold order): a later answer never changes the registered one nor the calibration. Brier = mean((c/100 − y)²)
// and bias = mean(c/100) − hits/n, always with n in view. Per cell (moduleId) or global.

export interface Calibration {
  n: number;
  aciertos: number;
  brier: number | null;
  sesgo: number | null;
}

/** The first evidence of an item in a phase (fold order), or null. */
export function firstEvidence(rm: Pick<ReadModel, "evidence">, cellId: string, itemId: string, phase: string): EvidenceRM | null {
  return rm.evidence.find((e) => e.moduleId === cellId && e.itemId === itemId && e.phase === phase) ?? null;
}

/** Calibration over the first prediction of each item (type "prediccion", phase "respuesta"); per cell when given. */
export function calibration(rm: Pick<ReadModel, "evidence">, cellId?: string): Calibration {
  const seen = new Set<string>();
  const points: { c: number; y: 0 | 1 }[] = [];
  for (const e of rm.evidence) {
    if (e.type !== "prediccion" || e.phase !== "respuesta") continue;
    if (cellId !== undefined && e.moduleId !== cellId) continue;
    const key = `${e.moduleId}\u0000${e.itemId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const d = e.data as { confianza?: unknown } | null;
    const c = d && typeof d.confianza === "number" && d.confianza >= 0 && d.confianza <= 100 ? d.confianza : null;
    if (c === null) continue;
    points.push({ c: c / 100, y: e.outcome === "correcto" ? 1 : 0 });
  }
  const n = points.length;
  const aciertos = points.filter((p) => p.y === 1).length;
  if (n === 0) return { n, aciertos, brier: null, sesgo: null };
  const brier = points.reduce((s, p) => s + (p.c - p.y) ** 2, 0) / n;
  const sesgo = points.reduce((s, p) => s + p.c, 0) / n - aciertos / n;
  return { n, aciertos, brier, sesgo };
}
