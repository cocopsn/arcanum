import type { GradeName } from "@/core/config";
import type { EntregaKey, Json, NodeNature, NodePart } from "@/core/event";
import type { ForgeEvidenceOutcome, ForgeEvidenceSource, ForgeEvidenceType } from "@/core/evidence";
import type { ForgeFailureMode, ForgeVerdictFields, ForgeVerdictKind } from "@/core/forge-verdict";

export interface Goal {
  id: string;
  title: string;
  priority: number;
  color: string;
  sigil: string;
  archived: boolean;
}

/**
 * A PATH — a parallel route inside a goal, with its OWN cells, DAG and fog-of-war.
 * Progress NEVER crosses paths (see roadmap.isRevealed): a concept mastered in path A does
 * not unseal path B. If the learner really owns it, the second path costs nothing; if not,
 * the repetition exposes it and reinforces — honest spaced repetition, never a placebo.
 */
export interface PathRM {
  id: string;
  goalId: string | null;
  slug: string;
  name: string;
  description: string;
  order: number;
  archived: boolean;
}

export type ModuleStatus = "idle" | "started" | "completed";

export interface ModuleRM {
  id: string;
  goalId: string | null;
  /** the PATH this cell lives in (null = legacy/unassigned). The DAG + fog-of-war are PER-PATH. */
  pathId: string | null;
  /** shareable concept tag → drives the informative cross-path "ya lo viste" note. Never unseals. */
  concept: string | null;
  /** structural nature — decides which gate fires (a_mano = defend; delegable = direct+audit) */
  nature: NodeNature;
  /** sub-parts with their own nature, for nature 'mixto' (empty otherwise) */
  parts: NodePart[];
  title: string;
  status: ModuleStatus;
  kind: string;
  prereqs: string[];
  /** mastery stability (days) — clock-free */
  S: number;
  /** last reinforced, epoch-days — clock-free */
  lastReinforcedDays: number;
  /** when r crosses reviewThreshold, epoch-days — clock-free */
  dueDays: number;
  /** epoch-days of module.started, or null */
  startedDays: number | null;
  archived: boolean;
  /** best firetest reached/ceiling ratio (for reveal), or null */
  firetestRatio: number | null;
  /** persisted canvas position (event-sourced), or null → auto-layout */
  x: number | null;
  y: number | null;
  /** Canvas obligation this module was ascended from (Fase 4), or null */
  sourceObligationId: string | null;
  /** the adversarial EXIT GATE has been passed (WHITE ROOM) — monotonic; once true
   *  the cell counts as mastered and unseals the next cell (fog-of-war) */
  gatePassed: boolean;
  /** count of checkpoint.passed reinforcements (lessons/reviews completed) — DRIVES the lesson
   *  angle rotation so course→depth→review never repeat. Derived from the log, monotonic. */
  reinforceCount: number;
}

export interface Edge {
  from: string;
  to: string;
  /** the path this edge lives in — DERIVED from the source cell at assemble (an edge is always
   *  intra-path). A stray cross-path edge is IGNORED by the fog-of-war, never honoured. */
  pathId?: string | null;
}

export interface Stats {
  totalXp: number;
  grade: GradeName;
  gradeIndex: number;
  currentStreak: number;
  longestStreak: number;
  shields: number;
  lastQualifiedDay: number | null;
}

export interface ReviewItem {
  moduleId: string;
  /** clock-free due time (epoch-days); presentation filters overdue vs now */
  dueDays: number;
}

export interface NoteRM {
  id: string;
  /** anchor: born inside a module, or loose at goal level */
  moduleId: string | null;
  goalId: string | null;
  title: string;
  /** raw Obsidian markdown — reconstructed from the log */
  markdown: string;
  /** [[wikilink]] target titles this note links to */
  links: string[];
  /** ids of notes that link to THIS note (bidirectional backlinks) */
  backlinks: string[];
  createdTs: number;
  updatedTs: number;
}

export interface SleepCycleRM {
  /** event id of the sleepcycle.generated event */
  id: string;
  day: string;
  ts: number;
  /** local 24h fold (DayDigest) */
  digest: Json;
  /** actionable context handed to the model (Fase 4), or null for old events */
  context: Json | null;
  /** AI enrichment, or null when no provider was available */
  ai: { provider: string; patterns: string; axioms: string } | null;
}

/**
 * A Canvas obligation (Fase 4) — compliance/deadline, NOT a mastery module. The
 * mastery graph is never contaminated by these; the user manually ASCENDS the ones
 * worth learning (a gesture that emits module.upserted with sourceObligationId).
 */
export interface ObligationRM {
  id: string;
  course: string;
  title: string;
  /** due date epoch ms, or null */
  dueTs: number | null;
  status: string;
  source: "canvas";
  url: string | null;
  /** when the surviving snapshot was scraped (epoch ms) — staleness in present() */
  fetchedTs: number;
  /** id of the module this obligation was ascended into, or null (derived) */
  promotedModuleId: string | null;
}

/** Latest EXIT GATE verdict for a cell (WHITE ROOM), folded from the log. */
export interface GateRM {
  moduleId: string;
  passed: boolean;
  score: number | null;
  summary: string;
  feedback: string;
  source: "ai" | "heuristic";
  provider: string | null;
  /** pointed questions the interrogator generated against the mission's real content
   *  (mission cells); empty for a pre-authored justify-gate */
  questions: string[];
  ts: number;
  /** Engineering Forge: the structured verdict, when the event carried one (absent otherwise) */
  forge?: ForgeVerdictFields;
}

/** Latest MISSION evidence submission for a heavy cell (kind:'mission'), folded from
 *  mission.submitted — the learner's own notes proving they lived the assigned source. */
export interface MissionRM {
  moduleId: string;
  notes: string;
  ts: number;
  /** Engineering Forge: the 9 sections of §16, only when the payload had exactly those 9 text keys */
  entrega?: Record<EntregaKey, string>;
  /** Engineering Forge: the declared support, only when it is one of the two values */
  apoyo?: "independiente" | "con_apoyo";
}

/** Engineering Forge: one `evidence.recorded`, in fold order (design §7.3). */
export interface EvidenceRM {
  id: string;
  moduleId: string;
  goalId: string | null;
  itemId: string;
  type: ForgeEvidenceType;
  phase: string;
  outcome: ForgeEvidenceOutcome;
  /** whole when its JSON is ≤ 4,096 characters, else `{ truncated: true, bytes }` */
  data: Json;
  source: ForgeEvidenceSource;
  provider: string | null;
  /** null without a verdict; with one, true only for AI + "aprobado" + a verdict that passes the rule */
  passed: boolean | null;
  ts: number;
}

/** Engineering Forge: every structured verdict, in fold order (design §7.3). `passed` can only be true
 *  when `source === "ai"`. */
export interface ForgeVerdictRM {
  moduleId: string;
  source: "ai" | "heuristic";
  passed: boolean;
  failureMode: ForgeFailureMode | null;
  scope: "local" | "nativa";
  apoyo: "independiente" | "con_apoyo";
  kind: ForgeVerdictKind;
  ts: number;
  eventId: string;
  /** the queue id of the event, or null; lets derivations count once a submission drained twice */
  queueId: string | null;
}

/** Latest adversarial evaluation of a module (Bloque 5), folded from the log. */
export interface EvaluationRM {
  moduleId: string;
  summary: string;
  strengths: string[];
  gaps: string[];
  challenge: string;
  score: number | null;
  source: "ai" | "heuristic";
  provider: string | null;
  ts: number;
}

/** Canvas connection health (Fase 4). Failure is a NORMAL state, never an error. */
export interface CanvasStatusRM {
  /** latest scrape ATTEMPT ts (ok or not), epoch ms — null if never */
  lastSyncTs: number | null;
  /** latest SUCCESSFUL scrape ts, epoch ms — null if never */
  lastOkTs: number | null;
  /** the latest attempt failed (cookie/session expired) → showing last good data */
  cookieStale: boolean;
}

export interface ReadModel {
  goals: Goal[];
  /** parallel routes per goal (each with its own cells + fog-of-war) */
  paths: PathRM[];
  modules: ModuleRM[];
  edges: Edge[];
  /** qualified-day ordinals (for "is today qualified" in presentation) */
  qualifiedDays: number[];
  stats: Stats;
  /** completed modules with their clock-free dueDays (spec §5) */
  reviewDue: ReviewItem[];
  /** Obsidian notes graph, content reconstructed from the log */
  notes: NoteRM[];
  /** Sleep Cycle digests, newest last (from sleepcycle.generated events) */
  sleepCycles: SleepCycleRM[];
  /** Canvas obligations (Fase 4), from the last successful scrape snapshot */
  obligations: ObligationRM[];
  /** Canvas connection health (Fase 4) */
  canvas: CanvasStatusRM;
  /** highest grade index whose ceremony was acknowledged in the LOG, or null if
   *  none yet — universe-wide (synced), so a grade celebrates exactly once (Fase 4) */
  celebratedGrade: number | null;
  /** latest evaluation per module (Bloque 5), folded from module.evaluated events */
  evaluations: EvaluationRM[];
  /** latest EXIT GATE verdict per cell (WHITE ROOM), folded from gate.evaluated */
  gates: GateRM[];
  /** latest MISSION evidence per heavy cell, folded from mission.submitted */
  missions: MissionRM[];
  /** AI actions enqueued offline and NOT yet resolved by a real verdict (ai.queued minus its
   *  resolving gate.evaluated) — the honest pending queue. Drives the "N pendientes" badge. */
  pendingAi: PendingAiRM[];
  /** Engineering Forge: every evidence.recorded, in fold order (never opens anything) */
  evidence: EvidenceRM[];
  /** Engineering Forge: every structured verdict (local and native), in fold order */
  forgeVerdicts: ForgeVerdictRM[];
  /** Engineering Forge: the latest NATIVE verdict per cell (never touches gates/gatePassed) */
  nativeGates: GateRM[];
  cursor: { ts: number; id: string } | null;
}

export interface PendingAiRM {
  queueId: string;
  kind: "gate" | "mission" | "forge";
  moduleId: string;
  goalId: string | null;
  /** the learner's preserved work — { justification } (gate) or { notes } (mission) */
  input: Json;
  /** when it was enqueued, epoch ms */
  ts: number;
}
