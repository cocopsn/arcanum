import type { PrediccionData } from "@/forge/bank/types/prediccion";

// GRADER of `prediccion` (design §9.3 a). LOCAL: correct = the chosen option is the one marked [x]. The confidence comes
// from the item's scale (50…100). Calibration lives in model/calibration.ts and reads only the FIRST prediction of each
// item in fold order.

export interface PredictionAnswer {
  elegida: number;
  confianza: number;
}

export function gradePrediction(data: PrediccionData, a: PredictionAnswer): { correcto: boolean } {
  return { correcto: a.elegida === data.correcta };
}

/** Is the confidence one of the item's scale values? */
export function validConfidence(data: PrediccionData, c: number): boolean {
  return data.escala.includes(c);
}
