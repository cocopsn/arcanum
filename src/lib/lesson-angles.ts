// ONE GENERATOR, THREE FUNCTIONS (course / depth / review) — all driven by an ANGLE that rotates so
// the same verified source yields a DIFFERENT lesson each time. Capa A gives the anchored column;
// Capa B generates depth (more angles); Capa C (spaced review) reuses the SAME engine with the next
// angle, so two consecutive reviews of a cell are never identical. Pure (no clock, no randomness) →
// the rotation is deterministic and unit-testable; the atemporal fold stays intact. The index is the
// cell's reinforceCount (derived from the log), so it advances with every completed lesson/review.

export const LESSON_ANGLES = [
  "el primer principio: la intuición central y el PORQUÉ, no un resumen de viñetas",
  "un caso límite o contraejemplo que rompe la intuición ingenua",
  "la implementación concreta: escribir el fragmento y justificar cada decisión de diseño",
  "el análisis de costo: por qué ESA complejidad/estabilidad y no otra, con el argumento formal",
  "la comparación con una alternativa: cuándo elegir esto y cuándo NO, con el trade-off",
  "un problema aplicado que obliga a combinar este concepto con otro",
  "la derivación desde cero: reconstruir el resultado paso a paso sin mirarlo",
] as const;

/** The angle for a given rotation index (wraps; safe for negatives AND non-finite). Pure + total. */
export function angleAt(index: number): string {
  const n = LESSON_ANGLES.length;
  const safe = Number.isFinite(index) ? Math.trunc(index) : 0;
  const i = ((safe % n) + n) % n;
  return LESSON_ANGLES[i]!;
}

/** True when two indices land on DIFFERENT angles — the review invariant (consecutive ≠ repeat). */
export function anglesDiffer(a: number, b: number): boolean {
  return angleAt(a) !== angleAt(b);
}
