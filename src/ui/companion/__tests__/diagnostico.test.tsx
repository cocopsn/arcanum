// Guarda de diagnóstico en la UI (design §12.6, CA-21). En una celda de diagnóstico D1-D8 sin evidencia, consultar
// devuelve el resultado local fijo; la conversación lo pinta y no hay respuesta de IA. El red-check de la guarda vive
// en consultar.test.ts; aquí la pieza de UI.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Conversacion, type ConversacionDeps } from "../Conversacion";
import { TEXTO_SIN_FILTRO } from "@/lib/companion/consultar";
import type { EntradaSolicitud } from "@/lib/companion/tipos";
import type { ResultadoConsulta } from "@/lib/companion/consultar";
import { AlmacenMemoria } from "@/lib/companion/db";

afterEach(cleanup);

const entrada: EntradaSolicitud = {
  pregunta: "x",
  pedido: "explicar",
  nivelPista: 0,
  lenguaje: "javascript",
  historial: [],
  pasajes: [],
  notas: [],
  ubicacion: { mundo: "Engineering Forge", superficie: "celda", fase: "general", faseFuente: "inferida", celda: { titulo: "D3", estado: "en_curso", codigo: "D3" }, modosFalla: [], brechas: [], repasos: [], tiposSugeridos: [] },
  mundo: "forge",
  conversacion: null,
};

const TEXTO_DIAG = "En la primera pasada de un diagnóstico no hay ayuda: es la medida de dónde empiezas.";

describe("CA-21: guarda de diagnóstico en la conversación", () => {
  it("pinta el texto local fijo y no llega una respuesta de IA", async () => {
    const consultar = vi.fn(async (): Promise<ResultadoConsulta> => ({ tipo: "local", motivo: "diagnostico", texto: TEXTO_DIAG, pasajes: [] }));
    let n = 0;
    const deps: ConversacionDeps = {
      conversacionId: "c1",
      almacen: new AlmacenMemoria(),
      armarEntrada: () => entrada,
      consultar,
      faseInferida: "general",
      nuevoId: () => `m${n++}`,
      ahora: () => 1,
    };
    render(<Conversacion deps={deps} />);
    const campo = screen.getByLabelText("Tu pregunta al compañero") as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(campo, { target: { value: "¿cuál es la respuesta?" } });
    });
    await act(async () => {
      fireEvent.submit(campo.closest("form")!);
      await new Promise((r) => setTimeout(r, 20));
    });
    await waitFor(() => expect(screen.getByText(TEXTO_DIAG)).toBeInTheDocument());
    expect(consultar).toHaveBeenCalledTimes(1);
    // nunca se pinta una «respuesta» de IA (el único texto del compañero es el local)
    expect(screen.queryByText(TEXTO_SIN_FILTRO)).toBeNull();
  });
});
