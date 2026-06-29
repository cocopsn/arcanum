import type { ArcanumEvent, CheckpointPassedPayload, FiretestAttemptedPayload } from "@/core/event";
import type { ReadModel, ModuleStatus } from "@/core/read-model";
import { retrievability } from "@/core/mastery";
import { msToDays } from "@/core/time";

// Per-module evaluation (Bloque 5). PURE context derivation + a local heuristic
// fallback so the trunk evaluates WITHOUT any AI. The AI router (Asuka-style,
// adversarial) is layered on top by the action; both emit module.evaluated.

export interface EvalContext {
  moduleId: string;
  title: string;
  status: ModuleStatus;
  /** r(now) ∈ [0,1] */
  retrievability: number;
  checkpointCount: number;
  /** mean checkpoint/quiz score, or null if none */
  checkpointAvg: number | null;
  errorsResolved: number;
  firetestBest: number | null;
  /** days since the module was started, or null */
  daysActive: number | null;
}

export function buildEvaluationContext(
  rm: ReadModel,
  events: ArcanumEvent[],
  moduleId: string,
  nowMs: number,
): EvalContext | null {
  const m = rm.modules.find((x) => x.id === moduleId);
  if (!m) return null;
  const nowDays = msToDays(nowMs);

  let checkpointCount = 0;
  let checkpointSum = 0;
  let errorsResolved = 0;
  let firetestBest: number | null = null;
  for (const e of events) {
    if (e.module_id !== moduleId) continue;
    if (e.type === "checkpoint.passed") {
      const p = e.payload as unknown as CheckpointPassedPayload;
      const s = Number(p.score);
      if (Number.isFinite(s)) {
        checkpointCount++;
        checkpointSum += Math.max(0, Math.min(1, s));
      }
    } else if (e.type === "error.resolved") {
      errorsResolved++;
    } else if (e.type === "firetest.attempted") {
      const p = e.payload as unknown as FiretestAttemptedPayload;
      const c = Number(p.ceiling);
      const r = Number(p.reached);
      if (Number.isFinite(c) && c > 0 && Number.isFinite(r)) {
        const ratio = Math.max(0, Math.min(1, r / c));
        firetestBest = firetestBest === null ? ratio : Math.max(firetestBest, ratio);
      }
    }
  }

  return {
    moduleId,
    title: m.title,
    status: m.status,
    retrievability: retrievability(m.S, m.lastReinforcedDays, nowDays),
    checkpointCount,
    checkpointAvg: checkpointCount === 0 ? null : checkpointSum / checkpointCount,
    errorsResolved,
    firetestBest,
    daysActive: m.startedDays === null ? null : Math.max(0, Math.round(nowDays - m.startedDays)),
  };
}

export interface HeuristicVerdict {
  summary: string;
  strengths: string[];
  gaps: string[];
  challenge: string;
  score: number;
}

/** Adversarial-but-fair verdict from the real signals — no invented praise. Pure. */
export function heuristicEvaluation(ctx: EvalContext): HeuristicVerdict {
  const r = ctx.retrievability;
  const cpAvg = ctx.checkpointAvg;
  const score = Math.max(0, Math.min(1, 0.6 * r + 0.4 * (cpAvg ?? r)));

  const strengths: string[] = [];
  if (r >= 0.8) strengths.push("Retención sólida: el material aguanta sin repaso.");
  if (cpAvg !== null && cpAvg >= 0.8) strengths.push("Consistente en los checkpoints.");
  if (ctx.errorsResolved >= 3) strengths.push("Chocaste y superaste muros — el reto está haciendo su trabajo.");
  if (ctx.firetestBest !== null && ctx.firetestBest >= 0.7) strengths.push("Demostraste nivel en prueba de fuego.");
  if (strengths.length === 0) strengths.push("Apenas empiezas aquí — todo por construir, sin vicios todavía.");

  const gaps: string[] = [];
  if (ctx.status === "idle") gaps.push("Aún no inicias. El primer muro es el más barato; págalo.");
  if (r < 0.5 && ctx.status !== "idle") gaps.push("La retención está cayendo. Repasa antes de que cruce el umbral.");
  if (ctx.checkpointCount === 0) gaps.push("Sin checkpoints: no has puesto a prueba lo que crees saber.");
  if (ctx.errorsResolved === 0) gaps.push("No registras muros superados. El reto es la puerta — entra sin abrir recursos.");
  if (gaps.length === 0) gaps.push("Sin huecos evidentes en los datos. Sube la dificultad o no estás midiendo el límite.");

  let challenge: string;
  if (ctx.status === "idle" || ctx.errorsResolved === 0) {
    challenge = `Sin abrir un solo recurso, intenta ${ctx.title} y llega tan lejos como puedas. Reporta honesto dónde te detienes — ahí empieza el trabajo real.`;
  } else if (r < 0.6 || (cpAvg !== null && cpAvg < 0.6)) {
    challenge = `Reconstruye ${ctx.title} desde el primer principio, sin notas. Si no puedes derivarlo, ese es tu hueco — no lo memorices, entiéndelo.`;
  } else {
    challenge = `Toma el caso más difícil de ${ctx.title} y explícaselo a alguien que no sabe nada. Donde titubees, no lo dominas todavía.`;
  }

  const pct = Math.round(score * 100);
  const lead = score >= 0.8 ? "Lo dominas, pero no te confíes." : score >= 0.5 ? "Vas a medias." : "El muro aguanta.";
  return { summary: `Dominio estimado ${pct}%. ${lead} ${gaps[0]}`, strengths, gaps, challenge, score };
}
