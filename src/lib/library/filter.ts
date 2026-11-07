// Filtro del catálogo de Lecturas (design poblar §5.4). Puro salvo la preferencia del dispositivo en localStorage.
// Mundo → ruta → estado, y una búsqueda sin regex (NFD sin diacríticos, minúsculas, 120 caracteres) sobre título,
// título de celda y código. Los conteos de cada opción salen del catálogo completo en el alcance de los otros filtros.
import type { LibraryRow } from "@/lib/library/types";

export type Estado = "todos" | "verificado" | "autorado" | "especificado" | "dispositivo" | "importados";
export const ESTADOS: readonly { id: Estado; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "verificado", label: "Verificado" },
  { id: "autorado", label: "Autorado" },
  { id: "especificado", label: "Especificado" },
  { id: "dispositivo", label: "En este dispositivo" },
  { id: "importados", label: "Importados" },
];
/** world/route: "*" = todos; world "~" = Sueltos; route "~" = Sin ruta. */
export interface LibraryFilter {
  world: string;
  route: string;
  estado: Estado;
  q: string;
}
export const DEFAULT_FILTER: LibraryFilter = { world: "*", route: "*", estado: "todos", q: "" };
export const FILTER_KEY = "arcanum.lecturas.filtro.v1";

export const normalizeQuery = (s: string) =>
  s
    .slice(0, 120)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const worldKey = (r: LibraryRow) => r.world.goalId ?? "~";
const routeKey = (r: LibraryRow) => r.route.id ?? "~";

function matchEstado(r: LibraryRow, e: Estado): boolean {
  switch (e) {
    case "todos":
      return true;
    case "verificado":
    case "autorado":
    case "especificado":
      return r.autoria === e;
    case "dispositivo":
      return r.disponible === "si" || r.disponible === "incluido";
    case "importados":
      return r.source === "import" || r.autoria === "importado";
  }
}
function matchQuery(r: LibraryRow, q: string): boolean {
  if (!q) return true;
  return [r.title, r.cell.title ?? "", r.cell.code ?? ""].some((s) => normalizeQuery(s).includes(q));
}

export function applyFilter(rows: readonly LibraryRow[], f: LibraryFilter): LibraryRow[] {
  const q = normalizeQuery(f.q);
  return rows.filter(
    (r) =>
      (f.world === "*" || worldKey(r) === f.world) &&
      (f.route === "*" || routeKey(r) === f.route) &&
      matchEstado(r, f.estado) &&
      matchQuery(r, q),
  );
}

export interface Totales {
  libros: number;
  especificados: number;
  bancos: number;
}
export function totals(rows: readonly LibraryRow[]): Totales {
  let libros = 0;
  let especificados = 0;
  let bancos = 0;
  for (const r of rows) {
    if (r.kind === "banco") bancos++;
    else if (r.disponible === "pendiente") especificados++;
    else libros++;
  }
  return { libros, especificados, bancos };
}

export interface Grupo {
  key: string;
  title: string;
  rows: LibraryRow[];
  totales: Totales;
  verificados: number;
  autorados: number;
}
/** Un grupo por mundo, en el orden de `worldOrder` (goals vivos) y «Sueltos» al final. La suma de los grupos es el total. */
export function groupByWorld(rows: readonly LibraryRow[], worldOrder: readonly string[]): Grupo[] {
  const by = new Map<string, LibraryRow[]>();
  for (const r of rows) {
    const k = worldKey(r);
    by.set(k, [...(by.get(k) ?? []), r]);
  }
  const keys = [...by.keys()].sort((a, b) => {
    const ia = a === "~" ? Number.MAX_SAFE_INTEGER : worldOrder.indexOf(a) === -1 ? 1e9 : worldOrder.indexOf(a);
    const ib = b === "~" ? Number.MAX_SAFE_INTEGER : worldOrder.indexOf(b) === -1 ? 1e9 : worldOrder.indexOf(b);
    return ia - ib;
  });
  return keys.map((k) => {
    const rs = by.get(k)!;
    const libros = rs.filter((r) => r.kind === "libro" && r.disponible !== "pendiente");
    return {
      key: k,
      title: rs[0]!.world.title,
      rows: rs,
      totales: totals(rs),
      verificados: libros.filter((r) => r.autoria === "verificado").length,
      autorados: libros.filter((r) => r.autoria === "autorado").length,
    };
  });
}

export interface Opcion {
  id: string;
  label: string;
  count: number;
  group?: string;
}
/** Opciones del filtro de mundo con su conteo en el alcance de ruta y estado (la ruta se ignora: depende del mundo). */
export function worldOptions(rows: readonly LibraryRow[], f: LibraryFilter, goals: readonly { id: string; title: string }[]): Opcion[] {
  const scope = applyFilter(rows, { ...f, world: "*", route: "*" });
  const opts: Opcion[] = [{ id: "*", label: "Todos los mundos", count: scope.length }];
  for (const g of goals) {
    const n = scope.filter((r) => r.world.goalId === g.id).length;
    if (rows.some((r) => r.world.goalId === g.id)) opts.push({ id: g.id, label: g.title, count: n });
  }
  if (rows.some((r) => r.world.goalId === null)) opts.push({ id: "~", label: "Sueltos", count: scope.filter((r) => r.world.goalId === null).length });
  return opts;
}
/** Rutas del mundo elegido (los paths del mundo, o las rutas de Forge agrupadas por familia) con su conteo. */
export function routeOptions(
  rows: readonly LibraryRow[],
  f: LibraryFilter,
  paths: readonly { id: string; name: string; group?: string }[],
): Opcion[] {
  if (f.world === "*") return [{ id: "*", label: "Todas las rutas", count: 0 }];
  const scope = applyFilter(rows, { ...f, route: "*" });
  const opts: Opcion[] = [{ id: "*", label: "Todas las rutas", count: scope.length }];
  for (const p of paths) opts.push({ id: p.id, label: p.name, count: scope.filter((r) => r.route.id === p.id).length, group: p.group });
  const sueltos = scope.filter((r) => r.route.id === null).length;
  if (rows.some((r) => (r.world.goalId ?? "~") === f.world && r.route.id === null)) opts.push({ id: "~", label: "Sin ruta", count: sueltos });
  return opts;
}
export function estadoOptions(rows: readonly LibraryRow[], f: LibraryFilter): Opcion[] {
  const scope = applyFilter(rows, { ...f, estado: "todos" });
  return ESTADOS.map((e) => ({ id: e.id, label: e.label, count: scope.filter((r) => matchEstado(r, e.id)).length }));
}

/** Preferencia del dispositivo, validada contra lo vivo; cualquier valor que no pase vuelve a «Todos». */
export function loadFilter(valid: { worlds: ReadonlySet<string>; routes: (world: string) => ReadonlySet<string> }): LibraryFilter {
  try {
    const raw = globalThis.localStorage?.getItem(FILTER_KEY);
    if (!raw) return DEFAULT_FILTER;
    const v = JSON.parse(raw) as Partial<LibraryFilter> & { v?: number };
    if (v.v !== 1) return DEFAULT_FILTER;
    const world = typeof v.world === "string" && (v.world === "*" || valid.worlds.has(v.world)) ? v.world : "*";
    const route = world !== "*" && typeof v.route === "string" && (v.route === "*" || valid.routes(world).has(v.route)) ? v.route : "*";
    const estado = ESTADOS.some((e) => e.id === v.estado) ? (v.estado as Estado) : "todos";
    return { world, route, estado, q: "" };
  } catch {
    return DEFAULT_FILTER;
  }
}
export function saveFilter(f: LibraryFilter): void {
  try {
    globalThis.localStorage?.setItem(FILTER_KEY, JSON.stringify({ v: 1, world: f.world, route: f.route, estado: f.estado }));
  } catch {
    /* sin almacenamiento: el filtro vive en memoria */
  }
}
