import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { parseExercisesMd } from "@/lib/exercises-md";
import type { ForgeBankItem } from "@/forge/bank/registry";
import { BLOCKS, bankMd } from "@/forge/__tests__/fixtures/forge-blocks";
import { createEnvelope, fixtureProps, type Envelope } from "@/forge/__tests__/helpers/flow-envelope";
import type { FlowProps } from "@/forge/ui/flow-contract";
import { draftKey } from "@/forge/ui/OntologyEditor";

vi.mock("@/app/providers", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).providersMock);
vi.mock("@/forge/ai-port", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).aiPortMock);

// The mission flow is e3's: here a PROBE stands in for it, so the test sees exactly what OntologyForge mounts at its end.
const missionProps: FlowProps[] = [];
vi.mock("@/forge/ui/flows/mision", () => ({
  default: (p: FlowProps) => {
    missionProps.push(p);
    return <p data-testid="mission-probe">ForgeMission · {p.kind} · {(p.attachments?.eventIds ?? []).join(",")}</p>;
  },
}));

const CELL_ID = "cf000000-0000-4000-8000-0000000000b1";
const ITEMS = (parseExercisesMd(bankMd([BLOCKS.ontologia], CELL_ID))?.exercises ?? []).filter((e): e is ForgeBankItem => e.kind === "forge");
vi.mock("@/forge/loaders", () => ({ loadForgeBankItems: async () => ({ items: ITEMS, pendientes: [] }) }));

import OntologyForge from "@/forge/ui/flows/ontologia";

// FLOW ENVELOPE of `ontologia` (design §9.5): OntologyForge never asks for a verdict itself; with zero findings the
// delivery writes the model (phase "modelo") and only THEN mounts the mission flow of the registry in artifact mode, with
// kind = cell.compuerta and attachments.eventIds = [that evidence].
describe("flow envelope · ontologia (P2-01)", () => {
  let env: Envelope;
  beforeEach(async () => {
    window.localStorage.clear();
    missionProps.length = 0;
    env = await createEnvelope();
  });
  afterEach(() => cleanup());

  it("delivers the model, then mounts ForgeMission in artifact mode; no verdict is asked by the flow", async () => {
    const ref = ITEMS[0]!.type === "ontologia" ? ITEMS[0]!.data.referencia : null;
    window.localStorage.setItem(draftKey(CELL_ID, "onto-citas"), JSON.stringify(ref));
    env.mount(OntologyForge, fixtureProps(env, { code: "P2-01", id: CELL_ID, compuerta: "ontologia", flujo: "ontologia" }));
    const deliver = (await screen.findByRole("button", { name: "Entregar el modelo" })) as HTMLButtonElement;
    await waitFor(() => expect(deliver.disabled).toBe(false));
    expect(screen.queryByTestId("mission-probe"), "la misión se montó antes de entregar el modelo").toBeNull();
    fireEvent.click(deliver);
    await screen.findByTestId("mission-probe");
    const modelo = (await env.events()).find((e) => e.type === "evidence.recorded" && (e.payload as { phase?: string }).phase === "modelo");
    expect(modelo, "la misión se montó sin el modelo en el log").toBeTruthy();
    const last = missionProps[missionProps.length - 1]!;
    expect(last.kind, "Ontology Forge no cerró con kind = compuerta").toBe("ontologia");
    expect(last.attachments?.eventIds, "la misión de ontologia se montó sin el modelo como artefacto").toEqual([modelo!.id]);
    expect(env.verdictCalls, "Ontology Forge pidió veredicto sin entrega ni giro").toEqual([]);
  });

  it("with structural findings the delivery is disabled and the mission is never mounted", async () => {
    env.mount(OntologyForge, fixtureProps(env, { code: "P2-01", id: CELL_ID, compuerta: "ontologia", flujo: "ontologia" }));
    const deliver = (await screen.findByRole("button", { name: "Entregar el modelo" })) as HTMLButtonElement;
    fireEvent.click(screen.getByRole("button", { name: "Agregar objeto" }));
    await screen.findByText(/no declara su llave primaria/);
    expect(deliver.disabled, "se pudo entregar con hallazgos estructurales abiertos").toBe(true);
    fireEvent.click(deliver);
    expect(screen.queryByTestId("mission-probe")).toBeNull();
    expect(env.verdictCalls).toEqual([]);
  });
});
