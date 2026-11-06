import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
vi.mock("@/app/providers", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).providersMock);
import { createEnvelope } from "@/forge/__tests__/helpers/flow-envelope";
import { ForgeCellPanel } from "@/forge/ui/ForgeCellPanel";
import { forgeCellId } from "@/forge/ids";
import pilots from "@/forge/data/pilots.json";

// D12 (CA-40, §9.3 j): reserved content is never painted before the event that frees it. F1-03: the three hidden
// facts of the interview (until the interview closes). P2-06: step 7 of the sequence, the reserved variation (until
// the mission is delivered). The cell expediente is assembled only from routes/*.json; this test mounts it before
// those events and requires that no 5-gram of the reserved texts appears in the DOM.
type Campo = { etiqueta: string; texto: string; items?: string[] };
const P = (pilots as unknown as { pilotos: { code: string; campos: Campo[] }[] }).pilotos;
const campo = (code: string, pref: string) => P.find((p) => p.code === code)!.campos.find((c) => c.etiqueta.startsWith(pref))!;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
const grams = (s: string, n = 5) => {
  const w = norm(s);
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
};

// the reserved texts, taken from pilots.json itself (so a change in the master program moves the test with it)
const sesion = campo("F1-03", "Sesión").texto;
const hechos = sesion.slice(sesion.indexOf(":") + 1).split(/,\s+| y el /).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 5);
const paso7 = (campo("P2-06", "Secuencia").items ?? [])[6] ?? "";
const RESERVED: { code: string; name: string; text: string }[] = [
  ...hechos.map((h, i) => ({ code: "F1-03", name: `hecho oculto ${i + 1}`, text: h })),
  { code: "P2-06", name: "paso 7 (variación reservada)", text: paso7 },
];

describe("ForgeCellPanel never paints reserved content (D12)", () => {
  it("the reserved texts exist in pilots.json (three hidden facts and step 7)", () => {
    expect(hechos).toHaveLength(3);
    expect(paso7.length).toBeGreaterThan(20);
  });

  for (const code of ["F1-03", "P2-06"]) {
    it(`${code}: no 5-gram of its reserved content is in the DOM before its event`, async () => {
      await createEnvelope();
      const view = render(<ForgeCellPanel moduleId={forgeCellId(code)} />);
      // wait until the route fiche is painted (the mission is there)
      await screen.findByText("Misión", undefined, { timeout: 4000 });
      const dom = grams(view.container.textContent ?? "");
      for (const r of RESERVED.filter((x) => x.code === code)) {
        const leaked = [...grams(r.text)].filter((g) => dom.has(g));
        expect(leaked, `contenido reservado en el expediente de ${code}: ${r.name} («${leaked[0] ?? ""}»)`).toEqual([]);
      }
      cleanup();
    });
  }
});
