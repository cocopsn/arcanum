import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { parseExercisesMd } from "@/lib/exercises-md";
import type { ForgeBankItem } from "@/forge/bank/registry";
import type { OntologyModel } from "@/forge/bank/types/ontologia";
import { verifyOntology } from "@/forge/eval/ontology";
import { check } from "@/forge/bank/check/ontologia";
import { bankMd } from "@/forge/__tests__/fixtures/forge-blocks";
import { createEnvelope, type Envelope } from "@/forge/__tests__/helpers/flow-envelope";
import OntologiaRunner from "@/forge/ui/exercises/OntologiaRunner";
import { draftKey } from "@/forge/ui/OntologyEditor";

vi.mock("@/app/providers", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).providersMock);
vi.mock("@/forge/ai-port", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).aiPortMock);

// PROTECTION of `ontologia` (design §9.3 l, CA-32): the structural result comes from the verifier; «Entregar el modelo»
// and «Pedir defensa» stay disabled while there are findings; the author's reference is not in the DOM before the
// delivery is in the log; the ingestion check rejects a reference with findings.

const CELL_ID = "cf000000-0000-4000-8000-0000000000aa";

const BLOCK = `## Reasigna turnos
type: ontologia
id: onto-turnos

La jefa de guardia reasigna turnos cuando falta personal.

### Decisiones
~~~json
[{ "id": "d1", "texto": "Ver qué turnos quedan sin cubrir" }, { "id": "d2", "texto": "Reasignar un turno a otra persona" }]
~~~

### Fuentes
~~~json
[{ "id": "tabla_turnos", "nombre": "turnos_raw", "columnas": ["turno_id", "fecha", "persona"] }]
~~~

### Referencia
~~~json
{ "objetos": [
  { "id": "turnoref", "nombre": "TurnoReferenciaSecreta", "llave": "folio", "justifica": ["d1"], "propiedades": [{ "id": "folio", "nombre": "folio", "tipo": "texto", "requerido": true }] },
  { "id": "persona", "nombre": "Persona", "llave": "pid", "justifica": ["d2"], "propiedades": [{ "id": "pid", "nombre": "pid", "tipo": "texto", "requerido": true }] }
], "links": [{ "id": "asignado", "nombre": "asignado a", "de": "turnoref", "a": "persona", "cardinalidad": "N:1" }],
"acciones": [{ "id": "reasignar", "nombre": "ReasignarConCandado", "objeto": "turnoref", "precondiciones": ["el turno no ha empezado"], "efectos": ["persona = nueva"], "justifica": ["d2"], "parametros": [{ "id": "nueva", "nombre": "nueva", "tipo": "Persona", "requerido": true }] }] }
~~~

### Rúbrica
- La llave identifica el turno sin ambigüedad.`;

function item(block = BLOCK): ForgeBankItem {
  const it = (parseExercisesMd(bankMd([block], CELL_ID))?.exercises ?? []).find((e): e is ForgeBankItem => e.kind === "forge");
  if (!it || it.type !== "ontologia") throw new Error("el bloque de prueba no parseó como ontologia");
  return it;
}

const brief = () => {
  const it = item();
  if (it.type !== "ontologia") throw new Error("tipo");
  return { decisiones: it.data.decisiones, fuentes: it.data.fuentes, exigencias: it.data.exigencias };
};

/** A model with zero findings for the brief above (different from the reference). */
const GOOD: OntologyModel = {
  objetos: [
    { id: "o1", nombre: "Turno", llave: "o1-p1", justifica: ["d1"], propiedades: [{ id: "o1-p1", nombre: "turno_id", tipo: "texto", requerido: true }] },
    { id: "o2", nombre: "Persona", llave: "o2-p1", justifica: ["d2"], propiedades: [{ id: "o2-p1", nombre: "persona_id", tipo: "texto", requerido: true }] },
  ],
  links: [{ id: "l1", nombre: "cubre", de: "o1", a: "o2", cardinalidad: "N:1" }],
  acciones: [{ id: "a1", nombre: "Reasignar", objeto: "o1", precondiciones: ["el turno no empezó"], efectos: ["persona cambia"], justifica: ["d2"], parametros: [] }],
  interfaces: [],
};

const codes = (m: OntologyModel) => verifyOntology(m, brief()).map((h) => h.codigo);

describe("ontologia · verificador estructural", () => {
  it("a good model has zero findings", () => {
    expect(codes(GOOD)).toEqual([]);
  });
  it("an object that copies a source with no links nor actions is a renamed table", () => {
    const m: OntologyModel = structuredClone(GOOD);
    m.objetos.push({
      id: "o3",
      nombre: "TurnosRaw",
      llave: "o3-p1",
      fuente: "tabla_turnos",
      justifica: ["d1"],
      propiedades: [
        { id: "o3-p1", nombre: "turno_id", tipo: "texto", requerido: true },
        { id: "o3-p2", nombre: "fecha", tipo: "fecha", requerido: false },
        { id: "o3-p3", nombre: "persona", tipo: "texto", requerido: false },
      ],
    });
    expect(codes(m), "una tabla renombrada pasó como objeto de la Ontology").toContain("tabla-renombrada");
  });
  it("an object without justification is flagged", () => {
    const m: OntologyModel = structuredClone(GOOD);
    m.objetos[1]!.justifica = [];
    expect(codes(m), "un objeto sin justificación pasó el verificador").toContain("sin-justificacion");
  });
  it("broken keys, links, actions and uncovered decisions are flagged", () => {
    const m: OntologyModel = structuredClone(GOOD);
    m.objetos[0]!.llave = "";
    m.links.push({ id: "l2", nombre: "cubre", de: "o1", a: "zzz", cardinalidad: "N:1" });
    m.acciones[0]!.precondiciones = [];
    m.acciones[0]!.justifica = ["d1"];
    m.objetos[1]!.justifica = ["d1"];
    const c = codes(m);
    expect(c).toContain("llave-ausente");
    expect(c).toContain("link-roto");
    expect(c).toContain("accion-sin-precondicion");
    expect(c, "una decisión del brief quedó sin cubrir y pasó").toContain("decision-sin-cubrir");
  });
  it("requirements of ### Exigencias are enforced", () => {
    const f = verifyOntology(GOOD, { ...brief(), exigencias: { links: [{ de: "Turno", a: "Persona", cardinalidad: "1:N" }] } }).map((h) => h.codigo);
    expect(f, "una exigencia del brief faltó y pasó").toContain("exigencia-faltante");
    expect(verifyOntology(GOOD, { ...brief(), exigencias: { links: [{ de: "Persona", a: "Turno", cardinalidad: "1:N" }] } })).toEqual([]);
  });
});

describe("ontologia · ingesta", () => {
  it("accepts a reference with zero findings and never executes", async () => {
    const jsRun = vi.fn(async () => ({ syntaxError: null, cases: [] }));
    expect(await check(item(), { source: "seed", jsRun })).toEqual({ ok: true });
    expect(jsRun).not.toHaveBeenCalled();
  });
  it("rejects a bank whose reference has structural findings, naming the finding", async () => {
    const bad = BLOCK.replace('"justifica": ["d2"], "propiedades": [{ "id": "pid"', '"justifica": [], "propiedades": [{ "id": "pid"');
    const r = await check(item(bad), { source: "seed", jsRun: async () => ({ syntaxError: null, cases: [] }) });
    expect("ok" in r && r.ok, "el banco aceptó una referencia con hallazgos estructurales").toBe(false);
    expect("ok" in r, "el chequeo de ontologia siguió siendo un stub").toBe(true);
    expect(JSON.stringify(r)).toContain("sin-justificacion");
  });
});

describe("ontologia · interfaz", () => {
  let env: Envelope;
  beforeEach(async () => {
    window.localStorage.clear();
    env = await createEnvelope();
  });
  afterEach(() => cleanup());

  const mount = () => env.mount(OntologiaRunner as never, { item: item(), cellCode: "P2-04", cellId: CELL_ID, readModel: env.store.getState().readModel, onClose: () => {} } as never);
  void createElement;

  it("with findings, «Entregar el modelo» and «Pedir defensa» are disabled and the reference is not in the DOM", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Agregar objeto" }));
    expect(await screen.findByText(/no declara su llave primaria/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Entregar el modelo" }) as HTMLButtonElement).disabled, "se pudo entregar con hallazgos estructurales abiertos").toBe(true);
    expect((screen.getByRole("button", { name: "Pedir defensa" }) as HTMLButtonElement).disabled, "se pidió la defensa con hallazgos estructurales abiertos").toBe(true);
    expect(document.body.textContent ?? "", "la referencia del autor apareció antes de la entrega").not.toContain("TurnoReferenciaSecreta");
    expect(document.body.textContent ?? "").not.toContain("ReasignarConCandado");
  });

  it("a delivered model (in the log) reveals the reference; the defence asks with apoyo and scope local", async () => {
    window.localStorage.setItem(draftKey(CELL_ID, "onto-turnos"), JSON.stringify(GOOD));
    mount();
    expect(document.body.textContent ?? "", "la referencia del autor apareció antes de la entrega").not.toContain("TurnoReferenciaSecreta");
    const deliver = screen.getByRole("button", { name: "Entregar el modelo" }) as HTMLButtonElement;
    await waitFor(() => expect(deliver.disabled).toBe(false));
    fireEvent.click(deliver);
    expect(await screen.findByText(/TurnoReferenciaSecreta/)).toBeTruthy();
    const evs = (await env.events()).filter((e) => e.type === "evidence.recorded");
    const modelo = evs.find((e) => (e.payload as { phase?: string }).phase === "modelo");
    expect(modelo, "la entrega no dejó el modelo en el log").toBeTruthy();
    expect(modelo!.module_id).toBe(CELL_ID);
    const ask = screen.getByRole("button", { name: "Pedir defensa" }) as HTMLButtonElement;
    expect(ask.disabled, "el apoyo tenía un valor por omisión").toBe(true);
    fireEvent.click(screen.getByLabelText("Sin ayuda"));
    await waitFor(() => expect(ask.disabled).toBe(false));
    fireEvent.click(ask);
    await waitFor(() => expect(env.verdictCalls.length).toBe(1));
    expect(env.verdictCalls[0]!.req).toMatchObject({ cellCode: "P2-04", kind: "ontologia", scope: "local", apoyo: "independiente", artefactoEventIds: [modelo!.id] });
    expect(await screen.findByText(/Defensa en cola/)).toBeTruthy();
  });

  it("after a delivery, editing the model into findings disables «Pedir defensa» again", async () => {
    window.localStorage.setItem(draftKey(CELL_ID, "onto-turnos"), JSON.stringify(GOOD));
    mount();
    const deliver = screen.getByRole("button", { name: "Entregar el modelo" }) as HTMLButtonElement;
    await waitFor(() => expect(deliver.disabled).toBe(false));
    fireEvent.click(deliver);
    await screen.findByText(/TurnoReferenciaSecreta/);
    fireEvent.click(screen.getByLabelText("Con apoyo"));
    const ask = screen.getByRole("button", { name: "Pedir defensa" }) as HTMLButtonElement;
    await waitFor(() => expect(ask.disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Agregar objeto" }));
    await screen.findByText(/no declara su llave primaria/);
    expect(ask.disabled, "se pidió la defensa con hallazgos estructurales abiertos").toBe(true);
    fireEvent.click(ask);
    expect(env.verdictCalls, "se pidió la defensa con hallazgos estructurales abiertos").toEqual([]);
  });

  it("«Verificar» writes only the sha10 and the findings, never the model", async () => {
    window.localStorage.setItem(draftKey(CELL_ID, "onto-turnos"), JSON.stringify(GOOD));
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Verificar" }));
    await screen.findByText(/Sin hallazgos estructurales\. Puedes entregar/);
    const v = (await env.events()).find((e) => e.type === "evidence.recorded" && (e.payload as { phase?: string }).phase === "verificacion");
    const data = (v!.payload as { data: Record<string, unknown> }).data;
    expect(Object.keys(data).sort()).toEqual(["hallazgos", "modeloSha10"]);
    expect(String(data.modeloSha10)).toMatch(/^[0-9a-f]{10}$/);
  });
});
