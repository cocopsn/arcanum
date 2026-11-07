// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { makeEvent, type ArcanumEvent } from "@/core/event";
import { evidencePayloadError } from "@/core/evidence";
import { FORGE_GOAL_ID } from "@/core/forge-verdict";
import { askSimulatedUser, type SimulatedUserRequest, type SimulatedUserResult } from "@/forge/ai-port";
import type { ForgeItemOf } from "@/forge/bank/registry";
import { forgeCellId, forgeCodeForCellId } from "@/forge/ids";
import {
  INTERVIEW_CONTEXT_MAX,
  INTERVIEW_TEXTS,
  buildInterviewContext,
  interviewResultFrom,
  interviewTurnPayload,
  interviewTurnsFrom,
  type InterviewTurn,
} from "@/forge/interview-context";
import { parseExercisesMd } from "@/lib/exercises-md";

// THE CLIENT SIDE OF forge_interview (design-poblar §9.4 and §9.5, anexo-r2 [9] and [23]). Each protection has a
// finding that names it; the red-checks mutate src/forge/interview-context.ts itself and are recorded in
// redchecks-interview.md. The Edge's validateForgeInterview runs here from its source text (the Edge is Deno code),
// so «passes the limits of §9.1» means the Edge's own rules, not a copy of them.

type EdgeCheck = (raw: unknown) => { ok: boolean; field?: string };
function edgeValidator(source: string): EdgeCheck {
  const js = ts
    .transpileModule(source.replace(/^import [^\n]*\n/m, ""), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    })
    .outputText.replace(/^export \{\};?\s*$/m, "");
  const Deno = { env: { get: () => undefined }, serve: () => {} };
  const noNetwork = () => {
    throw new Error("la prueba no usa la red");
  };
  return new Function("Deno", "fetch", "createClient", js + "\nreturn validateForgeInterview;")(Deno, noNetwork, () => ({})) as EdgeCheck;
}
const validate = edgeValidator(readFileSync(join(process.cwd(), "supabase", "functions", "ai-router", "index.ts"), "utf8"));

const CELL = forgeCellId("F1-03");
const ITEM: ForgeItemOf<"entrevista"> = {
  id: `${CELL}:entrevista-ops`,
  kind: "forge",
  moduleId: CELL,
  itemId: "entrevista-ops",
  rol: "practica",
  title: "Discovery con operaciones",
  statement: "La planta quiere reducir paros.",
  source: "curated",
  type: "entrevista",
  data: {
    fases: { preguntas: 10, estructuracion: 10, defensa: 10 },
    personas: [
      { id: "ana", nombre: "Ana", rol: "jefa de planta", estilo: "directa" },
      { id: "luis", nombre: "Luis", rol: "operador nocturno", estilo: "breve" },
    ],
    hechos: [
      { id: "turnos", persona: "ana", texto: "La planta trabaja tres turnos.", oculto: false, revela_si: "" },
      { id: "nocturno", persona: "luis", texto: "El turno nocturno no registra paros.", oculto: true, revela_si: "pregunta por turnos" },
    ],
    entregable: "Una página con problema, usuario y vertical mínima.",
    rubrica: ["Descubre el hecho del turno nocturno."],
  },
};
const chars = (n: number, c = "a") => c.repeat(n);
const REQ: SimulatedUserRequest = { cellCode: "F1-03", itemId: "entrevista-ops", fase: "preguntas", persona: "luis", question: "¿Qué pasa de noche?" };

/** An item with every field of §9.1 at its maximum and `n` facts. */
function maxedItem(n: number): ForgeItemOf<"entrevista"> {
  const pid = (i: number) => `${i}`.padEnd(64, "p");
  return {
    ...ITEM,
    statement: chars(4000),
    data: {
      ...ITEM.data,
      personas: Array.from({ length: 6 }, (_, i) => ({ id: pid(i), nombre: chars(80), rol: chars(200), estilo: chars(400) })),
      hechos: Array.from({ length: n }, (_, i) => ({ id: `${i}`.padEnd(64, "h"), persona: pid(i % 6), texto: chars(400), oculto: true, revela_si: chars(400) })),
    },
  };
}

let errors: { mockRestore: () => void } | null = null;
function quietConsole() {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  errors = spy;
  return spy;
}
afterEach(() => {
  errors?.mockRestore();
  errors = null;
});

// ── the trim (§9.4, §9.5) ────────────────────────────────────────────────────────────────────────────────────────────

/** 20 turns of 2,200 characters: trimmed to ≤ 38,000 from the oldest, keeping the last one and no more than needed. */
export function trimFindings(): string[] {
  const out: string[] = [];
  const turns: InterviewTurn[] = Array.from({ length: 20 }, (_, i) => ({ persona: "luis", q: `${i}`.padEnd(1000, "q"), reply: `${i}`.padEnd(1200, "r") }));
  const built = buildInterviewContext(ITEM, turns, { fase: "preguntas", persona: "luis", question: "¿Y de noche?" });
  if (!built.ok) return ["buildInterviewContext rechazó una conversación que cabe recortada"];
  const n = JSON.stringify(built.context).length;
  if (n > INTERVIEW_CONTEXT_MAX) out.push(`forge_interview envió ${n} caracteres y la Edge lo rechaza`);
  const v = validate(built.context);
  if (!v.ok) out.push(`la Edge rechaza el contexto recortado (${v.field})`);
  const kept = built.context.transcript;
  const last = kept[kept.length - 1];
  if (!last || last.q !== turns[19]!.q || last.reply !== turns[19]!.reply) out.push("buildInterviewContext perdió la última vuelta");
  if (kept.map((t) => t.q).join("|") !== turns.slice(turns.length - kept.length).map((t) => t.q).join("|")) {
    out.push("buildInterviewContext no quitó primero las vueltas más antiguas");
  }
  const older = turns[turns.length - kept.length - 1];
  if (older && JSON.stringify({ ...built.context, transcript: [older, ...kept] }).length <= INTERVIEW_CONTEXT_MAX) {
    out.push("buildInterviewContext quitó más vueltas de las necesarias");
  }
  const many = buildInterviewContext(ITEM, Array.from({ length: 25 }, (_, i) => ({ q: `q${i}`, reply: `r${i}` })), { fase: "preguntas", question: "¿?" });
  if (!many.ok || many.context.transcript.length !== 20 || many.context.transcript[0]!.q !== "q5") out.push("buildInterviewContext mandó más de 20 vueltas");
  return out;
}

/** A sheet that does not fit even without turns: no context, the bank's motive, and the code and item in the console. */
export function sheetFindings(): string[] {
  const out: string[] = [];
  const spy = quietConsole();
  const r = buildInterviewContext(maxedItem(30), [], { fase: "preguntas", question: "¿?" });
  if (r.ok) out.push("una hoja de hechos que no cabe se mandó a la Edge");
  else if (r.motivo !== INTERVIEW_TEXTS.hojaGrande) out.push("una hoja de hechos que no cabe no dice que es demasiado grande");
  const logged = spy.mock.calls.map((c) => c.map(String).join(" ")).join("\n");
  if (!logged.includes("F1-03") || !logged.includes("entrevista-ops")) out.push("la hoja demasiado grande no deja en la consola el código y el ítem");
  return out;
}

// ── persona (anexo-r2 [9]) ───────────────────────────────────────────────────────────────────────────────────────────

/** To whom each question goes travels in the context, is kept in the turn and is read back from the log. */
export function personaFindings(): string[] {
  const out: string[] = [];
  const built = buildInterviewContext(ITEM, [{ persona: "ana", q: "¿Cuántos turnos?", reply: "Tres." }], { fase: "preguntas", persona: "luis", question: "¿Y de noche?" });
  if (!built.ok || built.context.persona !== "luis") out.push("buildInterviewContext no dice a quién va la pregunta");
  if (!built.ok || built.context.transcript[0]?.persona !== "ana") out.push("buildInterviewContext perdió a quién iba cada pregunta");
  const payload = interviewTurnPayload(REQ, { reply: "De noche no se anota.", revealed: ["nocturno"] });
  if (evidencePayloadError(payload) !== null) out.push("el turno de la entrevista no es una evidencia válida");
  const data = payload.data as Record<string, unknown>;
  if (data.persona !== "luis") out.push("el turno de la entrevista no guarda a quién iba la pregunta");
  if (data.q !== REQ.question || data.reply !== "De noche no se anota." || JSON.stringify(data.revealed) !== '["nocturno"]') out.push("el turno de la entrevista no guarda la pregunta, la respuesta y lo revelado");
  const ev = (p: unknown, moduleId = CELL, ts = 1): ArcanumEvent =>
    makeEvent("evidence.recorded", p as ArcanumEvent["payload"], { ts, deviceId: "d", goalId: FORGE_GOAL_ID, moduleId });
  const events = [
    ev(payload, CELL, 1),
    ev(interviewTurnPayload({ ...REQ, persona: undefined, question: "¿Y los lunes?" }, { reply: "Se captura todo.", revealed: [] }), CELL, 2),
    ev({ ...payload, itemId: "otra-entrevista" }, CELL, 3),
    ev(payload, forgeCellId("F1-02"), 4),
    ev({ ...payload, phase: "respuesta" }, CELL, 5),
    ev({ ...payload, source: "local" }, CELL, 6),
  ];
  const turns = interviewTurnsFrom(events, CELL, "entrevista-ops");
  if (JSON.stringify(turns.map((t) => t.q)) !== JSON.stringify([REQ.question, "¿Y los lunes?"])) out.push("interviewTurnsFrom leyó turnos de otro ítem, otra celda, otra fase u otra fuente");
  if (turns[0]?.persona !== "luis" || turns[1]?.persona !== undefined) out.push("interviewTurnsFrom perdió a quién iba cada pregunta");
  const again = buildInterviewContext(ITEM, turns, { fase: "preguntas", question: "¿Y los turnos de fin de semana?" });
  if (!again.ok || again.context.transcript[0]?.persona !== "luis" || validate(again.context).ok !== true) out.push("la persona de un turno guardado no vuelve al contexto");
  return out;
}

// ── the Edge's answer (§9.4) ─────────────────────────────────────────────────────────────────────────────────────────

const BLOCK = "El proveedor de IA bloqueó el contenido por su política de seguridad (jailbreak); reformúlalo.";
const NO_DISPONIBLE: SimulatedUserResult = { estado: "sin-ia", motivo: INTERVIEW_TEXTS.noDisponible };
/** [what, status, body, expected, the finding when it is painted otherwise] */
const ANSWERS: [string, number, unknown, SimulatedUserResult, string][] = [
  [
    "una respuesta válida",
    200,
    { provider: "azure", reply: "De noche no se anota.", revealed: ["nocturno", 7] },
    { estado: "respuesta", reply: "De noche no se anota.", revealed: ["nocturno"] },
    "una respuesta válida del usuario simulado no se pintó",
  ],
  ["un 200 sin reply", 200, { provider: "azure", revealed: ["nocturno"] }, NO_DISPONIBLE, "interviewResultFrom inventó una respuesta con un 200 sin reply"],
  ["un 200 con reply vacío", 200, { provider: "azure", reply: "  ", revealed: [] }, NO_DISPONIBLE, "interviewResultFrom inventó una respuesta con un 200 sin reply"],
  ["sin red", 0, null, { estado: "sin-ia", motivo: INTERVIEW_TEXTS.sinRed }, "sin red no se dijo que el usuario simulado necesita conexión"],
  ["una Edge sin la acción", 400, { error: "Acción desconocida." }, { estado: "sin-ia", motivo: INTERVIEW_TEXTS.edgeVieja }, "una Edge sin forge_interview no se pintó con el texto de hoy"],
  [
    "un 400 de validación",
    400,
    { error: "Entrada inválida: question" },
    { estado: "sin-ia", motivo: "No se pudo enviar la pregunta (question)" },
    "un 400 de validación se pintó como evaluador no disponible",
  ],
  [
    "un 400 por tamaño",
    400,
    { error: "Entrada inválida: tamaño" },
    { estado: "sin-ia", motivo: "No se pudo enviar la pregunta (tamaño)" },
    "un 400 de validación se pintó como evaluador no disponible",
  ],
  ["un bloqueo", 422, { error: BLOCK }, { estado: "bloqueado", motivo: BLOCK }, "un bloqueo del filtro de contenido se pintó como otra cosa"],
  ["el límite", 429, { error: "Demasiadas solicitudes. Intenta en un minuto." }, { estado: "limite", reintentaEnS: 60 }, "el límite de solicitudes no dijo cuándo reintentar"],
  ["sin sesión", 401, { error: "No autenticado." }, NO_DISPONIBLE, "una falla del evaluador no se pintó como evaluador no disponible"],
  ["la IA caída", 503, { error: "IA no disponible: azure 503" }, NO_DISPONIBLE, "una falla del evaluador no se pintó como evaluador no disponible"],
  ["otro 400", 400, { error: "Falta la imagen." }, NO_DISPONIBLE, "una falla del evaluador no se pintó como evaluador no disponible"],
  ["un cuerpo que no es JSON", 502, "<html>Bad gateway</html>", NO_DISPONIBLE, "una falla del evaluador no se pintó como evaluador no disponible"],
];

export function answerFindings(): string[] {
  const out: string[] = [];
  const spy = quietConsole();
  for (const [, status, body, want, finding] of ANSWERS) {
    if (JSON.stringify(interviewResultFrom(status, body)) !== JSON.stringify(want)) out.push(finding);
  }
  const logged = spy.mock.calls.map((c) => c.map(String).join(" ")).join("\n");
  if (!logged.includes("question") || !logged.includes("tamaño")) out.push("un 400 de validación no dejó su campo en la consola");
  return [...new Set(out)];
}

// ── the real interview items ([23]) ──────────────────────────────────────────────────────────────────────────────────

/** Every `entrevista` item of the Forge banks in content/forge/exercises. */
function realInterviewItems(): { file: string; item: ForgeItemOf<"entrevista"> }[] {
  const dir = join(process.cwd(), "content", "forge", "exercises");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .flatMap((file) =>
      (parseExercisesMd(readFileSync(join(dir, file), "utf8"))?.exercises ?? [])
        .filter((e) => (e as { type?: unknown }).type === "entrevista")
        .map((e) => ({ file, item: e as unknown as ForgeItemOf<"entrevista"> })),
    );
}

/** Each item's context without turns passes the Edge's own §9.1 rules, addressed to each persona, and measures
 *  ≤ 37,000 characters so a question of 1,000 still fits under 38,000. */
export function realItemFindings(items: { file: string; item: ForgeItemOf<"entrevista"> }[], max = 37_000): string[] {
  const out: string[] = [];
  if (items.length === 0) out.push("no hay ítems entrevista en los bancos: la prueba no mide nada");
  for (const { file, item } of items) {
    const name = `${forgeCodeForCellId(item.moduleId) ?? file} · ${item.itemId}`;
    for (const p of item.data.personas) {
      const built = buildInterviewContext(item, [], { fase: "preguntas", persona: p.id, question: "?" });
      if (!built.ok) {
        out.push(`el ítem entrevista ${name} no cabe en el contexto`);
        break;
      }
      const v = validate(built.context);
      if (!v.ok) out.push(`el ítem entrevista ${name} no pasa los límites de la Edge (${v.field})`);
      const n = JSON.stringify(built.context).length;
      if (n > max) out.push(`el contexto sin vueltas de ${name} mide ${n} caracteres (más de ${max})`);
    }
  }
  return [...new Set(out)];
}

describe("forge_interview · el lado del cliente (design-poblar §9.4, anexo-r2 [9] y [23])", () => {
  it("20 vueltas de 2,200 caracteres se recortan a ≤ 38,000 desde la más antigua, conservan la última y no pasan de 20", () => {
    expect(trimFindings()).toEqual([]);
  });

  it("una hoja de hechos que no cabe ni sin vueltas no se manda: motivo del banco y código e ítem en la consola", () => {
    expect(sheetFindings()).toEqual([]);
  });

  it("a quién va cada pregunta viaja en el contexto, queda en el turno y vuelve del log", () => {
    expect(personaFindings()).toEqual([]);
  });

  it("la respuesta de la Edge se pinta según la tabla de §9.4", () => {
    expect(answerFindings()).toEqual([]);
  });

  it("el texto de una Edge sin la acción es el del stub de askSimulatedUser, que sigue en stub", async () => {
    const r = await askSimulatedUser(REQ);
    expect(r).toEqual({ estado: "sin-ia", motivo: INTERVIEW_TEXTS.edgeVieja });
  });

  it("cada ítem entrevista real pasa los límites de la Edge sin vueltas y mide ≤ 37,000 caracteres", () => {
    const items = realInterviewItems();
    expect(realItemFindings(items)).toEqual([]);
    expect(items.length, "ítems entrevista en los bancos").toBeGreaterThanOrEqual(1);
  }, 30_000); // reads and parses the 128 banks (D14)

  it("los límites por campo de §9.1 suman más que el total: una hoja al máximo con 29 hechos pasa de 37,000 y el hallazgo la nombra", () => {
    const item = maxedItem(29);
    const built = buildInterviewContext(item, [], { fase: "preguntas", question: "?" });
    expect(built.ok).toBe(true);
    const n = built.ok ? JSON.stringify(built.context).length : 0;
    expect(n).toBeGreaterThan(37_000);
    expect(n).toBeLessThanOrEqual(INTERVIEW_CONTEXT_MAX);
    const f = realItemFindings([{ file: "sintetico.md", item }]);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatch(/^el contexto sin vueltas de F1-03 · entrevista-ops mide \d+ caracteres \(más de 37000\)$/);
  });
});
