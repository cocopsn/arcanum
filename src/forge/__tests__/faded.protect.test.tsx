import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { makeEvent } from "@/core/event";
import { remediationRequired } from "@/forge/model/remediation";
import type { EvidenceRM } from "@/core/read-model";
import {
  autoOkFor,
  codeSteps,
  currentLevel,
  fillTemplate,
  gradeFadedCode,
  huecoCabe,
  HUECO_PROSA_MAX,
  levelHoles,
  proseSteps,
  templateSegments,
  visibleCodeSteps,
} from "@/forge/eval/faded";
import { realForgeItem } from "@/forge/__tests__/fixtures/evaluator-blocks";
import { execRunner } from "@/forge/__tests__/helpers/exec-runner";
import { createEnvelope, type Envelope } from "@/forge/__tests__/helpers/flow-envelope";

vi.mock("@/app/providers", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).providersMock);

import DesvanecidoRunner from "@/forge/ui/exercises/DesvanecidoRunner";

const DCELL = "cf000000-0000-4000-8000-0000000000b2";

// b · desvanecido (design §5.3, §11.1). Protections, each with its red-check in tools/redcheck-specs.json:
//  rc08 the level only rises with a correct «nivel» evidence of the current level; rc09 a hidden region's code never
//  appears in a fixed segment; rc46 a prose answer the read model would truncate cannot be sent.

const CELL = "cf000000-0000-4000-8000-0000000000aa";
const ITEM = "a1-01-desv-frontera";
const T0 = Date.UTC(2026, 10, 10, 15, 0, 0);
let n = 0;
const ev = (over: Partial<EvidenceRM>): EvidenceRM => ({
  id: `c8000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  moduleId: CELL,
  goalId: null,
  itemId: ITEM,
  type: "desvanecido",
  phase: "nivel",
  outcome: "correcto",
  data: { nivel: 1 },
  source: "local",
  provider: null,
  passed: null,
  ts: T0,
  ...over,
});
const a101 = () => realForgeItem("A1-01", ITEM, "desvanecido").data;

describe("desvanecido · currentLevel", () => {
  it("diez intentos de código incorrectos y un día después siguen en el nivel 1", () => {
    const evidence = Array.from({ length: 10 }, (_, i) => ev({ phase: "codigo", outcome: "incorrecto", data: { nivel: 1, pasan: 0, total: 7, correcto: false }, ts: T0 + 86_400_000 + i }));
    expect(currentLevel(evidence, CELL, ITEM), "el nivel subió sin completar bien el nivel actual").toBe(1);
  });
  it("sube sólo con «nivel» correcto del nivel actual y no salta niveles (comportamiento)", () => {
    expect(currentLevel([], CELL, ITEM)).toBe(1);
    expect(currentLevel([ev({ data: { nivel: 1 } })], CELL, ITEM)).toBe(2);
    expect(currentLevel([ev({ data: { nivel: 2 } })], CELL, ITEM)).toBe(1);
    expect(currentLevel([ev({ data: { nivel: 1 } }), ev({ data: { nivel: 3 } })], CELL, ITEM)).toBe(2);
    expect(currentLevel([ev({ data: { nivel: 1 } }), ev({ data: { nivel: 2 } })], CELL, ITEM)).toBe(3);
    expect(currentLevel([ev({ data: { nivel: 1 }, outcome: "incorrecto" })], CELL, ITEM)).toBe(1);
    expect(currentLevel([ev({ data: { nivel: 1 }, moduleId: "otra" })], CELL, ITEM)).toBe(1);
    expect(currentLevel([ev({ data: { nivel: 1 }, itemId: "otro-item" })], CELL, ITEM)).toBe(1);
    expect(currentLevel([ev({ data: { truncated: true, bytes: 5000 } })], CELL, ITEM)).toBe(1);
  });
});

describe("desvanecido · plantilla por trozos", () => {
  it("con el paso 3 oculto, su código no aparece en ningún trozo fijo", () => {
    const d = a101();
    const segs = templateSegments(d.plantilla!.code, "js", new Set([3]));
    const fijos = segs.filter((s) => s.kind === "fijo").map((s) => (s as { text: string }).text);
    expect(fijos.some((t) => t.includes("lo = mid + 1")), "el código de referencia de un hueco apareció antes de aprobar el nivel").toBe(false);
    expect(segs.filter((s) => s.kind === "hueco")).toEqual([{ kind: "hueco", paso: 3 }]);
    expect(fijos.join("\n")).toContain("const mid = lo + Math.floor((hi - lo) / 2);");
    expect(fijos.join("\n")).not.toContain("<paso");
  });
  it("los pasos visibles por nivel salen de los huecos del nivel actual (comportamiento)", () => {
    const d = a101();
    expect(codeSteps(d)).toEqual([1, 2, 3, 4]);
    expect(proseSteps(d)).toEqual([5]);
    expect(levelHoles(d, 2)).toEqual({ codigo: [3], prosa: [5] });
    expect(levelHoles(d, 4)).toEqual({ codigo: [], prosa: [] });
    expect(visibleCodeSteps(d, 3)).toEqual([2]);
    expect(visibleCodeSteps(d, 4)).toEqual([1, 2, 3, 4]);
  });
  it("fillTemplate y gradeFadedCode sobre el nivel 1 de A1-01, con el código bueno y con <= (comportamiento)", async () => {
    const d = a101();
    const bueno = { 3: "    if (a[mid] < x) lo = mid + 1;\n    else hi = mid;" };
    const prog = fillTemplate(d.plantilla!.code, "js", bueno);
    expect(prog).toContain("// <paso 3>\n    if (a[mid] < x) lo = mid + 1;\n    else hi = mid;\n    // </paso 3>");
    expect(await gradeFadedCode(d, bueno, execRunner)).toMatchObject({ estado: "calificada", correcto: true, pasan: 7, total: 7 });
    const malo = await gradeFadedCode(d, { 3: "    if (a[mid] <= x) lo = mid + 1;\n    else hi = mid;" }, execRunner);
    expect(malo).toMatchObject({ estado: "calificada", correcto: false, total: 7 });
    if (malo.estado === "calificada") expect(malo.primerFallo).toBeDefined();
    expect(await gradeFadedCode(d, { 3: "    if (a[mid] < x lo = mid + 1;" }, execRunner)).toMatchObject({ estado: "sintaxis" });
  });
});

describe("desvanecido · autoverificación y tamaño de la prosa", () => {
  it("autoOkFor sólo cuenta la autoverificación correcta del mismo nivel (comportamiento)", () => {
    const auto = (nivel: number, outcome: "correcto" | "incorrecto") => ev({ phase: "autoverificacion", outcome, source: "self", data: { nivel, marcados: [0] } });
    expect(autoOkFor([auto(2, "correcto")], CELL, ITEM, 2)).toBe(true);
    expect(autoOkFor([auto(1, "correcto")], CELL, ITEM, 2)).toBe(false);
    expect(autoOkFor([auto(2, "incorrecto")], CELL, ITEM, 2)).toBe(false);
    expect(autoOkFor([ev({ phase: "nivel", data: { nivel: 2 } })], CELL, ITEM, 2)).toBe(false);
  });
  it("una respuesta de prosa que el read model truncaría no se puede enviar", () => {
    const muchos = "\n".repeat(1_100) + "a".repeat(HUECO_PROSA_MAX - 1_100);
    expect(muchos.length).toBe(3_000);
    expect(huecoCabe({ nivel: 2, paso: 5, respuesta: muchos }), "una respuesta de prosa que el read model truncaría se pudo enviar").toBe(false);
  });
  it("3,000 caracteres con 200 saltos sí caben (comportamiento)", () => {
    const pocos = "\n".repeat(200) + "a".repeat(HUECO_PROSA_MAX - 200);
    expect(huecoCabe({ nivel: 2, paso: 5, respuesta: pocos })).toBe(true);
  });
});

// ── DOM (§11.2.4) ───────────────────────────────────────────────────────────────────────────────────────────────

const BUENO_P3 = "    if (a[mid] < x) lo = mid + 1;\n    else hi = mid;";
const MALO_P3 = "    if (a[mid] <= x) lo = mid + 1;\n    else hi = mid;";
const GOAL = "cf000000-0000-4000-8000-0000000000b0";

const nivelEv = (nivel: number, ts: number, source: "local" | "self" = "local") =>
  makeEvent("evidence.recorded", { itemId: ITEM, type: "desvanecido", phase: "nivel", outcome: "correcto", data: { nivel }, source }, { ts, deviceId: "seed", goalId: GOAL, moduleId: DCELL });
const gateFail = (ts: number, queueId: string) =>
  makeEvent(
    "gate.evaluated",
    { passed: false, score: 0.2, summary: "", feedback: "", source: "ai", provider: "azure", queueId, forge: { v: 1, kind: "mision", essential: ["sistemas"], capabilities: { sistemas: 2 }, critical: [{ id: "consistencia", passed: false }], failureMode: "tutorial", scope: "local", apoyo: "independiente" } },
    { ts, deviceId: "seed", goalId: GOAL, moduleId: DCELL },
  );

async function seedRemediation(env: Envelope) {
  // a goal + module + two ai failed verdicts with failureMode "tutorial" and distinct queueId → remediation open
  await env.store.getState().dispatch(makeEvent("goal.upserted", { goal_id: GOAL, title: "G", priority: 1, color: "#fff", sigil: "g" }, { ts: 1, deviceId: "seed" }), 1);
  await env.store.getState().dispatch(makeEvent("module.upserted", { title: "C", prereqs: [], kind: "core" }, { ts: 2, deviceId: "seed", goalId: GOAL, moduleId: DCELL }), 2);
  await env.store.getState().dispatch(gateFail(10, "q-1"), 10);
  await env.store.getState().dispatch(gateFail(11, "q-2"), 11);
}

function mountDesv(env: Envelope) {
  const item = realForgeItem("A1-01", ITEM, "desvanecido");
  return { item, view: env.mount(DesvanecidoRunner as never, { item, cellCode: "A1-01", cellId: DCELL, readModel: env.store.getState().readModel, onClose: () => {} } as never) };
}
const bodyText = () => document.body.textContent ?? "";
const flush = async () => {
  for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0));
};

describe("desvanecido · interfaz (DOM §11.2.4)", () => {
  afterEach(() => cleanup());

  it("no importa la vía de IA (lectura del fuente)", () => {
    const src = readFileSync("src/forge/ui/exercises/DesvanecidoRunner.tsx", "utf8") + readFileSync("src/forge/eval/faded.ts", "utf8");
    expect(/@\/forge\/ai-port|@\/forge\/ai\b|@\/lib\/ai/.test(src), "desvanecido importa la vía de IA").toBe(false);
  });

  it("el código de un hueco del nivel actual no aparece por haber aprobado un nivel anterior (rc44)", async () => {
    const env = await createEnvelope();
    await env.store.getState().dispatch(nivelEv(1, 100), 100);
    await env.store.getState().dispatch(nivelEv(2, 101, "self"), 101); // niveles 1 y 2 aprobados → nivel 3
    mountDesv(env);
    expect(currentLevel(env.store.getState().readModel.evidence, DCELL, ITEM)).toBe(3);
    // nivel 3 oculta 1, 3, 4 y 5; nivel 2 oculta sólo 3. El código del paso 1 (`let lo = 0;`) y del 4 (`return lo;`)
    // son huecos del nivel 3: si `hidden` saliera del nivel anterior, aparecerían como andamio.
    expect(bodyText(), "el código de un hueco del nivel actual apareció por haber aprobado un nivel anterior").not.toContain("let lo = 0");
    expect(bodyText(), "el código de un hueco del nivel actual apareció por haber aprobado un nivel anterior").not.toContain("return lo;");
  });

  const tieneNivel = (env: Envelope, nivel: number) =>
    env.store.getState().readModel.evidence.some((e) => e.phase === "nivel" && typeof e.data === "object" && e.data !== null && (e.data as { nivel?: number }).nivel === nivel);

  it("un nivel con código que falla no se aprueba aunque la autoverificación esté completa (rc92)", async () => {
    const env = await createEnvelope();
    await env.store.getState().dispatch(nivelEv(1, 100), 100); // en nivel 2 (oculta 3 código y 5 prosa)
    mountDesv(env);
    fireEvent.change(screen.getByLabelText("Paso 3 (código)"), { target: { value: MALO_P3 } });
    fireEvent.change(screen.getByLabelText("Paso 5 (en prosa)"), { target: { value: "El bucle termina porque el rango se achica." } });
    fireEvent.click(screen.getByRole("button", { name: /Comprobar nivel/ }));
    await waitFor(() => expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0));
    for (const cb of screen.getAllByRole("checkbox")) fireEvent.click(cb);
    fireEvent.click(screen.getByRole("button", { name: /Confirmar autoverificación/ }));
    await flush();
    expect(tieneNivel(env, 2), "un nivel se aprobó con el código de sus huecos fallando").toBe(false);
  });

  it("un nivel no se aprueba sin la autoverificación completa (rc93) y luego se aprueba con las dos (rc10, rc33)", async () => {
    const env = await createEnvelope();
    await env.store.getState().dispatch(nivelEv(1, 100), 100);
    mountDesv(env);
    fireEvent.change(screen.getByLabelText("Paso 3 (código)"), { target: { value: BUENO_P3 } });
    fireEvent.change(screen.getByLabelText("Paso 5 (en prosa)"), { target: { value: "El bucle termina porque el rango se achica." } });
    fireEvent.click(screen.getByRole("button", { name: /Comprobar nivel/ }));
    await waitFor(() => expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0));
    // marca sólo un criterio: la autoverificación queda incompleta
    fireEvent.click(screen.getAllByRole("checkbox")[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Confirmar autoverificación/ }));
    await flush();
    expect(tieneNivel(env, 2), "un nivel se aprobó sin la autoverificación completa").toBe(false);
    // marca el resto y confirma → ahora sí «nivel» 2, source self, sin XP
    for (const cb of screen.getAllByRole("checkbox").slice(1)) fireEvent.click(cb);
    fireEvent.click(screen.getByRole("button", { name: /Confirmar autoverificación/ }));
    await waitFor(() => expect(tieneNivel(env, 2)).toBe(true));
    const nivel2 = env.store.getState().readModel.evidence.find((e) => e.phase === "nivel" && (e.data as { nivel?: number }).nivel === 2)!;
    expect(nivel2.source, "un nivel con prosa autoverificada quedó como evidencia local").toBe("self");
    expect((await env.events()).some((e) => e.type === "checkpoint.passed"), "la autoverificación dio XP").toBe(false);
  });

  it("no se puede confirmar la autoverificación antes de registrar la prosa (rc99)", async () => {
    const env = await createEnvelope();
    await env.store.getState().dispatch(nivelEv(1, 100), 100);
    mountDesv(env);
    const btn = screen.getByRole("button", { name: /Confirmar autoverificación/ }) as HTMLButtonElement;
    expect(btn.disabled, "se pudo confirmar la autoverificación antes de registrar la respuesta de prosa").toBe(true);
  });

  it("el texto modelo de un hueco de prosa no aparece antes de registrar la respuesta (rc37)", async () => {
    const env = await createEnvelope();
    await env.store.getState().dispatch(nivelEv(1, 100), 100);
    const { item } = mountDesv(env);
    const modelo = item.data.pasos[4]!; // paso 5, en prosa
    expect(bodyText(), "el texto modelo de un hueco de prosa apareció antes de registrar tu respuesta").not.toContain(modelo);
    fireEvent.change(screen.getByLabelText("Paso 3 (código)"), { target: { value: BUENO_P3 } });
    fireEvent.change(screen.getByLabelText("Paso 5 (en prosa)"), { target: { value: "El bucle termina porque el rango se achica." } });
    fireEvent.click(screen.getByRole("button", { name: /Comprobar nivel/ }));
    await waitFor(() => expect(bodyText()).toContain(modelo));
  });

  it("un nivel con prosa no cumple la remediación (rc43)", async () => {
    const env = await createEnvelope();
    await seedRemediation(env);
    await env.store.getState().dispatch(nivelEv(1, 5), 5); // ts anterior a los gate.evaluated
    const rm0 = env.store.getState().readModel;
    expect(remediationRequired(DCELL, rm0, ["desvanecido"]), "la remediación no está abierta en modo tutorial").not.toBeNull();
    mountDesv(env);
    fireEvent.change(screen.getByLabelText("Paso 3 (código)"), { target: { value: BUENO_P3 } });
    fireEvent.change(screen.getByLabelText("Paso 5 (en prosa)"), { target: { value: "El bucle termina porque el rango se achica." } });
    fireEvent.click(screen.getByRole("button", { name: /Comprobar nivel/ }));
    await waitFor(() => expect(env.store.getState().readModel.evidence.some((e) => e.phase === "hueco")).toBe(true));
    await waitFor(() => expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0));
    for (const cb of screen.getAllByRole("checkbox")) fireEvent.click(cb);
    fireEvent.click(screen.getByRole("button", { name: /Confirmar autoverificación/ }));
    await waitFor(() => expect(env.store.getState().readModel.evidence.some((e) => e.phase === "nivel" && (e.data as { nivel?: number }).nivel === 2)).toBe(true));
    expect(remediationRequired(DCELL, env.store.getState().readModel, ["desvanecido"]), "un nivel con prosa cumplió la remediación").not.toBeNull();
  });
});
