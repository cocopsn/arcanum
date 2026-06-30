import { getSupabase } from "@/sync/client";
import { normalizeLessonCourse, type LessonCourse } from "@/lib/lesson";

export interface OcrResult {
  markdown: string;
  provider: string;
}

/** OCR a handwritten page via the Edge Function. Requires a session (AI in cloud). */
export async function ocrImage(dataUrl: string): Promise<OcrResult> {
  const sb = getSupabase();
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session) throw new Error("Inicia sesión para usar OCR — la IA corre en la nube.");
  const { data, error } = await sb.functions.invoke("ai-router", {
    body: { action: "ocr", image: dataUrl },
  });
  if (error) throw new Error(error.message || "El OCR falló. Reintenta.");
  if (data?.error) throw new Error(data.error);
  if (!data?.markdown) throw new Error("El OCR no devolvió texto.");
  return { markdown: data.markdown as string, provider: data.provider as string };
}

export interface SleepEnrichment {
  patterns: string;
  axioms: string;
  provider: string;
}

export interface AiVerdict {
  summary: string;
  strengths: string[];
  gaps: string[];
  challenge: string;
  provider: string;
}

/** Adversarial AI evaluation of a module (Bloque 5). Returns null on ANY failure
 *  (no session/keys/error) → the caller falls back to the local heuristic. */
export async function requestModuleEvaluation(context: unknown): Promise<AiVerdict | null> {
  try {
    const sb = getSupabase();
    const {
      data: { session },
    } = await sb.auth.getSession();
    if (!session) return null;
    const { data, error } = await sb.functions.invoke("ai-router", {
      body: { action: "evaluate", context },
    });
    if (error || data?.error || !data?.summary) return null;
    return {
      summary: String(data.summary),
      strengths: Array.isArray(data.strengths) ? data.strengths.map(String) : [],
      gaps: Array.isArray(data.gaps) ? data.gaps.map(String) : [],
      challenge: typeof data.challenge === "string" ? data.challenge : "",
      provider: String(data.provider ?? "ai"),
    };
  } catch {
    return null;
  }
}

export interface GateReply {
  passed: boolean;
  score: number;
  summary: string;
  feedback: string;
  provider: string;
}

/** Adversarial EXIT-GATE evaluation (WHITE ROOM). The evaluator grades the learner's
 *  justification against the cell rubric and decides pass/fail. null on ANY failure
 *  (no session/keys/error) → caller falls back to the honest heuristic (which never
 *  auto-passes). */
export async function requestGateEvaluation(context: unknown): Promise<GateReply | null> {
  try {
    const sb = getSupabase();
    const {
      data: { session },
    } = await sb.auth.getSession();
    if (!session) return null;
    const { data, error } = await sb.functions.invoke("ai-router", {
      body: { action: "gate", context },
    });
    if (error || data?.error || typeof data?.passed !== "boolean") return null;
    return {
      passed: data.passed === true,
      score: typeof data.score === "number" ? data.score : 0,
      summary: String(data.summary ?? ""),
      feedback: String(data.feedback ?? ""),
      provider: String(data.provider ?? "ai"),
    };
  } catch {
    return null;
  }
}

export interface InterrogationReply {
  /** the pointed questions the interrogator generated against the mission's real content */
  questions: string[];
  passed: boolean;
  score: number;
  summary: string;
  feedback: string;
  provider: string;
}

/** Adversarial MISSION INTERROGATION (directed loop). The Asuka interrogator generates
 *  pointed questions against the mission's real lecture content and judges the learner's
 *  submitted evidence (pass/fail). null on ANY failure (no session/keys/error) → caller
 *  falls back to the honest heuristic, which NEVER auto-passes. */
export async function requestInterrogation(context: unknown): Promise<InterrogationReply | null> {
  try {
    const sb = getSupabase();
    const {
      data: { session },
    } = await sb.auth.getSession();
    if (!session) return null;
    const { data, error } = await sb.functions.invoke("ai-router", {
      body: { action: "interrogate", context },
    });
    if (error || data?.error || typeof data?.passed !== "boolean") return null;
    return {
      questions: Array.isArray(data.questions) ? data.questions.map(String) : [],
      passed: data.passed === true,
      score: typeof data.score === "number" ? data.score : 0,
      summary: String(data.summary ?? ""),
      feedback: String(data.feedback ?? ""),
      provider: String(data.provider ?? "ai"),
    };
  } catch {
    return null;
  }
}

export interface LessonCourseReply extends LessonCourse {
  provider: string;
}

/** Capa B — generate a step-by-step LIGHT lesson (concept + N micro-challenges) against the cell's
 *  real source, for the full-screen lesson mode. null on ANY failure → the UI degrades honestly
 *  (no invented lesson; the real source still works). The wire shape is trusted in ONE pure place
 *  (normalizeLessonCourse) so it is unit-testable. */
export async function requestLessonSteps(context: unknown): Promise<LessonCourseReply | null> {
  try {
    const sb = getSupabase();
    const {
      data: { session },
    } = await sb.auth.getSession();
    if (!session) return null;
    const { data, error } = await sb.functions.invoke("ai-router", {
      body: { action: "lesson", context: { ...(context as object), phase: "steps" } },
    });
    if (error || data?.error) return null;
    const course = normalizeLessonCourse(data);
    if (!course) return null;
    return { ...course, provider: String(data.provider ?? "ai") };
  } catch {
    return null;
  }
}

export interface LessonGrade {
  score: number;
  understood: boolean;
  feedback: string;
  provider: string;
}

/** Capa B — grade a light-lesson answer FAIRLY (reinforces; not the 0.1% exit gate). null on
 *  ANY failure → caller does NOT reinforce (no placebo XP). */
export async function requestLessonGrade(context: unknown): Promise<LessonGrade | null> {
  try {
    const sb = getSupabase();
    const {
      data: { session },
    } = await sb.auth.getSession();
    if (!session) return null;
    const { data, error } = await sb.functions.invoke("ai-router", {
      body: { action: "lesson", context: { ...(context as object), phase: "grade" } },
    });
    if (error || data?.error || typeof data?.score !== "number") return null;
    return {
      score: typeof data.score === "number" ? data.score : 0,
      understood: data.understood === true,
      feedback: String(data.feedback ?? ""),
      provider: String(data.provider ?? "ai"),
    };
  } catch {
    return null;
  }
}

export interface TutorReply {
  answer: string;
  provider: string;
}

/** Per-module adversarial tutor (Bloque 6). The RAG context is retrieved on the
 *  client (local-first) and passed in; the Edge Function arms the Asuka-style prompt
 *  and calls the model. Returns null on ANY failure → caller degrades honestly. */
export async function askTutor(context: unknown): Promise<TutorReply | null> {
  try {
    const sb = getSupabase();
    const {
      data: { session },
    } = await sb.auth.getSession();
    if (!session) return null;
    const { data, error } = await sb.functions.invoke("ai-router", {
      body: { action: "tutor", context },
    });
    if (error || data?.error || !data?.answer) return null;
    return { answer: String(data.answer), provider: String(data.provider ?? "ai") };
  } catch {
    return null;
  }
}

/** AI digest enrichment. `context` is the rich SleepContext (24h fold + review
 *  queue + stalled + at-risk prereqs) so the model can be SPECIFIC and actionable.
 *  Returns null on ANY failure (no session/keys/error) — the Sleep Cycle still
 *  produces its local fold. Honest degradation, no placebo. */
export async function enrichSleepCycle(context: unknown): Promise<SleepEnrichment | null> {
  try {
    const sb = getSupabase();
    const {
      data: { session },
    } = await sb.auth.getSession();
    if (!session) return null;
    const { data, error } = await sb.functions.invoke("ai-router", {
      body: { action: "sleep", context },
    });
    if (error || data?.error || !data?.patterns) return null;
    return {
      patterns: data.patterns as string,
      axioms: (data.axioms as string) ?? "",
      provider: data.provider as string,
    };
  } catch {
    return null;
  }
}
