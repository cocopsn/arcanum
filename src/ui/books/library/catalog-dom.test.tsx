import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React, { useEffect } from "react";
import { cleanup, render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { RowCard } from "@/ui/books/library/LibraryCatalog";
import { ChunkBoundary } from "@/ui/books/library/ChunkBoundary";
import { useLazyModule } from "@/ui/books/library/use-lazy-module";
import { isPendingItem } from "@/forge/ui/ForgeEvaluations";
import { CHUNK_NOT_DOWNLOADED } from "@/lib/offline-texts";
import type { LibraryRow } from "@/lib/library/types";

// Lecturas en el DOM (design poblar §5.5–§5.8): fog-of-war, objetivos de 44 px, carga perezosa con reintento,
// ChunkBoundary que no se traga otros errores, la marca «sin verificar» y el texto de entrada sin un generador único.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const row = (o: Partial<LibraryRow>): LibraryRow => ({
  key: "forge-banco:P2-06",
  kind: "banco",
  world: { goalId: "g", title: "Engineering Forge" },
  route: { id: "p", slug: "p2", name: "P2 · Ontology" },
  cell: { id: "c", code: "P2-06", title: "P2-06 · Edits, concurrencia y efectos externos" },
  title: "Ejercicios — Edits, concurrencia y efectos externos",
  minutes: null,
  items: { total: 9, disponibles: 6 },
  autoria: "autorado",
  generatedBy: "Claude (Anthropic) · agente Kiro",
  disponible: "incluido",
  disponibleDetalle: "Incluido en la app",
  sealed: false,
  source: "forge",
  ...o,
});
const noop = () => {};

describe("Lecturas · fila (design poblar §5.5 y §5.6)", () => {
  it("el banco de una celda sellada no ofrece trabajo; el libro de una celda sellada sí se lee", () => {
    render(<RowCard row={row({ sealed: true })} note={null} onLeer={noop} onEjercicios={noop} onEvaluaciones={noop} onBorrar={noop} />);
    expect(screen.queryByRole("button", { name: "Evaluaciones" }), "el banco de una celda sellada ofreció sus ejercicios desde Lecturas").toBeNull();
    expect(screen.getByText("Celda sellada · domina lo anterior")).toBeInTheDocument();
    cleanup();
    render(<RowCard row={row({ key: "forge-libro:P2-06", kind: "libro", sealed: true, items: null, minutes: 40 })} note={null} onLeer={noop} onEjercicios={noop} onEvaluaciones={noop} onBorrar={noop} />);
    expect(screen.getByRole("button", { name: "Leer" })).toBeInTheDocument();
  });

  it("los botones son de 44 px, el título trae title y generated_by sale completo en title", () => {
    render(<RowCard row={row({})} note={null} onLeer={noop} onEjercicios={noop} onEvaluaciones={noop} onBorrar={noop} />);
    expect(screen.getByRole("button", { name: "Evaluaciones" }).className).toMatch(/\btap\b/);
    expect(screen.getByTitle("P2-06 · Edits, concurrencia y efectos externos")).toBeInTheDocument();
    expect(screen.getByTitle("Claude (Anthropic) · agente Kiro")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Borrar" }), "una semilla de Forge ofreció «Borrar»").toBeNull();
  });
});

function Lazy({ load }: { load: () => Promise<{ v: string }> }) {
  const s = useLazyModule(load);
  if (s.estado === "listo") return <p>listo {s.mod.v}</p>;
  if (s.estado === "error") return <button onClick={s.reintentar}>Reintentar</button>;
  return <p>cargando</p>;
}
describe("Lecturas · carga perezosa (design poblar §5.7)", () => {
  it("un import() que rechaza deja reintentar, y el reintento pinta el módulo", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let n = 0;
    const load = () => (++n === 1 ? Promise.reject(Object.assign(new Error("Loading chunk 77 failed"), { name: "ChunkLoadError" })) : Promise.resolve({ v: "ok" }));
    render(<Lazy load={load} />);
    const retry = await screen.findByRole("button", { name: "Reintentar" });
    await act(async () => fireEvent.click(retry));
    await waitFor(() => expect(screen.queryByText("listo ok"), "un chunk ausente de Lecturas tumbó toda la pantalla").not.toBeNull());
  });
});

function Boom({ err }: { err: Error }): React.ReactElement {
  throw err;
}
class Catch extends React.Component<{ children: React.ReactNode }, { caught: string | null }> {
  state = { caught: null as string | null };
  static getDerivedStateFromError(e: Error) {
    return { caught: e.message };
  }
  render() {
    return this.state.caught ? <p>arriba: {this.state.caught}</p> : this.props.children;
  }
}
describe("Lecturas · ChunkBoundary (design poblar §5.7)", () => {
  it("un corredor sin chunk deja el texto sin red; un error que no es de chunk sigue hacia arriba", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    render(
      <ChunkBoundary onClose={noop}>
        <Boom err={Object.assign(new Error("Loading chunk 9 failed"), { name: "ChunkLoadError" })} />
      </ChunkBoundary>,
    );
    expect(screen.getByText(CHUNK_NOT_DOWNLOADED)).toBeInTheDocument();
    cleanup();
    render(
      <Catch>
        <ChunkBoundary onClose={noop}>
          <Boom err={new Error("otro")} />
        </ChunkBoundary>
      </Catch>,
    );
    expect(screen.queryByText("arriba: otro"), "ChunkBoundary se tragó un error que no era de chunk").not.toBeNull();
  });
});

describe("Lecturas · marcas y textos", () => {
  it("un ítem pendiente se marca por su id completo (<idBase>:<itemId>, H25)", () => {
    const pend = ["forge-p2-06:p206-desv-version"];
    expect(isPendingItem({ id: "forge-p2-06:p206-desv-version" }, pend), "el ítem pendiente p206-desv-version no dice sin verificar").toBe(true);
    expect(isPendingItem({ id: "forge-p2-06:p206-sql-1" }, pend)).toBe(false);
  });

  it("el texto de entrada no afirma un solo generador", () => {
    const src = readFileSync(join(process.cwd(), "src/ui/books/BooksLibrary.tsx"), "utf8");
    expect(src.includes("Sonnet 5"), "Lecturas afirma un solo generador").toBe(false);
    expect(src).toContain("Libros y bancos de todos los mundos. Cada uno dice quién lo generó.");
  });
});
