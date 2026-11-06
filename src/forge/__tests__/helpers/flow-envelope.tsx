import { vi } from "vitest";
import { render } from "@testing-library/react";
import { createElement, type ComponentType } from "react";
import { useStore } from "zustand";
import { createDb } from "@/db/schema";
import { createArcanumStore, type ArcanumState, type ArcanumStore } from "@/store/arcanum-store";
import type { ArcanumEvent } from "@/core/event";
import type { ForgeSubmitRequest, ForgeSubmitResult, SimulatedUserRequest, SimulatedUserResult } from "@/forge/ai-port";

// Same text as STUB_QUEUE_MOTIVO of ai-port.ts. Not imported at runtime: "@/forge/ai-port" is the module this harness
// replaces, and importing it here would close a cycle with the vi.mock factory (flow-envelope.smoke.test.tsx checks
// that both strings stay equal).
export const STUB_QUEUE_MOTIVO = "el evaluador desplegado todavía no tiene la acción Forge";
import type { FlowProps } from "@/forge/ui/flow-contract";
import type { ForgeCellData, ForgeCompuerta, ForgeFlujo, ForgeRouteData } from "@/forge/route-data";

// FLOW ENVELOPE TEST HARNESS (design §9.5, §22.3). Mounts a Forge flow with an IN-MEMORY store (fake-indexeddb, a
// fresh Dexie per envelope) and a simulated ai-port, and exposes (1) every call to submitForgeVerdict together with
// the events that were in the log AT THE MOMENT of the call, and (2) the events written. flow-envelope.test.tsx
// (e3-ia) and flow-envelope.ontologia.test.tsx (e1-modelos) use it to prove that no gate verdict is asked before a
// mission.submitted with `apoyo` (and the giro answer when the bank brings one).
//
// Usage (vi.mock factories are hoisted, so they import this module lazily):
//   vi.mock("@/app/providers", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).providersMock);
//   vi.mock("@/forge/ai-port", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).aiPortMock);
//   const env = await createEnvelope();
//   const view = env.mount(ForgeMission, fixtureProps(env, { code: "P2-06", compuerta: "mision", flujo: "mision" }));
// Components are imported STATICALLY in tests (the registries are tested by calling their loaders).

export interface VerdictCall {
  req: ForgeSubmitRequest;
  /** the log at the moment submitForgeVerdict was called (order of the fold) */
  logAtCall: ArcanumEvent[];
}

export interface Envelope {
  store: ArcanumStore;
  verdictCalls: VerdictCall[];
  simulatedUserCalls: SimulatedUserRequest[];
  /** what submitForgeVerdict answers (default: queued with the stub message) */
  verdictReply: (req: ForgeSubmitRequest) => ForgeSubmitResult;
  simulatedUserReply: (req: SimulatedUserRequest) => SimulatedUserResult;
  events: () => Promise<ArcanumEvent[]>;
  mount: (Component: ComponentType<FlowProps>, props: FlowProps) => ReturnType<typeof render>;
}

let current: Envelope | null = null;
let seq = 0;

function env(): Envelope {
  if (!current) throw new Error("flow-envelope: llama a createEnvelope() antes de montar un flujo");
  return current;
}

export async function createEnvelope(now = Date.UTC(2026, 10, 6, 12, 0, 0)): Promise<Envelope> {
  const db = createDb(`forge-envelope-${++seq}-${Math.random().toString(36).slice(2)}`);
  const store = createArcanumStore(db);
  await store.getState().hydrate(now);
  const e: Envelope = {
    store,
    verdictCalls: [],
    simulatedUserCalls: [],
    verdictReply: () => ({ estado: "en-cola", motivo: STUB_QUEUE_MOTIVO }),
    simulatedUserReply: () => ({ estado: "sin-ia", motivo: "La entrevista necesita al usuario simulado (IA); tus preguntas quedan guardadas" }),
    events: () => store.getState().getEvents(),
    mount: (Component, props) => render(createElement(Component, props)),
  };
  current = e;
  return e;
}

/** Drop-in for "@/app/providers": the store of the current envelope; sync is a no-op. */
export const providersMock = {
  useArcanumStore: (): ArcanumStore => env().store,
  useArcanumSync: () => ({ syncNow: () => {}, signOut: async () => {}, syncAvailable: false }),
  useArcanum: <T,>(selector: (s: ArcanumState) => T): T => useStore(env().store, selector),
  ArcanumProvider: ({ children }: { children: React.ReactNode }) => children,
};

/** Drop-in for "@/forge/ai-port": records every call with the log at that moment. */
export const aiPortMock = {
  STUB_QUEUE_MOTIVO,
  submitForgeVerdict: vi.fn(async (req: ForgeSubmitRequest): Promise<ForgeSubmitResult> => {
    const e = env();
    e.verdictCalls.push({ req, logAtCall: await e.events() });
    return e.verdictReply(req);
  }),
  askSimulatedUser: vi.fn(async (req: SimulatedUserRequest): Promise<SimulatedUserResult> => {
    const e = env();
    e.simulatedUserCalls.push(req);
    return e.simulatedUserReply(req);
  }),
};

/** Minimal route with one cell, enough for FlowProps (the real data comes from routes/*.json, c0-nucleo). */
export function fixtureRoute(cell: { code: string; id?: string; compuerta: ForgeCompuerta; flujo: ForgeFlujo; title?: string }): ForgeRouteData {
  const c: ForgeCellData = {
    code: cell.code,
    id: cell.id ?? "cf000000-0000-4000-8000-000000000001",
    title: cell.title ?? `Celda ${cell.code}`,
    cls: cell.compuerta === null ? "diagnostico" : "ruta",
    flujo: cell.flujo,
    compuerta: cell.compuerta,
    ficha: { fuentes: [], mision: "Misión de prueba.", defensa: "Defensa de prueba." },
    capacidades: ["sistemas"],
    rastroCapacidades: {},
    criticas: [{ id: "correctitud", texto: "Correctitud", rastro: "Misión de prueba." }],
    naturaleza: { valor: "a_mano" },
    alcance: "local",
    etiquetas: [],
  };
  return { v: 1, slug: "fixture", code: cell.code.split("-")[0] ?? "F", name: "Ruta de prueba", family: "Fundamentos", header: { entrada: "", entradaRecomendada: [], evidencia: "", apoyo: [] }, cells: [c] };
}

/** FlowProps for a fixture cell, with the envelope's current read model. */
export function fixtureProps(
  e: Envelope,
  cell: { code: string; id?: string; compuerta: ForgeCompuerta; flujo: ForgeFlujo },
  extra: Partial<FlowProps> = {},
): FlowProps {
  const route = fixtureRoute(cell);
  return {
    cellCode: cell.code,
    cellId: route.cells[0]!.id,
    route,
    readModel: e.store.getState().readModel,
    onClose: () => {},
    ...extra,
  };
}

/** Did the log at the call contain a mission.submitted with `apoyo` (and, if asked, a giro answer after it)? */
export function hadSubmissionBefore(call: VerdictCall, opts: { giro?: boolean } = {}): boolean {
  const idx = call.logAtCall.findIndex((ev) => ev.type === "mission.submitted" && typeof (ev.payload as Record<string, unknown>)?.apoyo === "string");
  if (idx < 0) return false;
  if (!opts.giro) return true;
  return call.logAtCall.slice(idx + 1).some((ev) => ev.type === ("evidence.recorded" as ArcanumEvent["type"]) && (ev.payload as Record<string, unknown>)?.type === "giro");
}
