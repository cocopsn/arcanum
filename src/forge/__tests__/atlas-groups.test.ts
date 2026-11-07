import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { UTILITY_PRODUCTS, atlasGroups, capabilityPages, rootPartitionId, utilitiesLabel } from "@/forge/atlas/groups";
import type { AtlasManifest } from "@/forge/atlas/types";

// Diseño poblar §7.4: «Utilidades del sitio» va al final y el conteo es honesto. Se mide contra el manifiesto real.
const manifest = JSON.parse(readFileSync(path.join(process.cwd(), "public/atlas/v1/manifest.json"), "utf8")) as AtlasManifest;
const fmt = (n: number) => n.toLocaleString("en-US");

function sum(rootPages: number) {
  const g = atlasGroups(manifest, "en", rootPages);
  return { g, suma: g.products.reduce((a, p) => a + p.pages, 0) + (g.utilidades?.pages ?? 0) };
}

describe("Atlas · grupos (diseño poblar §7.4)", () => {
  it("lists products alphabetically and puts the site utilities last, never among the products", () => {
    const { products, utilidades } = atlasGroups(manifest, "en", 0);
    const names = products.map((p) => p.product);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    for (const u of UTILITY_PRODUCTS) expect(names.includes(u), `«${u}» quedó entre los productos`).toBe(false);
    expect(utilidades).not.toBeNull();
    expect(utilitiesLabel(utilidades!)).toMatch(/^Utilidades del sitio · /);
  });

  it("products plus utilities add up to the language total with and without the root moved", () => {
    const total = manifest.capas.docs.por_idioma.en;
    for (const rootPages of [0, 1]) {
      const { suma } = sum(rootPages);
      expect(suma, `la suma del Atlas dio ${fmt(suma)} de ${fmt(total)}`).toBe(total);
    }
  });

  it("with the root partition loaded the site root leaves foundry for Utilidades", () => {
    const base = atlasGroups(manifest, "en", 0);
    const moved = atlasGroups(manifest, "en", 1);
    const foundry0 = base.products.find((p) => p.product === "foundry")!.pages;
    const foundry1 = moved.products.find((p) => p.product === "foundry")!.pages;
    expect(foundry1, "la raíz del sitio quedó dentro de foundry").toBe(foundry0 - 1);
    expect(moved.utilidades!.raiz).toBe(1);
    expect(utilitiesLabel(moved.utilidades!)).toMatch(/raíz del sitio$/);
    const root = manifest.particiones.find((p) => p.id === rootPartitionId("en"))!;
    expect(capabilityPages(root, "en", 1)).toBe(root.pages - 1);
  });

  it("never moves more pages than the root partition has", () => {
    const root = manifest.particiones.find((p) => p.id === rootPartitionId("en"))!;
    const g = atlasGroups(manifest, "en", 999);
    expect(g.utilidades!.raiz).toBe(root.pages);
  });
});
