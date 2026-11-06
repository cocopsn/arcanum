// ENGINEERING FORGE — the verdict contract and the approval rule (design §8.1). PURE: no imports from the
// app, no clock, no randomness. The same rule runs in three places — the Edge when it parses, the client
// when it mints, and the FOLD (projector.ts), which is the one that rules because the log can carry events
// from any device or version. It fails CLOSED: anything malformed, missing or out of range does not pass.

/** The Forge goal id. Declared here (not in src/forge/ids.ts) because the fold needs it and src/core can
 *  never import from the app layers; src/forge/ids.ts re-exports it. */
export const FORGE_GOAL_ID = "a0000000-0000-4000-8000-000000000006";

/** The 8 capabilities of §01 of the master program. */
export const FORGE_CAPABILITIES = [
  "algoritmos",
  "abstraccion",
  "sistemas",
  "datos",
  "ia",
  "producto",
  "comunicacion",
  "responsabilidad",
] as const;
export type ForgeCapability = (typeof FORGE_CAPABILITIES)[number];

/** The 8 failure modes of §05 (diagnosis → intervention). */
export const FORGE_FAILURE_MODES = [
  "concepto",
  "ejecucion",
  "patron",
  "tutorial",
  "defensa",
  "happy_path",
  "priorizacion",
  "olvido",
] as const;
export type ForgeFailureMode = (typeof FORGE_FAILURE_MODES)[number];

/** The critical conditions of §05; a cell may also declare `otra:<slug>` with its own text. */
export const FORGE_CRITICAL_CONDITIONS = [
  "correctitud",
  "identidad",
  "autorizacion",
  "consistencia",
  "trazabilidad",
  "recuperacion",
] as const;
export type ForgeCriticalCondition = (typeof FORGE_CRITICAL_CONDITIONS)[number] | `otra:${string}`;

/** The 7 verdict kinds. Only the first five can ever open a cell (forgeKindOpens). */
export const FORGE_VERDICT_KINDS = ["mision", "expediente", "entrevista", "ontologia", "gameday", "retencion", "diagnostico"] as const;
export type ForgeVerdictKind = (typeof FORGE_VERDICT_KINDS)[number];

/** The kinds that may open a compuerta — a WHITELIST (review NIT 5): an absent or unknown kind never opens. */
export const FORGE_OPENING_KINDS = ["mision", "expediente", "entrevista", "ontologia", "gameday"] as const;

export type ForgeScope = "local" | "nativa";
export type ForgeApoyo = "independiente" | "con_apoyo";

export interface ForgeVerdictFields {
  v: 1;
  kind: ForgeVerdictKind;
  /** the essential capabilities of the cell, taken by the client from the cell data */
  essential: ForgeCapability[];
  /** integer 0..4 per capability (scale of §05) */
  capabilities: Partial<Record<ForgeCapability, number>>;
  /** ≥ 1 */
  critical: { id: string; passed: boolean }[];
  failureMode: ForgeFailureMode | null;
  scope: ForgeScope;
  apoyo: ForgeApoyo;
  /** only with scope "nativa" (§7.4): the native result travels here, never in the top-level passed */
  nativePassed?: boolean;
}

/** Minimum essential score to pass (§05: «al menos 3 en sus capacidades esenciales»). */
export const FORGE_PASS_SCORE = 3;

const CAPS = new Set<string>(FORGE_CAPABILITIES);
const KINDS = new Set<string>(FORGE_VERDICT_KINDS);
const OPENING = new Set<string>(FORGE_OPENING_KINDS);

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

/**
 * The approval rule (RF-V1, RF-V2). `true` only when ALL of this holds, else `false`:
 * `v === 1`; a known `kind`; `scope` ∈ {local, nativa}; `apoyo` ∈ {independiente, con_apoyo}; a non-empty
 * `essential` list of known capabilities; every essential with an integer in [0, 4] that is ≥ 3; a
 * non-empty `critical` list where every element has a string id and `passed === true`.
 */
export function forgeVerdictPasses(f: unknown): boolean {
  if (!isRecord(f)) return false;
  if (f.v !== 1) return false;
  if (typeof f.kind !== "string" || !KINDS.has(f.kind)) return false;
  if (f.scope !== "local" && f.scope !== "nativa") return false;
  if (f.apoyo !== "independiente" && f.apoyo !== "con_apoyo") return false;
  const essential = f.essential;
  if (!Array.isArray(essential) || essential.length === 0) return false;
  const caps = f.capabilities;
  if (!isRecord(caps)) return false;
  for (const c of essential) {
    if (typeof c !== "string" || !CAPS.has(c)) return false;
    const score = caps[c];
    if (typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > 4) return false;
    if (score < FORGE_PASS_SCORE) return false;
  }
  const critical = f.critical;
  if (!Array.isArray(critical) || critical.length === 0) return false;
  for (const k of critical) {
    if (!isRecord(k) || typeof k.id !== "string" || !k.id || k.passed !== true) return false;
  }
  return true;
}

/** Only these kinds open a compuerta: retention and diagnosis never do, and neither does an absent or
 *  unknown kind (whitelist). Evaluated by the fold after forgeVerdictPasses already validated the shape. */
export function forgeKindOpens(f: unknown): boolean {
  return isRecord(f) && typeof f.kind === "string" && OPENING.has(f.kind);
}

/** Narrow an unknown payload field to the verdict fields when it at least has the right envelope
 *  (object with v === 1 and a known kind). Used by the fold to keep scope/apoyo/kind for the derivations;
 *  it does NOT decide approval (forgeVerdictPasses does). */
export function asForgeVerdict(f: unknown): ForgeVerdictFields | null {
  if (!isRecord(f) || f.v !== 1 || typeof f.kind !== "string" || !KINDS.has(f.kind)) return null;
  return f as unknown as ForgeVerdictFields;
}
