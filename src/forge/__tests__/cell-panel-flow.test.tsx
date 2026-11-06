import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
vi.mock("@/app/providers", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).providersMock);
import { createEnvelope } from "@/forge/__tests__/helpers/flow-envelope";
import { ForgeCellPanel } from "@/forge/ui/ForgeCellPanel";
import { forgeCellId } from "@/forge/ids";

// Fog-of-war stays fail-closed in Forge: a sealed cell shows its fiche but NEVER offers its flow; an open cell does.
// In the seeded log F0-01 is open and F0-02 is sealed behind it.
describe("ForgeCellPanel · the cell flow", () => {
  it("an open cell offers «Abrir la misión»", async () => {
    await createEnvelope();
    render(<ForgeCellPanel moduleId={forgeCellId("F0-01")} />);
    expect(await screen.findByRole("button", { name: /Abrir la misión/ }, { timeout: 4000 })).toBeTruthy();
    cleanup();
  });

  it("a sealed cell never offers its flow", async () => {
    await createEnvelope();
    render(<ForgeCellPanel moduleId={forgeCellId("F0-02")} />);
    await screen.findByText("Misión", undefined, { timeout: 4000 });
    expect(screen.queryByRole("button", { name: /Abrir la misión/ }), "una celda sellada ofreció su misión").toBeNull();
    cleanup();
  });
});
