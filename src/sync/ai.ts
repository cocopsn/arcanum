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
