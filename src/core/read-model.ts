import type { GradeName } from "@/core/config";

export interface Goal {
  id: string;
  title: string;
  priority: number;
  color: string;
  sigil: string;
  archived: boolean;
}

export type ModuleStatus = "idle" | "started" | "completed";

export interface ModuleRM {
  id: string;
  goalId: string | null;
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
}

export interface Edge {
  from: string;
  to: string;
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

export interface ReadModel {
  goals: Goal[];
  modules: ModuleRM[];
  edges: Edge[];
  /** qualified-day ordinals (for "is today qualified" in presentation) */
  qualifiedDays: number[];
  stats: Stats;
  /** completed modules with their clock-free dueDays (spec §5) */
  reviewDue: ReviewItem[];
  cursor: { ts: number; id: string } | null;
}
