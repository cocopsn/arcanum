// ARCANUM AI router — Supabase Edge Function (Deno).
// ALL AI calls go through here. Keys live ONLY in the function secrets
// (OPENAI_API_KEY / KEE_* / ANTHROPIC_API_KEY via Deno.env.get) — never in the
// client, never hardcoded. The client invokes this authenticated with its JWT.
//
// Provider priority is CONFIG (the array), not hardcode. DEFAULT = OpenAI
// gpt-4o-mini PRIMARY, Kee (the learner's own RAG agent) as FALLBACK. We do NOT
// depend on Kee: if it is unconfigured it simply throws and the router has
// already answered via OpenAI. `anthropic` stays implemented but OFF the default
// chain — reachable only via an explicit `providers` override. Fallback logic
// mirrors src/core/ai-router.ts (tested).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROVIDER_PRIORITY = ["openai", "kee"] as const;

// ── Kee as a FALLBACK provider ─────────────────────────────────────────────
// Inert until KEE_ENDPOINT is set as a function secret. It then receives the
// SAME action envelope the client sends ({action, ...payload}) and must return
// the canonical shape for that action (contract documented in AGENT.md). Throws
// when unconfigured so the router degrades honestly — never a placebo answer.
async function keeCall(
  action: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const endpoint = Deno.env.get("KEE_ENDPOINT");
  if (!endpoint) throw new Error("KEE_ENDPOINT ausente (fallback Kee no configurado)");
  const key = Deno.env.get("KEE_API_KEY");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) throw new Error(`kee ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

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
  if (provider === "kee") {
    const j = await keeCall("ocr", { image: imageDataUrl });
    return String(j.markdown ?? "");
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
  if (provider === "kee") {
    const j = await keeCall("sleep", { context });
    return { patterns: String(j.patterns ?? ""), axioms: String(j.axioms ?? "") };
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
  if (provider === "kee") {
    const j = await keeCall("evaluate", { context });
    return {
      summary: String(j.summary ?? ""),
      strengths: Array.isArray(j.strengths) ? j.strengths.map(String) : [],
      gaps: Array.isArray(j.gaps) ? j.gaps.map(String) : [],
      challenge: String(j.challenge ?? ""),
    };
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
  if (provider === "kee") {
    const j = await keeCall("gate", { context });
    const score = Number(j.score);
    return {
      passed: j.passed === true,
      score: Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0,
      summary: String(j.summary ?? ""),
      feedback: String(j.feedback ?? ""),
    };
  }
  throw new Error(`proveedor desconocido: ${provider}`);
}

async function interrogate(
  provider: string,
  context: { cellTitle?: string; assignment?: string; deliverable?: string; sourceRefs?: string[]; notes?: string; mode?: string },
): Promise<{ questions: string[]; passed: boolean; score: number; summary: string; feedback: string }> {
  // The COMPETITIVE (ICPC) gate is a different nature: pattern recognition + efficiency under the
  // clock, NOT first-principle derivation. The real judge is Codeforces/AtCoder — we never pretend
  // to run code. Default mode = first-principle (FrED/ITC missions).
  const head =
    context.mode === "pattern"
      ? "Eres el INTERROGADOR de una celda de PROGRAMACIÓN COMPETITIVA (ICPC), persona Asuka. CONTEXTO CRÍTICO: " +
        "el juez REAL es Codeforces/AtCoder (accepted/TLE/WA + tiempo) — tú NO ejecutas código ni finges un juez. El " +
        "aprendiz resolvió un problema EN la plataforma real y trae su VEREDICTO + su solución + el tiempo. Tu trabajo " +
        "NO es primer principio: es RECONOCIMIENTO DE PATRÓN y EFICIENCIA bajo reloj. (1) GENERA de 3 a 5 preguntas " +
        "PUNTUALES de reconocimiento-de-patrón y complejidad sobre ESE problema/patrón: ¿qué señal del enunciado delata " +
        "el patrón?, ¿por qué ESE patrón y no otro (p. ej. binary search on answer vs two pointers)?, ¿qué complejidad " +
        "tenía su solución y por qué pasó o dio TLE?, ¿qué estructura/idea baja la cota (p. ej. O(n²)→O(n log n))? Las " +
        "preguntas son la SONDA. (2) JUZGA: ¿demuestra que RECONOCIÓ el patrón y entiende POR QUÉ su complejidad " +
        "funciona, o solo trae un accepted? passed=true si explica el patrón y la eficiencia con claridad de competidor; " +
        "NO exijas derivación formal de primer principio (esta espina es reflejo entrenado, no comprensión tipo MIT). " +
        "ANTI-GAMING CRÍTICO: un 'accepted' SIN poder explicar por qué aplica el patrón ni su complejidad → passed=false " +
        "(pudo COPIAR la solución/editorial). Vago, 'lo saqué del editorial sin entender', o no justificar la elección " +
        "del patrón → passed=false. Responde SOLO JSON " +
        '{"questions": string[], "passed": boolean, "score": number (0-1), "summary": string, "feedback": string}. ' +
        "feedback en español, adversarial y accionable: si reprobó, di qué patrón/eficiencia NO demostró; si pasó, " +
        "nombra el siguiente patrón a entrenar. "
      : "Eres el INTERROGADOR de una MISIÓN DIRIGIDA de aprendizaje, persona Asuka calibrada al 0.1% MUNDIAL " +
        "(no nacional). Al aprendiz se le ordenó vivir una fuente canónica REAL y específica (abajo) y volver con " +
        "evidencia: SUS notas y reflexiones. Tu trabajo: (1) GENERA de 3 a 5 preguntas PUNTUALES y ESPECÍFICAS al " +
        "contenido REAL de ESA lecture/fuente concreta — no genéricas, JAMÁS '¿qué aprendiste?'; preguntas que solo " +
        "alguien que de verdad la trabajó podría responder desde el primer principio (mecanismos, porqués, casos límite " +
        "de ESE material). Las preguntas son la SONDA que se le muestra al aprendiz. (2) JUZGA la EVIDENCIA: ¿demuestra " +
        "comprensión de PRIMER PRINCIPIO del NÚCLEO de esa lecture, defendible ante un examinador de MIT? passed=true si " +
        "el aprendiz DERIVA correctamente los mecanismos centrales (no solo los nombra) y razona desde el porqué — AUNQUE " +
        "no haya cubierto preventivamente cada pregunta que generaste. El veredicto es sobre la PROFUNDIDAD y CORRECCIÓN " +
        "del razonamiento sobre el núcleo, NO sobre haber respondido las 5 preguntas. NO repruebes evidencia genuinamente " +
        "fuerte y de primer principio solo porque no tocó un detalle tangencial. El estándar 0.1% es exigente pero " +
        "ALCANZABLE para trabajo excelente de primer principio. ANTI-GAMING: repruebas (passed=false, score bajo) lo " +
        "genérico, vago, memorizado-sin-derivar, evasivo, vacío o trivial/copiado. Responde SOLO JSON " +
        '{"questions": string[], "passed": boolean, "score": number (0-1), "summary": string, "feedback": string}. ' +
        "feedback: adversarial y accionable, en español (reconocimiento BREVE si hubo mérito real, corrección DETALLADA); " +
        "si reprobó, di QUÉ le falta al razonamiento del núcleo; si pasó, nombra la siguiente profundización. Empuja al " +
        "primer principio. ";
  const prompt =
    head +
    `MISIÓN (celda): ${context.cellTitle ?? ""}. ASIGNACIÓN: ${context.assignment ?? ""}. ENTREGABLE PEDIDO: ` +
    `${context.deliverable ?? ""}. FUENTE(S) CANÓNICA(S): ${JSON.stringify(context.sourceRefs ?? [])}. ` +
    `EVIDENCIA ENTREGADA POR EL APRENDIZ: ${context.notes ?? ""}`;
  const parse = (text: string) => {
    try {
      const m = text.match(/\{[\s\S]*\}/);
      const o = JSON.parse(m ? m[0] : text);
      const score = Number(o.score);
      return {
        questions: Array.isArray(o.questions) ? o.questions.map(String) : [],
        passed: o.passed === true,
        score: Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0,
        summary: String(o.summary ?? ""),
        feedback: String(o.feedback ?? ""),
      };
    } catch {
      return { questions: [], passed: false, score: 0, summary: "No evaluable.", feedback: text.slice(0, 300) };
    }
  };
  if (provider === "openai") {
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) throw new Error("OPENAI_API_KEY ausente");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 900, messages: [{ role: "user", content: prompt }] }),
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
      body: JSON.stringify({ model: "claude-3-5-haiku-20241022", max_tokens: 900, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const j = await res.json();
    return parse(j.content?.[0]?.text ?? "");
  }
  if (provider === "kee") {
    const j = await keeCall("interrogate", { context });
    const score = Number(j.score);
    return {
      questions: Array.isArray(j.questions) ? j.questions.map(String) : [],
      passed: j.passed === true,
      score: Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0,
      summary: String(j.summary ?? ""),
      feedback: String(j.feedback ?? ""),
    };
  }
  throw new Error(`proveedor desconocido: ${provider}`);
}

// Capa B — the step-by-step LIGHT lesson (full-screen mode). Two phases:
//  steps → teach the concept against the cell's real source + design N escalating micro-challenges.
//  grade → score ONE step's answer FAIRLY (reinforces; it is NOT the 0.1% exit gate). Reused per step
//          AND for the amor-fati CORRECTION (a missed step's re-answer is graded the same way).
// Never invents fixed academic facts: teaches the canonical concept and points at the real source.
async function lesson(
  provider: string,
  context: { phase?: string; cellTitle?: string; sourceRefs?: string[]; challenge?: string; rubric?: string[]; answer?: string; stepsMin?: number; stepsMax?: number },
): Promise<Record<string, unknown>> {
  const isGrade = context.phase === "grade";
  const lo = Number.isFinite(context.stepsMin) ? Number(context.stepsMin) : 5;
  const hi = Number.isFinite(context.stepsMax) ? Number(context.stepsMax) : 7;
  const prompt = isGrade
    ? "Eres el tutor Asuka calificando la respuesta a UN PASO de una lección contra su rúbrica. Exigente pero JUSTO: " +
      "esto REFUERZA el aprendizaje, NO es la compuerta de élite del 0.1%. Da score 0-1 según cuánto demuestra " +
      "entendimiento de PRIMER PRINCIPIO (no memorización), y feedback adversarial-pero-útil que, si falló, explique " +
      "POR QUÉ está mal (anclado al reto) y empuje al porqué. ANTI-GAMING: respuesta vacía/trivial/evasiva o que solo " +
      "repite el reto → understood:false y score bajo. Responde SOLO JSON " +
      '{"score": number (0-1), "understood": boolean, "feedback": string}, en español. ' +
      `RETO: ${context.challenge ?? ""}. RÚBRICA: ${JSON.stringify(context.rubric ?? [])}. RESPUESTA DEL APRENDIZ: ${context.answer ?? ""}`
    : "Eres el tutor Asuka generando una LECCIÓN PASO A PASO (estilo Duolingo con alma, ~15-25 min) sobre el tópico de " +
      "una celda, anclada a su FUENTE canónica REAL (abajo). Primero enseña el concepto central desde el PRIMER " +
      "PRINCIPIO (markdown conciso, el porqué — no un resumen de viñetas). Luego diseña ENTRE " + lo + " Y " + hi +
      " PASOS que ESCALAN en dificultad: cada paso es UN micro-reto que exige PENSAR (justificar, completar, " +
      "elegir-y-explicar, implementar un fragmento, o producir), NUNCA reconocimiento trivial de opción múltiple sola. " +
      "Cada paso trae una rúbrica de 2-4 criterios de una buena respuesta. NO inventes hechos: si no tienes el detalle " +
      "exacto de la fuente, enseña el concepto canónico y remite a la fuente real. Responde SOLO JSON " +
      '{"concept": string (markdown conciso), "steps": [{"prompt": string, "rubric": string[]}]}, en español. ' +
      `CELDA: ${context.cellTitle ?? ""}. FUENTE(S) REAL(ES): ${JSON.stringify(context.sourceRefs ?? [])}`;
  const parse = (text: string): Record<string, unknown> => {
    try {
      const m = text.match(/\{[\s\S]*\}/);
      const o = JSON.parse(m ? m[0] : text);
      if (isGrade) {
        const score = Number(o.score);
        const understood = o.understood === true;
        // An UNDERSTOOD step with no measurable score is NOT a 0 — it's a non-grade. Null it (sentinel)
        // so the run never reinforces/advances on an un-measured pass nor drags the average down with a 0.
        if (understood && !Number.isFinite(score)) return { error: "grade-parse-failed" };
        return {
          score: Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0,
          understood,
          feedback: String(o.feedback ?? ""),
        };
      }
      const steps = Array.isArray(o.steps)
        ? o.steps
            .map((s: { prompt?: unknown; rubric?: unknown }) => ({
              prompt: String(s?.prompt ?? ""),
              rubric: Array.isArray(s?.rubric) ? s.rubric.map(String) : [],
            }))
            .filter((s: { prompt: string }) => s.prompt.length > 0)
        : [];
      // No usable steps == a failed generation; signal an error so the client degrades honestly
      // (no half-built lesson with an empty step list).
      if (!String(o.concept ?? "").trim() || steps.length === 0) return { error: "steps-empty" };
      return { concept: String(o.concept), steps };
    } catch {
      // A GRADE that didn't parse is NOT a grade of 0 — returning {score:0} would reinforce mastery
      // on garbage. Signal an error so the client nulls and reinforces/advances on NOTHING.
      return isGrade ? { error: "grade-parse-failed" } : { error: "steps-parse-failed" };
    }
  };
  const maxTokens = isGrade ? 600 : 2000;
  if (provider === "openai") {
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) throw new Error("OPENAI_API_KEY ausente");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
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
      body: JSON.stringify({ model: "claude-3-5-haiku-20241022", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const j = await res.json();
    return parse(j.content?.[0]?.text ?? "");
  }
  if (provider === "kee") {
    const j = await keeCall("lesson", { context });
    if (isGrade) {
      const score = Number(j.score);
      const understood = j.understood === true;
      if (understood && !Number.isFinite(score)) return { error: "grade-parse-failed" };
      return {
        score: Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0,
        understood,
        feedback: String(j.feedback ?? ""),
      };
    }
    const steps = Array.isArray(j.steps)
      ? j.steps
          .map((s: { prompt?: unknown; rubric?: unknown }) => ({
            prompt: String(s?.prompt ?? ""),
            rubric: Array.isArray(s?.rubric) ? s.rubric.map(String) : [],
          }))
          .filter((s: { prompt: string }) => s.prompt.length > 0)
      : [];
    if (!String(j.concept ?? "").trim() || steps.length === 0) return { error: "steps-empty" };
    return { concept: String(j.concept), steps };
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
  if (provider === "kee") {
    const j = await keeCall("tutor", { context });
    return String(j.answer ?? "");
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
    if (body.action === "lesson") {
      const r = await routeWithFallback(providers, (p) => lesson(p, body.context ?? {}));
      return json({ provider: r.provider, ...r.value });
    }
    if (body.action === "gate") {
      const r = await routeWithFallback(providers, (p) => gate(p, body.context ?? {}));
      return json({ provider: r.provider, passed: r.value.passed, score: r.value.score, summary: r.value.summary, feedback: r.value.feedback });
    }
    if (body.action === "interrogate") {
      const r = await routeWithFallback(providers, (p) => interrogate(p, body.context ?? {}));
      return json({
        provider: r.provider,
        questions: r.value.questions,
        passed: r.value.passed,
        score: r.value.score,
        summary: r.value.summary,
        feedback: r.value.feedback,
      });
    }
    return json({ error: "Acción desconocida." }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    return json({ error: `IA no disponible: ${msg}` }, 503);
  }
});
