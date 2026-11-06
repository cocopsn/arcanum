// ENGINEERING FORGE — `evidence.recorded` (design §7.2–§7.4). PURE: types, limits and the validation the
// fold applies. Evidence is a record of work (a prediction, a pass, a trace, an interview turn…). It NEVER
// opens a compuerta, never touches mastery, streak or XP: xpBase and isQualifying do not know the type.
import type { ArcanumEvent, Json } from "@/core/event";
import type { ForgeVerdictFields } from "@/core/forge-verdict";

/** Every evidence type. The 7 verdict kinds (mision, expediente, entrevista, ontologia, gameday,
 *  retencion, diagnostico) are valid types so the drain can resolve any queued submission (§10.6). */
export const FORGE_EVIDENCE_TYPES = [
  "prediccion",
  "desvanecido",
  "historial",
  "mutantes",
  "contraejemplo",
  "senal",
  "entrevista",
  "expediente",
  "retencion",
  "giro",
  "sql",
  "ontologia",
  "forense",
  "permisos",
  "recuperacion",
  "gameday",
  "code",
  "choice",
  "production",
  "observacion",
  "remediacion",
  "proyecto",
  "mision",
  "diagnostico",
] as const;
export type ForgeEvidenceType = (typeof FORGE_EVIDENCE_TYPES)[number];

export const FORGE_EVIDENCE_OUTCOMES = ["correcto", "incorrecto", "registrado", "aprobado", "reprobado"] as const;
export type ForgeEvidenceOutcome = (typeof FORGE_EVIDENCE_OUTCOMES)[number];

export const FORGE_EVIDENCE_SOURCES = ["local", "ai", "self"] as const;
export type ForgeEvidenceSource = (typeof FORGE_EVIDENCE_SOURCES)[number];

/** `itemId`: the `id:` line of the bank item, or a cell activity (e.g. "leccion-ligera"). */
export const EVIDENCE_ITEM_ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
/** `phase` is a short free label (respuesta, hueco, turno, pasada-1, leccion, invalida…). */
export const EVIDENCE_PHASE_MAX = 32;
/** The serialized `data` is rejected at mint time above this size (characters of its JSON). */
export const EVIDENCE_DATA_MAX = 100_000;
/** The read model keeps `data` whole up to this size (characters of its JSON); above it, a stub. */
export const EVIDENCE_RM_DATA_MAX = 4_096;

export interface EvidenceRecordedPayload {
  itemId: string;
  type: ForgeEvidenceType;
  phase: string;
  outcome: ForgeEvidenceOutcome;
  /** type-specific; ≤ EVIDENCE_DATA_MAX characters serialized */
  data: Json;
  source: ForgeEvidenceSource;
  provider?: string | null;
  /** only on AI-judged evidence (retention in defence, diagnostic reading, discovery…) */
  verdict?: ForgeVerdictFields;
  /** resolves an ai.queued */
  queueId?: string;
}

const TYPES = new Set<string>(FORGE_EVIDENCE_TYPES);
const OUTCOMES = new Set<string>(FORGE_EVIDENCE_OUTCOMES);
const SOURCES = new Set<string>(FORGE_EVIDENCE_SOURCES);

/** The fold's gate: module_id, itemId with its regex, a short phase, and known type, outcome and source.
 *  An event that fails is ignored by the fold (never throws). */
export function validEvidence(e: Pick<ArcanumEvent, "module_id" | "payload">): boolean {
  if (typeof e.module_id !== "string" || !e.module_id) return false;
  const p = e.payload as unknown;
  if (!p || typeof p !== "object" || Array.isArray(p)) return false;
  const q = p as Record<string, unknown>;
  if (typeof q.itemId !== "string" || !EVIDENCE_ITEM_ID_RE.test(q.itemId)) return false;
  if (typeof q.phase !== "string" || q.phase.length === 0 || q.phase.length > EVIDENCE_PHASE_MAX) return false;
  if (typeof q.type !== "string" || !TYPES.has(q.type)) return false;
  if (typeof q.outcome !== "string" || !OUTCOMES.has(q.outcome)) return false;
  if (typeof q.source !== "string" || !SOURCES.has(q.source)) return false;
  return true;
}

/** Mint-time check (the client calls it before writing): the same rules as the fold plus the size of
 *  `data`. Returns the reason, or null when the payload may be written. */
export function evidencePayloadError(p: unknown): string | null {
  if (!validEvidence({ module_id: "x", payload: p as Json })) return "evidencia inválida (itemId, phase, type, outcome o source)";
  const json = JSON.stringify((p as Record<string, unknown>).data ?? null);
  if (json.length > EVIDENCE_DATA_MAX) return `la evidencia mide ${json.length} caracteres; el límite es ${EVIDENCE_DATA_MAX}`;
  return null;
}

function utf8Bytes(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

/** What the read model keeps of `data`: whole when its JSON is ≤ 4,096 characters, else
 *  `{ truncated: true, bytes }` (the UI reads the full payload from the log). Depends only on size, so it
 *  is identical on the incremental path and on a rebuild. */
export function evidenceDataForRm(data: unknown): Json {
  const json = JSON.stringify(data ?? null) ?? "null";
  if (json.length <= EVIDENCE_RM_DATA_MAX) return (data ?? null) as Json;
  return { truncated: true, bytes: utf8Bytes(json) };
}
