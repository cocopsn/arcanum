import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
vi.mock("@/app/providers", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).providersMock);
vi.mock("@/forge/ai-port", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).aiPortMock);
const bankState: { giro: boolean; onDevice: boolean } = { giro: true, onDevice: true };
vi.mock("@/forge/loaders", () => ({
  loadForgeBankItems: async () =>
    bankState.onDevice
      ? { items: bankState.giro ? [{ id: "x:p206-giro", kind: "forge", moduleId: null, itemId: "p206-giro", rol: "transferencia", title: "Giro", statement: "Se elimina una fuente de datos.", source: "seed", type: "giro", data: { rubrica: ["r"] } }] : [], pendientes: [] }
      : null,
  ensureForgeBank: async () => ({ ok: false, reason: "no-descargado" }),
}));
import { ENTREGA_KEYS } from "@/core/event";
import { createEnvelope, fixtureProps, hadSubmissionBefore } from "@/forge/__tests__/helpers/flow-envelope";
import ForgeMission, { ARTEFACTO_TEXT, ENTREGA_LABELS } from "@/forge/ui/flows/mision";

// §9.5 / §22.4: ForgeMission never asks for a gate verdict before the log has a mission.submitted with `apoyo` and,
// when the bank brings a giro, the giro answer after it; «Entregar» stays disabled without apoyo or scope; artifact
// mode writes the 9 keys; the giro is not painted before the entrega (D12); without the bank no verdict is offered (M2).

beforeEach(() => {
  bankState.giro = true;
  bankState.onDevice = true;
});

function fill(labels: string[]) {
  for (const l of labels) fireEvent.change(screen.getByLabelText(l), { target: { value: `texto de ${l}` } });
}

describe("ForgeMission — the gate envelope", () => {
  it("full mode: Entregar disabled without apoyo or scope; giro only after the entrega; verdict after the giro answer", async () => {
    const env = await createEnvelope();
    env.mount(ForgeMission, fixtureProps(env, { code: "P2-06", compuerta: "mision", flujo: "mision" }, { kind: "mision" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Entregar" })).toBeTruthy());
    fill(ENTREGA_KEYS.map((k) => ENTREGA_LABELS[k]));
    const entregar = () => screen.getByRole("button", { name: "Entregar" }) as HTMLButtonElement;
    await waitFor(() => expect(entregar().disabled).toBe(true));
    expect(document.body.textContent, "el giro se pintó antes de la entrega").not.toContain("Se elimina una fuente de datos.");
    fireEvent.click(screen.getByLabelText(/Local/));
    expect(entregar().disabled, "el apoyo tenía un valor por omisión").toBe(true);
    fireEvent.click(screen.getByLabelText(/Independiente/));
    expect(entregar().disabled).toBe(false);
    fireEvent.click(entregar());
    await screen.findByText("Se elimina una fuente de datos.");
    expect(env.verdictCalls).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Respuesta al giro"), { target: { value: "sin esa fuente, reconcilio con la otra" } });
    fireEvent.click(screen.getByRole("button", { name: "Responder al giro" }));
    fireEvent.click(await screen.findByRole("button", { name: "Pedir veredicto" }));
    await waitFor(() => expect(env.verdictCalls).toHaveLength(1));
    expect(hadSubmissionBefore(env.verdictCalls[0]!, { giro: true }), "se pidió veredicto sin entrega ni giro").toBe(true);
    const m = (await env.events()).find((e) => e.type === "mission.submitted")!;
    expect(Object.keys((m.payload as { entrega: object }).entrega)).toHaveLength(9);
    expect((m.payload as { apoyo: string }).apoyo).toBe("independiente");
    await screen.findByText(/En cola: el evaluador desplegado todavía no tiene la acción Forge/);
  });

  for (const kind of ["entrevista", "expediente", "gameday"] as const) {
    it(`artifact mode (${kind}): only «Herramientas» and «Defensa», the 9 keys in the log, attachments travel`, async () => {
      bankState.giro = false;
      const env = await createEnvelope();
      env.mount(ForgeMission, fixtureProps(env, { code: "F1-03", compuerta: kind, flujo: kind }, { kind, attachments: { eventIds: ["0190a000-0000-7000-8000-0000000000a1"] } }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Entregar" })).toBeTruthy());
      expect(screen.queryByLabelText("Problema")).toBeNull();
      fill([ENTREGA_LABELS.herramientas, ENTREGA_LABELS.defensa]);
      fireEvent.click(screen.getByLabelText(/Con apoyo/));
      fireEvent.click(screen.getByLabelText(/Local/));
      fireEvent.click(screen.getByRole("button", { name: "Entregar" }));
      fireEvent.click(await screen.findByRole("button", { name: "Pedir veredicto" }));
      await waitFor(() => expect(env.verdictCalls).toHaveLength(1));
      expect(hadSubmissionBefore(env.verdictCalls[0]!)).toBe(true);
      expect(env.verdictCalls[0]!.req).toMatchObject({ kind, scope: "local", artefactoEventIds: ["0190a000-0000-7000-8000-0000000000a1"] });
      expect(env.verdictCalls[0]!.req.apoyo).toBeUndefined();
      const entrega = ((await env.events()).find((e) => e.type === "mission.submitted")!.payload as { entrega: Record<string, string> }).entrega;
      expect(Object.keys(entrega)).toHaveLength(9);
      expect(entrega.problema).toBe(ARTEFACTO_TEXT);
    });
  }

  it("misconfigured (kind is not the cell's compuerta, or artifact mode without eventIds) → no Entregar", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const env = await createEnvelope();
    const v = env.mount(ForgeMission, fixtureProps(env, { code: "P2-06", compuerta: "mision", flujo: "mision" }, { kind: "expediente" }));
    expect(screen.getByRole("alert").textContent).toBe("Este flujo no está bien configurado");
    expect(screen.queryByRole("button", { name: "Entregar" })).toBeNull();
    v.unmount();
    env.mount(ForgeMission, fixtureProps(env, { code: "F1-03", compuerta: "entrevista", flujo: "entrevista" }, { kind: "entrevista" }));
    expect(screen.queryByRole("button", { name: "Entregar" })).toBeNull();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("M2: without the route's bank on the device, no verdict is offered and the reason is visible", async () => {
    bankState.onDevice = false;
    const env = await createEnvelope();
    env.mount(ForgeMission, fixtureProps(env, { code: "P2-06", compuerta: "mision", flujo: "mision" }, { kind: "mision" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Entregar" }) as HTMLButtonElement)).toBeTruthy());
    fill(ENTREGA_KEYS.map((k) => ENTREGA_LABELS[k]));
    fireEvent.click(screen.getByLabelText(/Independiente/));
    fireEvent.click(screen.getByLabelText(/Local/));
    await waitFor(() => expect((screen.getByRole("button", { name: "Entregar" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Entregar" }));
    await screen.findByText(/falta el banco de la ruta en este dispositivo: descárgalo/);
    expect(screen.queryByRole("button", { name: "Pedir veredicto" })).toBeNull();
    expect(env.verdictCalls).toHaveLength(0);
  });
});
