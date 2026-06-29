import { getSupabase } from "@/sync/client";

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
