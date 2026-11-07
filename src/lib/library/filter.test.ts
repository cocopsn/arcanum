import { afterEach, describe, expect, it } from "vitest";
import { applyFilter, DEFAULT_FILTER, estadoOptions, FILTER_KEY, groupByWorld, loadFilter, normalizeQuery, routeOptions, saveFilter, totals } from "@/lib/library/filter";
import type { LibraryRow } from "@/lib/library/types";

// Filtro de Lecturas (design poblar §5.4): mundo → ruta → estado y búsqueda sin acentos; la suma de los grupos es el
// total; cada opción lleva su conteo; la preferencia se valida contra lo vivo.
const row = (o: Partial<LibraryRow> & { key: string }): LibraryRow => ({
  kind: "libro",
  world: { goalId: "g1", title: "ITC" },
  route: { id: "p1", slug: "p1", name: "P1" },
  cell: { id: null, code: null, title: null },
  title: "Título",
  minutes: null,
  items: null,
  autoria: "autorado",
  generatedBy: "",
  disponible: "incluido",
  disponibleDetalle: "",
  sealed: false,
  source: "seed",
  ...o,
});
const rows: LibraryRow[] = [
  row({ key: "a", title: "Índice B-tree" }),
  row({ key: "b", title: "Árboles", route: { id: "p2", slug: "p2", name: "P2" }, autoria: "verificado" }),
  row({ key: "c", title: "Banco", kind: "banco", world: { goalId: null, title: "Sueltos" }, route: { id: null, slug: null, name: null } }),
  row({ key: "d", title: "Pendiente", disponible: "pendiente", autoria: "especificado", world: { goalId: "g2", title: "Engineering Forge" } }),
  row({ key: "e", title: "Mío", source: "import", autoria: "importado", disponible: "si" }),
];
afterEach(() => localStorage.clear());

describe("Lecturas · filtro (design poblar §5.4)", () => {
  it("busca sin acentos ni mayúsculas, sin regex y con tope de 120", () => {
    expect(applyFilter(rows, { ...DEFAULT_FILTER, q: "indice" }).map((r) => r.key), "la búsqueda sin acentos no encontró «Índice»").toEqual(["a"]);
    expect(applyFilter(rows, { ...DEFAULT_FILTER, q: "(" })).toHaveLength(0);
    expect(normalizeQuery("x".repeat(300))).toHaveLength(120);
  });

  it("mundo, ruta y estado se combinan, y «En este dispositivo» cuenta incluido y propio", () => {
    expect(applyFilter(rows, { ...DEFAULT_FILTER, world: "g1", route: "p2" }).map((r) => r.key)).toEqual(["b"]);
    expect(applyFilter(rows, { ...DEFAULT_FILTER, world: "~" }).map((r) => r.key)).toEqual(["c"]);
    expect(applyFilter(rows, { ...DEFAULT_FILTER, estado: "dispositivo" }).map((r) => r.key)).toEqual(["a", "b", "c", "e"]);
    expect(applyFilter(rows, { ...DEFAULT_FILTER, estado: "importados" }).map((r) => r.key)).toEqual(["e"]);
  });

  it("la suma de los grupos por mundo es el total de arriba, con «Sueltos» al final", () => {
    const g = groupByWorld(rows, ["g2", "g1"]);
    expect(g.map((x) => x.title)).toEqual(["Engineering Forge", "ITC", "Sueltos"]);
    const sum = g.reduce((a, x) => a + x.rows.length, 0);
    expect(sum, `los grupos suman ${sum} y el catálogo filtrado tiene ${rows.length}`).toBe(rows.length);
    expect(totals(rows)).toEqual({ libros: 3, especificados: 1, bancos: 1 });
  });

  it("cada opción lleva su conteo en el alcance de los otros filtros", () => {
    const est = estadoOptions(rows, { ...DEFAULT_FILTER, world: "g1" });
    expect(est.find((e) => e.id === "verificado")!.count).toBe(1);
    const rutas = routeOptions(rows, { ...DEFAULT_FILTER, world: "g1" }, [{ id: "p1", name: "P1" }, { id: "p2", name: "P2" }]);
    expect(rutas.map((r) => [r.id, r.count])).toEqual([["*", 3], ["p1", 2], ["p2", 1]]);
  });

  it("la preferencia del dispositivo se guarda sin la búsqueda y un valor que ya no existe vuelve a «Todos»", () => {
    saveFilter({ world: "g1", route: "p2", estado: "verificado", q: "secreto" });
    expect(JSON.parse(localStorage.getItem(FILTER_KEY)!)).toEqual({ v: 1, world: "g1", route: "p2", estado: "verificado" });
    expect(loadFilter({ worlds: new Set(["g1"]), routes: () => new Set(["p2"]) })).toEqual({ world: "g1", route: "p2", estado: "verificado", q: "" });
    expect(loadFilter({ worlds: new Set(["otro"]), routes: () => new Set() })).toEqual({ ...DEFAULT_FILTER, estado: "verificado" });
    localStorage.setItem(FILTER_KEY, "{roto");
    expect(loadFilter({ worlds: new Set(), routes: () => new Set() })).toEqual(DEFAULT_FILTER);
  });
});
