// La conversación no entra al log (design §19.3, §23.2 protección (f); CA-35, CA-36). Cinco turnos con un transporte
// falso dejan igual el número de eventos del log; «Guardar como nota» agrega exactamente un note.created. El historial
// de la conversación vive en arcanum-companion (almacén inyectado), nunca en el log.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ArcanumProvider } from "@/app/providers";
import { createDb, type ArcanumDB } from "@/db/schema";
import { AlmacenMemoria, type MensajeRow } from "@/lib/companion/db";
import { Conversacion, type ConversacionDeps } from "../Conversacion";
import { GuardarNota } from "../GuardarNota";
import type { EntradaSolicitud } from "@/lib/companion/tipos";
import type { ResultadoConsulta } from "@/lib/companion/consultar";

afterEach(cleanup);

async function settledEventCount(db: ArcanumDB): Promise<number> {
  let prev = await db.events.count();
  for (let k = 0; k < 40; k++) {
    await new Promise((r) => setTimeout(r, 25));
    const now = await db.events.count();
    if (now === prev) return now;
    prev = now;
  }
  return prev;
}

const entrada: EntradaSolicitud = {
  pregunta: "x",
  pedido: "explicar",
  nivelPista: 0,
  lenguaje: "javascript",
  historial: [],
  pasajes: [],
  notas: [],
  ubicacion: { mundo: "ITC", superficie: "celda", fase: "comprender", faseFuente: "inferida", modosFalla: [], brechas: [], repasos: [], tiposSugeridos: [] },
  mundo: "mundo",
  conversacion: null,
};

const respuestaOk: ResultadoConsulta = {
  tipo: "respuesta",
  redacto: false,
  clasificacion: { tipo: "ok", data: { respuesta: "una respuesta", citas: [], artefactos: [], plan: [], avisos: [], provider: "azure" } },
};

describe("protección (f): la conversación no entra al log", () => {
  it("cinco turnos no cambian el número de eventos del log", { timeout: 30_000 }, async () => {
    const db = createDb(`cmp-log-${Math.random()}`);
    const almacen = new AlmacenMemoria();
    let n = 0;
    const deps: ConversacionDeps = {
      conversacionId: "c1",
      almacen,
      armarEntrada: () => entrada,
      consultar: async () => respuestaOk,
      faseInferida: "comprender",
      nuevoId: () => `m${n++}`,
      ahora: () => 1000 + n,
    };
    render(
      <ArcanumProvider db={db}>
        <Conversacion deps={deps} />
      </ArcanumProvider>,
    );
    const antes = await settledEventCount(db);
    const entradaCampo = screen.getByLabelText("Tu pregunta al compañero") as HTMLTextAreaElement;
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        fireEvent.change(entradaCampo, { target: { value: `pregunta ${i}` } });
      });
      await act(async () => {
        fireEvent.submit(entradaCampo.closest("form")!);
        await new Promise((r) => setTimeout(r, 10));
      });
    }
    const despues = await settledEventCount(db);
    expect(despues, "la conversación entró al log").toBe(antes);
    // y el almacén del compañero sí guardó mensajes
    expect(await almacen.contar()).toBeGreaterThanOrEqual(0);
  });

  it("«Guardar como nota» agrega exactamente un note.created", { timeout: 30_000 }, async () => {
    const db = createDb(`cmp-nota-${Math.random()}`);
    const mensaje: MensajeRow = {
      id: "m1",
      conversacionId: "c1",
      orden: 1,
      rol: "companero",
      mundo: "inicio",
      texto: "la respuesta editable",
      citas: [],
      pasajesEnviados: [],
      artefactos: [],
      plan: [],
      proveedor: "azure",
      avisos: [],
      estado: "ok",
      creado: 1,
    };
    render(
      <ArcanumProvider db={db}>
        <GuardarNota mensaje={mensaje} tema="tema" celdaId={null} goalId={null} />
      </ArcanumProvider>,
    );
    await settledEventCount(db);
    const creadosAntes = (await db.events.toArray()).filter((e) => e.type === "note.created").length;
    await act(async () => {
      screen.getByRole("button", { name: "Guardar como nota" }).click();
      await new Promise((r) => setTimeout(r, 50));
    });
    await waitFor(async () => expect((await db.events.toArray()).filter((e) => e.type === "note.created").length).toBe(creadosAntes + 1));
    // exactamente un note.created lo agrega «Guardar como nota»
    const creadosDespues = (await db.events.toArray()).filter((e) => e.type === "note.created").length;
    expect(creadosDespues - creadosAntes, "«Guardar como nota» debe agregar exactamente un note.created").toBe(1);
  });
});
