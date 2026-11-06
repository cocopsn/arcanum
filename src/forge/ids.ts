// ENGINEERING FORGE — identity (design §4.1, §4.4). Every id is a lowercase UUID with version 4 and variant 8
// written by hand (Amoxtli's are version 5, so no Forge id can ever equal one of them). Cell ids are DERIVED
// from the cell code, never from a position: inserting a world before Forge in SPINES changes nothing here.
import { FORGE_GOAL_ID } from "@/core/forge-verdict";

export { FORGE_GOAL_ID };

/** Prefix of every Forge cell id. */
export const FORGE_CELL_PREFIX = "cf000000-0000-4000-8000-";
/** Prefix of every Forge seed event id. */
export const FORGE_EVENT_PREFIX = "b5000000-";
/** The goal event id (literal). */
export const FORGE_GOAL_EVENT_ID = "b5000000-0000-4000-8000-000000000001";

export type ForgePathSlug =
  | "f0" | "a1" | "a2" | "s1" | "s2" | "p1" | "p2" | "p3" | "p4" | "p5"
  | "f1" | "f2" | "sw1" | "sw2" | "sw3" | "sw4" | "diagnostico" | "retos" | "expedientes";

export interface ForgePathDef {
  slug: ForgePathSlug;
  /** code of the path: F0 … SW4, D, X, SD */
  code: string;
  /** literal id (table of §4.1, never computed by index) */
  id: string;
  /** number of cells (RF-M3) */
  cells: number;
}

/** The 19 paths in the order of RF-M2, with their literal ids (§4.1). */
export const FORGE_PATHS: readonly ForgePathDef[] = [
  { slug: "f0", code: "F0", id: "a1000000-0000-4000-8000-000000000007", cells: 8 },
  { slug: "a1", code: "A1", id: "a1000000-0000-4000-8000-000000000008", cells: 8 },
  { slug: "a2", code: "A2", id: "a1000000-0000-4000-8000-000000000009", cells: 8 },
  { slug: "s1", code: "S1", id: "a1000000-0000-4000-8000-000000000010", cells: 8 },
  { slug: "s2", code: "S2", id: "a1000000-0000-4000-8000-000000000011", cells: 8 },
  { slug: "p1", code: "P1", id: "a1000000-0000-4000-8000-000000000012", cells: 8 },
  { slug: "p2", code: "P2", id: "a1000000-0000-4000-8000-000000000013", cells: 8 },
  { slug: "p3", code: "P3", id: "a1000000-0000-4000-8000-000000000014", cells: 8 },
  { slug: "p4", code: "P4", id: "a1000000-0000-4000-8000-000000000015", cells: 8 },
  { slug: "p5", code: "P5", id: "a1000000-0000-4000-8000-000000000016", cells: 8 },
  { slug: "f1", code: "F1", id: "a1000000-0000-4000-8000-000000000017", cells: 8 },
  { slug: "f2", code: "F2", id: "a1000000-0000-4000-8000-000000000018", cells: 8 },
  { slug: "sw1", code: "SW1", id: "a1000000-0000-4000-8000-000000000019", cells: 7 },
  { slug: "sw2", code: "SW2", id: "a1000000-0000-4000-8000-000000000020", cells: 7 },
  { slug: "sw3", code: "SW3", id: "a1000000-0000-4000-8000-000000000021", cells: 7 },
  { slug: "sw4", code: "SW4", id: "a1000000-0000-4000-8000-000000000022", cells: 7 },
  { slug: "diagnostico", code: "D", id: "a1000000-0000-4000-8000-000000000023", cells: 8 },
  { slug: "retos", code: "X", id: "a1000000-0000-4000-8000-000000000024", cells: 24 },
  { slug: "expedientes", code: "SD", id: "a1000000-0000-4000-8000-000000000025", cells: 12 },
];

/** slug → path id */
export const FORGE_PATH_IDS: Readonly<Record<ForgePathSlug, string>> = Object.fromEntries(
  FORGE_PATHS.map((p) => [p.slug, p.id]),
) as Record<ForgePathSlug, string>;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** The cell codes of one path, in order: F0-01…, D1…D8, X01…X24, SD-01…SD-12. */
export function forgePathCellCodes(p: ForgePathDef): string[] {
  const out: string[] = [];
  for (let i = 1; i <= p.cells; i++) {
    if (p.code === "D") out.push(`D${i}`);
    else if (p.code === "X") out.push(`X${pad2(i)}`);
    else out.push(`${p.code}-${pad2(i)}`);
  }
  return out;
}

/** The 168 cell codes in the order of RF-M2 / RF-M3. */
export const FORGE_CELL_CODES: readonly string[] = FORGE_PATHS.flatMap(forgePathCellCodes);

const CODE_RE = /^[A-Z0-9-]{1,6}$/;

/** ASCII of the code in lowercase hex, left-padded with zeros to 12 digits. Throws outside ^[A-Z0-9-]{1,6}$
 *  (6 characters × 2 hex digits = 12, and no code starts with NUL, so the encoding is injective). */
export function codeHex(code: string): string {
  if (!CODE_RE.test(code)) throw new Error(`código de Forge inválido: ${JSON.stringify(code)}`);
  let hex = "";
  for (let i = 0; i < code.length; i++) hex += code.charCodeAt(i).toString(16).padStart(2, "0");
  return hex.padStart(12, "0");
}

/** cf000000-0000-4000-8000-<codeHex(code)> */
export function forgeCellId(code: string): string {
  return FORGE_CELL_PREFIX + codeHex(code);
}

/** Seed event ids: K = 0001 path (path code), 0002 module (cell code), 0003 edge (code of the DESTINATION
 *  cell; every cell has at most one incoming edge). Future Forge blocks use K = 0004 onwards. */
export function forgeEventId(kind: "path" | "module" | "edge", code: string): string {
  const k = kind === "path" ? "0001" : kind === "module" ? "0002" : "0003";
  return `${FORGE_EVENT_PREFIX}${k}-4000-8000-${codeHex(code)}`;
}

const CELL_IDS = new Map<string, string>(FORGE_CELL_CODES.map((c) => [forgeCellId(c), c]));

/** Is this one of the 168 Forge cell ids? (exact set, not just the prefix) */
export function isForgeCellId(id: string | null | undefined): boolean {
  return typeof id === "string" && CELL_IDS.has(id);
}

/** cell id → code, or null */
export function forgeCodeForCellId(id: string | null | undefined): string | null {
  return typeof id === "string" ? (CELL_IDS.get(id) ?? null) : null;
}

/** D1–D8: the diagnostic tasks (observations, never a compuerta). Lives here so the page chunk never needs
 *  a model module to ask it (review NIT 6). */
export function isDiagnosticCode(code: string | null | undefined): boolean {
  return typeof code === "string" && /^D[1-8]$/.test(code);
}

/** Anchor slugs (§4.4): "forge-" + the code in lowercase → cell id (168 entries). */
export const FORGE_SLUG_TO_ID: Readonly<Record<string, string>> = Object.fromEntries(
  FORGE_CELL_CODES.map((c) => [`forge-${c.toLowerCase()}`, forgeCellId(c)]),
);
