import type { ReadModel } from "@/core/read-model";
import { retrievability } from "@/core/mastery";
import { msToDays } from "@/core/time";
import { prereqsOf } from "@/core/roadmap";
import { contentForModule } from "@/lib/subject-content";

// RAG retrieval for the per-module tutor (Bloque 6, Kee pattern). Local-first: the
// context is RETRIEVED from the projected read-model (notes, mastery, prereqs, topic)
// on the CLIENT, then the Edge Function ARMS the adversarial prompt and calls the
// model. Pure; `nowMs` explicit. See AGENT.md for the agent design + the future
// door to a direct Kee integration.

export interface TutorNote {
  title: string;
  excerpt: string;
}

export interface TutorContext {
  question: string;
  topicTitle: string;
  /** authored topic summary, or null if none curated */
  topicSummary: string | null;
  status: string;
  masteryPct: number;
  prereqTitles: string[];
  /** the user's own notes for this module — the retrieval core of the RAG */
  notes: TutorNote[];
}

const EXCERPT = 280;

export function buildTutorContext(rm: ReadModel, moduleId: string, question: string, nowMs: number): TutorContext | null {
  const m = rm.modules.find((x) => x.id === moduleId);
  if (!m) return null;
  const nowDays = msToDays(nowMs);
  const byId = new Map(rm.modules.map((x) => [x.id, x]));

  const prereqTitles = prereqsOf(moduleId, rm.edges)
    .map((pid) => byId.get(pid)?.title)
    .filter((t): t is string => Boolean(t));

  const notes: TutorNote[] = rm.notes
    .filter((n) => n.moduleId === moduleId)
    .map((n) => ({
      title: n.title || "(sin título)",
      excerpt: n.markdown.replace(/\s+/g, " ").trim().slice(0, EXCERPT),
    }));

  return {
    question: question.trim(),
    topicTitle: m.title,
    topicSummary: contentForModule(moduleId)?.summary ?? null,
    status: m.status,
    masteryPct: Math.round(retrievability(m.S, m.lastReinforcedDays, nowDays) * 100),
    prereqTitles,
    notes,
  };
}
