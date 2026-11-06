import { describe, expect, it, vi } from "vitest";
import { waitFor, screen } from "@testing-library/react";
vi.mock("@/app/providers", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).providersMock);
vi.mock("@/forge/ai-port", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).aiPortMock);
vi.mock("@/forge/loaders", () => ({
  loadForgeBankItems: async () => ({ items: [{ id: "x:f103-giro", kind: "forge", moduleId: null, itemId: "f103-giro", rol: "transferencia", title: "Giro", statement: "a mitad de la defensa se elimina una fuente de datos y debes reconciliar con la otra", source: "seed", type: "giro", data: { rubrica: ["r"] } }], pendientes: [] }),
  ensureForgeBank: async () => ({ ok: true, refreshed: false, pendientes: [] }),
}));
import pilots from "@/forge/data/pilots.json";
import { createEnvelope, fixtureProps } from "@/forge/__tests__/helpers/flow-envelope";
import ForgeMission from "@/forge/ui/flows/mision";
import InterviewFlow from "@/forge/ui/flows/entrevista";

// D12 (CA-40): reserved content is never painted before its event. e3-ia's part: the entrevista flow and
// ForgeMission of F1-03 (artifact mode) before the interview closes and before the entrega must not show the three
// hidden facts of the pilot nor the reserved variation (the giro). Checked by 5-grams against pilots.json.

const RESERVED_GIRO = "a mitad de la defensa se elimina una fuente de datos y debes reconciliar con la otra";

type Field = { etiqueta: string; texto: string };
const f103 = (pilots as unknown as { pilotos: { code?: string; codigo?: string; campos?: Field[] }[] }).pilotos;
const all = JSON.stringify(f103);
const sesion = /El evaluador conserva información[^"]*/.exec(all)?.[0] ?? "";
const variacion = /"etiqueta":"Variación","texto":"([^"]*)/.exec(all)?.[1] ?? "";

function fiveGrams(text: string): string[] {
  const w = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i + 5 <= w.length; i++) out.push(w.slice(i, i + 5).join(" "));
  return out;
}
function leaked(dom: string, reserved: string): string | null {
  const d = dom.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ");
  return fiveGrams(reserved).find((g) => d.includes(g)) ?? null;
}

describe("D12 · reserved content of F1-03 before its event (e3-ia flows)", () => {
  it("the reserved texts were found in pilots.json (the check measures something)", () => {
    expect(sesion).toMatch(/alarmas/);
    expect(variacion.length).toBeGreaterThan(20);
  });

  it("entrevista flow and ForgeMission (artifact) paint neither the hidden facts nor the giro before their events", async () => {
    const env = await createEnvelope();
    const props = fixtureProps(env, { code: "F1-03", compuerta: "entrevista", flujo: "entrevista" });
    const a = env.mount(InterviewFlow, props);
    expect(leaked(document.body.textContent ?? "", sesion), "un hecho oculto de la entrevista se pintó").toBeNull();
    expect(leaked(document.body.textContent ?? "", variacion), "la variación reservada se pintó").toBeNull();
    a.unmount();
    env.mount(ForgeMission, { ...props, kind: "entrevista", attachments: { eventIds: ["0190a000-0000-7000-8000-0000000000a1"] } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Entregar" })).toBeTruthy());
    const dom = document.body.textContent ?? "";
    expect(leaked(dom, sesion), "un hecho oculto de la entrevista se pintó").toBeNull();
    expect(leaked(dom, RESERVED_GIRO), "el giro se pintó antes de la entrega").toBeNull();
  });

  it("red-check of the detector: painting the raw pilot is caught and names the leaked 5-gram", () => {
    expect(leaked(`<p>${sesion}</p>`, sesion)).not.toBeNull();
    expect(leaked(`<p>${RESERVED_GIRO}</p>`, RESERVED_GIRO)).not.toBeNull();
  });
});
