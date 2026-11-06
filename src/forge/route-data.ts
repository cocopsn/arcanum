// TYPE ONLY: ForgeRouteData, the shape of src/forge/data/routes/<slug>.json (design §5.2), transcribed verbatim so
// that loaders.ts and flow-contract.ts (Phase 0, forge/c0-contenido) compile before forge/c0-nucleo lands the data.
// c0-nucleo owns the data and its generator (scripts/forge/extract-maestro.mjs); if it declares these types in
// another module, the integration makes that module re-export from here (or vice versa) so there is ONE source.

export type ForgeCapability = "algoritmos" | "abstraccion" | "sistemas" | "datos" | "ia" | "producto" | "comunicacion" | "responsabilidad";

export type ForgeFlujo = "mision" | "entrevista" | "expediente" | "diagnostico" | "proyecto" | "ontologia" | "gameday";

/** The only `kind` that opens the cell (§8.1); null in D1-D8. */
export type ForgeCompuerta = "mision" | "entrevista" | "expediente" | "ontologia" | "gameday" | null;

export interface SourceRef {
  clave: string;
  etiqueta: string;
  url: string;
  tipo: "docs" | "curso" | "paper" | "blog" | "video" | "comunitario" | "otro";
  acceso: "publico" | "instancia" | "cuenta" | "pago";
}

export interface ForgeCellData {
  code: string;
  id: string;
  title: string;
  cls: "ruta" | "diagnostico" | "reto" | "expediente";
  flujo: ForgeFlujo;
  compuerta: ForgeCompuerta;
  ficha: { foco?: string; resultado?: string; fuentes: SourceRef[]; mision: string; defensa: string; transferencia?: string; variante?: string };
  /** essential capabilities, ≥ 1 */
  capacidades: ForgeCapability[];
  /** one literal phrase of the ficha per declared capability */
  rastroCapacidades: Partial<Record<ForgeCapability, string>>;
  /** ≥ 1 */
  criticas: { id: string; texto: string; rastro: string }[];
  naturaleza: { valor: "a_mano" | "delegable" | "mixto"; rastro?: string };
  alcance: "local" | "local+nativa";
  requireEnglish?: true;
  /** only A1 and A2 */
  equivalencias?: { celdas: string[] } | { sinEquivalente: true };
  /** X and SD: codes of cells or projects */
  usadoEn?: string[];
  /** §5.5 honesty labels */
  etiquetas: string[];
  /** diagnostic task, challenge and case data; their exact shapes are c0-nucleo's (§8.6, §5.6) */
  d?: unknown;
  x?: unknown;
  sd?: unknown;
}

export interface ForgeRouteData {
  v: 1;
  slug: string;
  code: string;
  name: string;
  family: string;
  header: { entrada: string; entradaRecomendada: string[]; evidencia: string; apoyo: SourceRef[] };
  cells: ForgeCellData[];
}
