// Ayuda de los red-checks del compañero (regla 2 de evidencia). En la corrida normal, cada red-check afirma que la
// prueba, con la protección quitada, falla con el mensaje que nombra lo protegido. Con CMP_REDCHECK=1 corre la misma
// comprobación sin envolverla, para que vitest muestre el ROJO real con ese mensaje (la salida va a redchecks.md).
import { expect } from "vitest";

export const MODO_ROJO = process.env.CMP_REDCHECK === "1";

const casa = (texto: string, esperado: string | RegExp): boolean =>
  typeof esperado === "string" ? texto.includes(esperado) : esperado.test(texto);

/** Red-check sobre una lista de hallazgos: con la protección quitada, algún hallazgo trae el mensaje. */
export function rojoHallazgos(hallazgos: readonly string[], esperado: string | RegExp): void {
  if (MODO_ROJO) {
    expect(hallazgos, hallazgos.join("\n")).toEqual([]);
    return;
  }
  expect(
    hallazgos.some((h) => casa(h, esperado)),
    `el red-check no dio «${String(esperado)}»; dio: ${hallazgos.join(" | ") || "ningún hallazgo"}`,
  ).toBe(true);
}

/** Red-check sobre una escena que lanza la aserción de la protección. */
export async function rojoEscena(escena: () => Promise<unknown> | unknown, esperado: string | RegExp): Promise<void> {
  if (MODO_ROJO) {
    await escena();
    return;
  }
  let error: unknown = null;
  try {
    await escena();
  } catch (e) {
    error = e;
  }
  const texto = error instanceof Error ? error.message : String(error);
  expect(error, `el red-check salió verde: la escena no falló con «${String(esperado)}»`).not.toBeNull();
  expect(casa(texto, esperado), `el red-check falló por otra razón: ${texto}`).toBe(true);
}
