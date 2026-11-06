// Phase 0 smoke test (forge/c0-build, design §22.3): under vitest + happy-dom, a dynamic import() of JSON and of
// .md, and a next/dynamic component, all run. The lazy registries of Forge (check, exercises, flows) and the
// loaders rely on exactly these three mechanisms; if one stops working under vitest, the rule for every branch
// changes (UI tests import components statically and registries are tested by calling their loaders).
import { render, screen } from "@testing-library/react";
import dynamic from "next/dynamic";
import { describe, expect, it } from "vitest";

describe("carga perezosa bajo vitest (prueba de humo de la Fase 0)", () => {
  it("import() de JSON entrega el objeto", async () => {
    const mod = await import("./fixtures/lazy-smoke/data.json");
    const data = (mod as { default?: { marca: string } }).default ?? (mod as unknown as { marca: string });
    expect(data.marca).toBe("forge-lazy-json-ok");
  });

  it("import() de .md entrega el texto crudo", async () => {
    const md = (await import("./fixtures/lazy-smoke/book.md")).default;
    expect(typeof md).toBe("string");
    expect(md.startsWith("---\nmodule_id: forge-p2-06")).toBe(true);
    expect(md).toContain("forge-lazy-md-ok");
  });

  it("un componente next/dynamic con ssr: false se monta", async () => {
    const Lazy = dynamic(() => import("./fixtures/lazy-smoke/Widget"), { ssr: false, loading: () => <p>cargando…</p> });
    render(<Lazy label="ok" />);
    expect(await screen.findByText("widget perezoso: ok")).toBeInTheDocument();
  });
});
