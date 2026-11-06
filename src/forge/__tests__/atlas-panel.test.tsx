import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AtlasEntry, AtlasPanel } from "@/forge/ui/atlas/AtlasPanel";
import type { AtlasManifest, AtlasPartitionFile } from "@/forge/atlas/types";
import { isAllowedSource } from "@/lib/spines";

// Atlas P0 mínimo: conteo real del manifiesto, partición perezosa al expandir, búsqueda sólo sobre lo cargado
// (y lo dice), filas con título, migas, enlace ↗ externo y la nota de captura. Y el visor del servidor NO se
// abre a las páginas del Atlas: /api/fetch-source sigue con su allowlist exacta.

const manifest = {
  v: 1,
  capturado: "2026-11-05",
  capas: { docs: { paginas: 12019, por_idioma: { en: 2, jp: 0, zh: 0, kr: 0 } } },
  particiones: [
    { id: "en/foundry/ontology", files: ["docs/en/foundry/ontology.abc.json"], bytes: 10, pages: 2, sitemap: 2 },
  ],
} as unknown as AtlasManifest;

const partition: AtlasPartitionFile = {
  v: 1,
  id: "en/foundry/ontology",
  pages: [
    { k: "foundry/ontology/overview", u: "https://www.palantir.com/docs/foundry/ontology/overview", t: "Ontology overview", b: ["Foundry", "Ontology"], p: "foundry", c: "ontology", s: "", l: "en", h: [], i: [], vd: [], lm: null, cells: [] },
    { k: "foundry/ontology/links", u: "https://www.palantir.com/docs/foundry/ontology/links", t: "Link types", b: ["Foundry", "Ontology"], p: "foundry", c: "ontology", s: "", l: "en", h: [], i: [], vd: [], lm: null, cells: [] },
  ],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Atlas · entrada y panel", () => {
  it("la entrada pinta el conteo del manifiesto, y sin manifiesto lo dice sin inventar", () => {
    render(<AtlasEntry state={{ status: "listo", manifest }} onOpen={() => {}} />);
    expect(screen.getByRole("button", { name: /ATLAS · 12,019 páginas/ })).toBeTruthy();
    cleanup();
    render(<AtlasEntry state={{ status: "error" }} onOpen={() => {}} />);
    const b = screen.getByRole("button", { name: /no disponible sin conexión/ }) as HTMLButtonElement;
    expect(b.disabled).toBe(true);
  });

  it("carga la partición sólo al expandir, pinta filas con enlace externo y busca sobre lo cargado", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(partition), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AtlasPanel manifest={manifest} onClose={() => {}} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/sólo las particiones cargadas en este dispositivo \(0\)/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /ontology · 2/ }));
    const link = (await screen.findByRole("link", { name: /Ontology overview/ })) as HTMLAnchorElement;
    expect(fetchMock).toHaveBeenCalledWith("/atlas/v1/docs/en/foundry/ontology.abc.json");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.getAttribute("href")).toBe("https://www.palantir.com/docs/foundry/ontology/overview");
    expect(screen.getAllByText(/capturado el 2026-11-05; la página viva puede haber cambiado/).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "link" } });
    await waitFor(() => expect(screen.getByText("1 resultados")).toBeTruthy());
    expect(screen.getByRole("link", { name: /Link types/ })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Ontology overview/ })).toBeNull();
  });

  it("una partición que no baja dice «no descargada», sin filas inventadas", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    render(<AtlasPanel manifest={manifest} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /ontology · 2/ }));
    expect(await screen.findByText(/Partición no descargada en este dispositivo/)).toBeTruthy();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});

describe("/api/fetch-source · el Atlas no amplía la allowlist", () => {
  it("una página del Atlas que ninguna celda cita NO es una fuente que el servidor pueda pedir", () => {
    expect(isAllowedSource("https://www.palantir.com/docs/foundry/ontology/links")).toBe(false);
    expect(isAllowedSource("https://www.palantir.com/docs/foundry/some-page-not-cited-xyz")).toBe(false);
  });
});
