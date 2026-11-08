// El compañero avisa en cada resultado no-ok del transporte (design §14.1-§14.2, CA-38/RF-E5; hallazgo F006-R1). Antes
// de este arreglo, enviar sólo pintaba `ok` y `local` y descartaba en silencio el resto: una Edge aún sin la acción
// `companion` devolvía 400 (edge-vieja) y el usuario no veía nada. Aquí se inyecta un `consultar` que devuelve cada
// variante y se comprueba que el DOM pinta el aviso correspondiente como texto plano (no como respuesta del modelo), y
// que `cancelada` no pinta nada.
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Conversacion, type ConversacionDeps } from "../Conversacion";
import { AlmacenMemoria } from "@/lib/companion/db";
import { textoLimite, TEXTO_SIN_FILTRO, type ResultadoConsulta } from "@/lib/companion/consultar";
import type { EntradaSolicitud } from "@/lib/companion/tipos";
import type { Clasificacion } from "@/lib/companion/transporte";

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

/** Monta la conversación con un `consultar` que devuelve siempre `r`, envía una pregunta y deja pasar los microticks. */
async function enviarCon(r: ResultadoConsulta) {
  const almacen = new AlmacenMemoria();
  let n = 0;
  const deps: ConversacionDeps = {
    conversacionId: "c1",
    almacen,
    armarEntrada: () => entrada,
    consultar: async () => r,
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
    await new Promise((res) => setTimeout(res, 15));
  });
  return almacen;
}

/** Resultado de nivel `respuesta` con la clasificación dada. */
const resp = (clasificacion: Clasificacion): ResultadoConsulta => ({ tipo: "respuesta", redacto: false, clasificacion });

describe("F006-R1 · el compañero avisa en cada resultado no-ok del transporte (CA-38/RF-E5)", () => {
  it("edge-vieja pinta el aviso de que la función del servidor aún no reconoce la acción", async () => {
    await enviarCon(resp({ tipo: "edge-vieja" }));
    expect(screen.getByText(/la función del servidor aún no reconoce esta acción/i)).toBeTruthy();
  });

  it("sin-sesion pinta un aviso de sesión", async () => {
    await enviarCon(resp({ tipo: "sin-sesion" }));
    expect(screen.getByText(/inicia sesión para usar la ia/i)).toBeTruthy();
  });

  it("limite (clasificación) pinta el texto del límite con los segundos de espera", async () => {
    await enviarCon(resp({ tipo: "limite", esperaS: 60 }));
    expect(screen.getByText(textoLimite(60))).toBeTruthy();
  });

  it("invalida pinta un texto neutro y NO vuelca el campo crudo al usuario", async () => {
    const almacen = await enviarCon(resp({ tipo: "invalida", campo: "pregunta" }));
    expect(screen.getByText(/no pudimos procesar tu solicitud/i)).toBeTruthy();
    // el campo crudo no se pinta en el DOM…
    expect(screen.queryByText(/entrada inválida: pregunta/i)).toBeNull();
    // …pero sí queda registrado en el aviso interno del turno guardado
    const ms = await almacen.mensajesDe("c1");
    const turno = ms.find((m) => m.estado === "aviso");
    expect(turno?.avisos).toContain("entrada inválida: pregunta");
  });

  it("filtrado usa su propio texto redactado", async () => {
    await enviarCon(resp({ tipo: "filtrado", texto: "El proveedor bloqueó el contenido; reformúlalo." }));
    expect(screen.getByText("El proveedor bloqueó el contenido; reformúlalo.")).toBeTruthy();
  });

  it("no-disponible pinta un aviso de indisponibilidad", async () => {
    await enviarCon(resp({ tipo: "no-disponible" }));
    expect(screen.getByText(/no está disponible ahora/i)).toBeTruthy();
  });

  it("sin-red pinta un aviso honesto de sin conexión", async () => {
    await enviarCon(resp({ tipo: "sin-red" }));
    expect(screen.getByText(/requiere conexión/i)).toBeTruthy();
  });

  it("sin-filtro (nivel superior) usa su propio .texto", async () => {
    await enviarCon({ tipo: "sin-filtro", texto: TEXTO_SIN_FILTRO });
    expect(screen.getByText(TEXTO_SIN_FILTRO)).toBeTruthy();
  });

  it("limite (nivel superior) usa su propio .texto", async () => {
    await enviarCon({ tipo: "limite", esperaS: 60, texto: textoLimite(60) });
    expect(screen.getByText(textoLimite(60))).toBeTruthy();
  });

  it("cancelada NO pinta nada ni guarda un turno del compañero (el usuario canceló a propósito)", async () => {
    const almacen = await enviarCon(resp({ tipo: "cancelada" }));
    const ms = await almacen.mensajesDe("c1");
    // sólo está el turno del aprendiz; ningún turno del compañero
    expect(ms.filter((m) => m.rol === "companero")).toHaveLength(0);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("el aviso se guarda con estado 'aviso', no 'ok' (no es una respuesta normal del modelo)", async () => {
    const almacen = await enviarCon(resp({ tipo: "edge-vieja" }));
    const ms = await almacen.mensajesDe("c1");
    const turno = ms.find((m) => m.rol === "companero");
    expect(turno?.estado).toBe("aviso");
  });
});
