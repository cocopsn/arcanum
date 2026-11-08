// Cancelar (design §14.4, CA-39). Un transporte falso que resuelve DESPUÉS de cancelar no pinta ni guarda nada: la
// conversación aplica el resultado sólo si su reqId sigue vigente (aplicarResultado de turnos.ts). El red-check de
// turnos (sin la comparación de reqId) va aparte.
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Conversacion, type ConversacionDeps } from "../Conversacion";
import { AlmacenMemoria } from "@/lib/companion/db";
import type { EntradaSolicitud } from "@/lib/companion/tipos";
import type { ResultadoConsulta } from "@/lib/companion/consultar";

afterEach(cleanup);

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

describe("CA-39: una respuesta que llega tras cancelar no pinta ni guarda", () => {
  it("el transporte resuelve después de cancelar y no aparece el mensaje del compañero", async () => {
    let resolver!: (r: ResultadoConsulta) => void;
    const diferido = new Promise<ResultadoConsulta>((res) => (resolver = res));
    const almacen = new AlmacenMemoria();
    let n = 0;
    const deps: ConversacionDeps = {
      conversacionId: "c1",
      almacen,
      armarEntrada: () => entrada,
      consultar: () => diferido,
      faseInferida: "comprender",
      nuevoId: () => `m${n++}`,
      ahora: () => 1,
    };
    render(<Conversacion deps={deps} />);
    const campo = screen.getByLabelText("Tu pregunta al compañero") as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(campo, { target: { value: "una pregunta" } });
    });
    await act(async () => {
      fireEvent.submit(campo.closest("form")!);
      await new Promise((r) => setTimeout(r, 5));
    });
    // mientras hay consulta, el botón es «Cancelar»
    await act(async () => {
      screen.getByRole("button", { name: "Cancelar" }).click();
      await new Promise((r) => setTimeout(r, 5));
    });
    // ahora llega la respuesta, tarde
    await act(async () => {
      resolver({ tipo: "respuesta", redacto: false, clasificacion: { tipo: "ok", data: { respuesta: "RESPUESTA TARDÍA", citas: [], artefactos: [], plan: [], avisos: [], provider: "azure" } } });
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.queryByText("RESPUESTA TARDÍA"), "una respuesta cancelada se pintó").toBeNull();
    // sólo el turno del aprendiz se guardó, nunca el del compañero
    const ms = await almacen.mensajesDe("c1");
    expect(ms.filter((m) => m.rol === "companero")).toHaveLength(0);
  });
});
