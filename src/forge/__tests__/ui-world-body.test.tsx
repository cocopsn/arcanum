import { describe, expect, it, vi } from "vitest";
import { cleanup, screen, render, within } from "@testing-library/react";
vi.mock("@/app/providers", async () => (await import("@/forge/__tests__/helpers/flow-envelope")).providersMock);
import { createEnvelope } from "@/forge/__tests__/helpers/flow-envelope";
import { ForgeWorld } from "@/forge/ui/ForgeWorld";
import { FORGE_DISCLAIMER_PREFIX } from "@/forge/disclaimer";

// Design §14.2: while ForgeWorld is mounted, <body data-world="forge"> so the reward overlay and the ascension
// ceremony (mounted OUTSIDE the world) inherit the monochrome; on unmount it goes away. §14.4: the map paints the
// route's cells from the seeded log with fog-of-war (the first cell open, the rest sealed), state by text.
describe("ForgeWorld", () => {
  it("marks <body> with data-world=forge while mounted and clears it on unmount", async () => {
    await createEnvelope();
    const view = render(<ForgeWorld onClose={() => {}} />);
    expect(document.body.dataset.world, "el overlay de recompensas no hereda el monocromo de Forge").toBe("forge");
    view.unmount();
    expect(document.body.dataset.world).toBeUndefined();
    cleanup();
  });

  it("applies the theme to its root, shows the non-affiliation notice and the seeded route with fog-of-war", async () => {
    await createEnvelope();
    render(<ForgeWorld onClose={() => {}} />);
    const root = screen.getByRole("region", { name: "Engineering Forge" });
    expect(root.getAttribute("data-world")).toBe("forge");
    expect(root.style.getPropertyValue("--text")).toBe("var(--forge-text)");
    expect(root.querySelector("[data-forge-disclaimer]")?.textContent?.startsWith(FORGE_DISCLAIMER_PREFIX)).toBe(true);
    const map = root.querySelector("[data-forge-map='f0']") as HTMLElement;
    expect(map).not.toBeNull();
    const cells = within(map).getAllByRole("button");
    expect(cells.length).toBeGreaterThan(3);
    expect(cells[0]!.getAttribute("aria-label")).toMatch(/^F0-01 · .+ — disponible$/);
    expect(cells.slice(1).every((b) => b.getAttribute("data-state") === "sellado")).toBe(true);
    // six family tabs, wrapping (no hidden horizontal overflow, CA-75)
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(6);
    expect(tabs[0]!.parentElement!.className).toMatch(/flex-wrap/);
    expect(tabs[0]!.parentElement!.className).not.toMatch(/overflow-x/);
    cleanup();
  });
});
