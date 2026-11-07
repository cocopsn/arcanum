// @vitest-environment node
// Cargador local de la Edge (design §13.8): la Edge real, transpilada y servida en Node, contesta como en Deno.
import { describe, expect, it } from "vitest";
import { cargarEdge } from "../../../../scripts/companion/edge-local.mjs";

const sinRed = (async () => {
  throw new Error("sin red en esta prueba");
}) as unknown as typeof fetch;

describe("edge-local.mjs (§13.8)", () => {
  it("una acción inventada da 400 «Acción desconocida.»", async () => {
    const edge = cargarEdge({ env: {}, fetch: sinRed });
    expect(await edge.invocar({ action: "inventada" })).toEqual({ status: 400, json: { error: "Acción desconocida." } });
  });

  it("una entrada inválida de companion da 400 con su campo, sin llamar a la red", async () => {
    const edge = cargarEdge({ env: {}, fetch: sinRed });
    expect(await edge.invocar({ action: "companion", context: { pregunta: "" } })).toEqual({ status: 400, json: { error: "Entrada inválida: pregunta" } });
  });

  it("getUser rota el id: 13 llamadas seguidas no tropiezan con el límite de 12 por minuto", async () => {
    const edge = cargarEdge({ env: {}, fetch: sinRed });
    const estados: number[] = [];
    for (let i = 0; i < 13; i++) estados.push((await edge.invocar({ action: "inventada" })).status);
    expect(estados.every((s) => s === 400)).toBe(true);
  });
});
