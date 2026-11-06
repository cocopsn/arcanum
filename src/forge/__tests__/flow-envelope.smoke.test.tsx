import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

vi.mock("@/app/providers", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).providersMock);
vi.mock("@/forge/ai-port", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).aiPortMock);

import { STUB_QUEUE_MOTIVO, createEnvelope, fixtureProps, hadSubmissionBefore } from "@/forge/__tests__/helpers/flow-envelope";
import { submitForgeVerdict } from "@/forge/ai-port";
import { MISCONFIGURED_TEXT } from "@/forge/ui/flow-contract";
import ForgeMission from "@/forge/ui/flows/mision";

// SMOKE of the Phase-0 harness (design §9.5, §22.3): it mounts a flow with an in-memory store and the simulated
// ai-port, and records each submitForgeVerdict call with the log at that moment. flow-envelope.test.tsx (e3-ia) and
// flow-envelope.ontologia.test.tsx (e1-modelos) build on it.

describe("flow-envelope harness", () => {
  it("mounts a registry flow and records verdict calls with the log at the moment of the call", async () => {
    const env = await createEnvelope();
    env.mount(ForgeMission, fixtureProps(env, { code: "P2-06", compuerta: "mision", flujo: "mision" }));
    // Phase 1: the real ForgeMission without `kind` is a misconfiguration (§9.5 step 1) and offers no Entregar.
    expect(screen.getByRole("alert").textContent).toBe(MISCONFIGURED_TEXT);
    expect(env.verdictCalls).toHaveLength(0);
    const r = await submitForgeVerdict({ cellCode: "P2-06", kind: "mision", scope: "local" });
    expect(r).toEqual({ estado: "en-cola", motivo: STUB_QUEUE_MOTIVO });
    expect(env.verdictCalls).toHaveLength(1);
    expect(Array.isArray(env.verdictCalls[0]!.logAtCall)).toBe(true);
    expect(hadSubmissionBefore(env.verdictCalls[0]!), "el arnés vio una entrega que no existe").toBe(false);
  });

  it("its queue message is the same as ai-port's", async () => {
    const real = await vi.importActual<typeof import("@/forge/ai-port")>("@/forge/ai-port");
    expect(STUB_QUEUE_MOTIVO).toBe(real.STUB_QUEUE_MOTIVO);
  });
});
