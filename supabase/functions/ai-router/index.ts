// ARCANUM AI router — Supabase Edge Function (Deno).
// ALL AI calls go through here. Keys live ONLY in the function secrets
// (OPENAI_API_KEY / ANTHROPIC_API_KEY via Deno.env.get) — never in the client,
// never hardcoded. The client invokes this authenticated with its Supabase JWT.
//
// Provider priority is CONFIG (the array), not hardcode — invert PROVIDER_PRIORITY
// to flip the primary. The fallback logic mirrors src/core/ai-router.ts (tested).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROVIDER_PRIORITY = ["openai", "anthropic"] as const;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Best-effort per-user rate limit (in-memory, per running instance).
const RATE = { windowMs: 60_000, max: 12 };
const hits = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const arr = (hits.get(userId) ?? []).filter((t) => now - t < RATE.windowMs);
  if (arr.length >= RATE.max) {
    hits.set(userId, arr);
    return true;
  }
  arr.push(now);
  hits.set(userId, arr);
  return false;
}

async function routeWithFallback<T>(
  providers: readonly string[],
  call: (p: string) => Promise<T>,
): Promise<{ provider: string; value: T }> {
  let lastErr: unknown;
  for (const provider of providers) {
    try {
      return { provider, value: await call(provider) };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("no AI provider available");
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function ocr(provider: string, imageDataUrl: string): Promise<string> {
  const instruction =
    "Transcribe esta página manuscrita a markdown limpio, conservando títulos, listas y estructura. Devuelve SOLO el markdown, sin explicaciones.";
  if (provider === "openai") {
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) throw new Error("OPENAI_API_KEY ausente");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: instruction },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`openai ${res.status}`);
    const j = await res.json();
    return j.choices?.[0]?.message?.content ?? "";
  }
  if (provider === "anthropic") {
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) throw new Error("ANTHROPIC_API_KEY ausente");
    const comma = imageDataUrl.indexOf(",");
    const mediaType = imageDataUrl.slice(5, imageDataUrl.indexOf(";"));
    const b64 = imageDataUrl.slice(comma + 1);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } },
              { type: "text", text: instruction },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const j = await res.json();
    return j.content?.[0]?.text ?? "";
  }
  throw new Error(`proveedor desconocido: ${provider}`);
}

async function sleep(provider: string, context: unknown): Promise<{ patterns: string; axioms: string }> {
  const prompt =
    "Eres el rito nocturno de un laboratorio de aprendizaje hermético, tono sobrio y ritual. " +
    "Te doy el contexto del aprendiz (JSON): digest = últimas 24h; reviewQueue = repasos vencidos (daysOverdue); " +
    "stalled = módulos EN CURSO sin avance (daysSinceReinforce); atRisk = prerrequisitos cuya retención cruza el umbral " +
    "de repaso pronto (daysToThreshold; negativo = ya por debajo) y que BLOQUEAN otros módulos (blocks[]). " +
    "Responde SOLO con JSON {\"patterns\": string, \"axioms\": string}. " +
    "'patterns' = 2-3 frases sobre los patrones del día. " +
    "'axioms' = 1-2 recomendaciones ESPECÍFICAS Y ACCIONABLES que citen módulos por nombre cuando el contexto lo permita " +
    "(p. ej. 'X cruza el umbral de repaso en 2 días y es prereq de Y — repásalo antes de seguir'). " +
    "Si no hay riesgos ni estancamientos, propón una conexión concreta entre las notas del día. " +
    `Contexto: ${JSON.stringify(context)}`;
  const parse = (text: string) => {
    try {
      const m = text.match(/\{[\s\S]*\}/);
      const o = JSON.parse(m ? m[0] : text);
      return { patterns: String(o.patterns ?? ""), axioms: String(o.axioms ?? "") };
    } catch {
      return { patterns: text.slice(0, 400), axioms: "" };
    }
  };
  if (provider === "openai") {
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) throw new Error("OPENAI_API_KEY ausente");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 600, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(`openai ${res.status}`);
    const j = await res.json();
    return parse(j.choices?.[0]?.message?.content ?? "");
  }
  if (provider === "anthropic") {
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) throw new Error("ANTHROPIC_API_KEY ausente");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-3-5-haiku-20241022", max_tokens: 600, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const j = await res.json();
    return parse(j.content?.[0]?.text ?? "");
  }
  throw new Error(`proveedor desconocido: ${provider}`);
}

async function evaluate(
  provider: string,
  context: unknown,
): Promise<{ summary: string; strengths: string[]; gaps: string[]; challenge: string }> {
  const prompt =
    "Eres un evaluador ADVERSARIAL-pero-justo de un laboratorio de aprendizaje, persona estilo Asuka: " +
    "exigente, directa, no regalas elogios ni respuestas, empujas al primer principio. Te doy el desempeño de " +
    "un módulo (JSON: título, status, retrievability 0-1, checkpoints y su media, errores resueltos, mejor " +
    "prueba de fuego, días activo). Responde SOLO con JSON " +
    '{"summary": string, "strengths": string[], "gaps": string[], "challenge": string}. ' +
    "summary: 1-2 frases directas de dónde está. strengths: SOLO lo que los datos respaldan (no inventes mérito). " +
    "gaps: lo que NO domina, sin suavizar. challenge: un reto concreto desde el primer principio sobre su punto " +
    "más débil — empújalo, NO le des la respuesta. Cero relleno, cero felicitaciones vacías. " +
    `Contexto: ${JSON.stringify(context)}`;
  const parse = (text: string) => {
    try {
      const m = text.match(/\{[\s\S]*\}/);
      const o = JSON.parse(m ? m[0] : text);
      return {
        summary: String(o.summary ?? ""),
        strengths: Array.isArray(o.strengths) ? o.strengths.map(String) : [],
        gaps: Array.isArray(o.gaps) ? o.gaps.map(String) : [],
        challenge: String(o.challenge ?? ""),
      };
    } catch {
      return { summary: text.slice(0, 300), strengths: [], gaps: [], challenge: "" };
    }
  };
  if (provider === "openai") {
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) throw new Error("OPENAI_API_KEY ausente");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 700, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(`openai ${res.status}`);
    const j = await res.json();
    return parse(j.choices?.[0]?.message?.content ?? "");
  }
  if (provider === "anthropic") {
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) throw new Error("ANTHROPIC_API_KEY ausente");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-3-5-haiku-20241022", max_tokens: 700, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const j = await res.json();
    return parse(j.content?.[0]?.text ?? "");
  }
  throw new Error(`proveedor desconocido: ${provider}`);
}

async function gate(
  provider: string,
  context: { cellTitle?: string; question?: string; rubric?: string[]; justification?: string; sourceRefs?: string[] },
): Promise<{ passed: boolean; score: number; summary: string; feedback: string }> {
  const prompt =
    "Eres el evaluador de la COMPUERTA DE SALIDA de una celda de aprendizaje, persona Asuka calibrada al 0.1% MUNDIAL " +
    "(no nacional). NO pasas una respuesta por ser correcta — pasas SOLO cuando la justificación es de PRIMER PRINCIPIO, " +
    "defendible frente a alguien de MIT. Te doy la celda, la pregunta, la RÚBRICA (criterios anclados a la fuente canónica, " +
    "p.ej. CLRS) y la JUSTIFICACIÓN del aprendiz. Califica la justificación contra CADA punto de la rúbrica. Responde SOLO " +
    'JSON {"passed": boolean, "score": number (0-1), "summary": string, "feedback": string}. passed=true SOLO si cubre los ' +
    "puntos CLAVE de la rúbrica con argumento de primer principio. ANTI-GAMING: justificación vacía, trivial, copiada, o que " +
    "solo NOMBRA el algoritmo sin DERIVAR → passed=false, score bajo. feedback: adversarial y accionable, cita QUÉ punto de la " +
    "rúbrica falló y por qué (reconocimiento BREVE, corrección DETALLADA), empuja al primer principio. Español. " +
    `CELDA: ${context.cellTitle ?? ""}. PREGUNTA: ${context.question ?? ""}. RÚBRICA: ${JSON.stringify(context.rubric ?? [])}. ` +
    `JUSTIFICACIÓN DEL APRENDIZ: ${context.justification ?? ""}`;
  const parse = (text: string) => {
    try {
      const m = text.match(/\{[\s\S]*\}/);
      const o = JSON.parse(m ? m[0] : text);
      const score = Number(o.score);
      return {
        passed: o.passed === true,
        score: Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0,
        summary: String(o.summary ?? ""),
        feedback: String(o.feedback ?? ""),
      };
    } catch {
      return { passed: false, score: 0, summary: "No evaluable.", feedback: text.slice(0, 300) };
    }
  };
  if (provider === "openai") {
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) throw new Error("OPENAI_API_KEY ausente");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 800, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(`openai ${res.status}`);
    const j = await res.json();
    return parse(j.choices?.[0]?.message?.content ?? "");
  }
  if (provider === "anthropic") {
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) throw new Error("ANTHROPIC_API_KEY ausente");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-3-5-haiku-20241022", max_tokens: 800, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const j = await res.json();
    return parse(j.content?.[0]?.text ?? "");
  }
  throw new Error(`proveedor desconocido: ${provider}`);
}

async function tutor(provider: string, context: { question?: string } & Record<string, unknown>): Promise<string> {
  const system =
    "Eres el tutor de ARCANUM, persona estilo Asuka: exigente, directa, adversarial al servicio " +
    "del aprendizaje. Tienes DOS modos SIMULTÁNEOS: (1) cuando el aprendiz de verdad necesita el " +
    "contenido, lo das rico, explicado a fondo y con el primer principio; (2) encima, FRICCIÓN — " +
    "'ahora dime por qué', no regalas la solución de un ejercicio, empujas a que la derive. " +
    "NUNCA des la respuesta final de un problema/tarea: guía con la pregunta correcta hasta que la " +
    "saque. Usa el CONTEXTO (tópico, su mastery %, prerrequisitos, y SUS PROPIAS NOTAS): sé " +
    "específico a dónde está; si una nota suya tiene un error, corrígelo sin suavizar. Responde en " +
    "markdown conciso, en español. CONTEXTO: " +
    JSON.stringify(context);
  const question = typeof context.question === "string" && context.question ? context.question : "(sin pregunta)";

  if (provider === "openai") {
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) throw new Error("OPENAI_API_KEY ausente");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 900,
        messages: [
          { role: "system", content: system },
          { role: "user", content: question },
        ],
      }),
    });
    if (!res.ok) throw new Error(`openai ${res.status}`);
    const j = await res.json();
    return j.choices?.[0]?.message?.content ?? "";
  }
  if (provider === "anthropic") {
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) throw new Error("ANTHROPIC_API_KEY ausente");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 900,
        system,
        messages: [{ role: "user", content: question }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const j = await res.json();
    return j.content?.[0]?.text ?? "";
  }
  throw new Error(`proveedor desconocido: ${provider}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return json({ error: "No autenticado." }, 401);
    if (rateLimited(user.id)) return json({ error: "Demasiadas solicitudes. Intenta en un minuto." }, 429);

    const body = await req.json();
    const providers: string[] = Array.isArray(body.providers) ? body.providers : [...PROVIDER_PRIORITY];

    if (body.action === "ocr") {
      if (typeof body.image !== "string") return json({ error: "Falta la imagen." }, 400);
      const r = await routeWithFallback(providers, (p) => ocr(p, body.image));
      return json({ provider: r.provider, markdown: r.value });
    }
    if (body.action === "sleep") {
      const ctx = body.context ?? body.digest; // back-compat: older clients sent `digest`
      const r = await routeWithFallback(providers, (p) => sleep(p, ctx));
      return json({ provider: r.provider, patterns: r.value.patterns, axioms: r.value.axioms });
    }
    if (body.action === "evaluate") {
      const r = await routeWithFallback(providers, (p) => evaluate(p, body.context));
      return json({ provider: r.provider, summary: r.value.summary, strengths: r.value.strengths, gaps: r.value.gaps, challenge: r.value.challenge });
    }
    if (body.action === "tutor") {
      const ctx = (body.context ?? {}) as { question?: string } & Record<string, unknown>;
      const r = await routeWithFallback(providers, (p) => tutor(p, ctx));
      return json({ provider: r.provider, answer: r.value });
    }
    if (body.action === "gate") {
      const r = await routeWithFallback(providers, (p) => gate(p, body.context ?? {}));
      return json({ provider: r.provider, passed: r.value.passed, score: r.value.score, summary: r.value.summary, feedback: r.value.feedback });
    }
    return json({ error: "Acción desconocida." }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    return json({ error: `IA no disponible: ${msg}` }, 503);
  }
});
