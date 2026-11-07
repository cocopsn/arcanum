// Filas del catálogo de Lecturas (design poblar §5.1). Contrato congelado de la Fase 0: lo llena poblar/lecturas
// con los libros y bancos de Dexie de los mundos clásicos, las importaciones del aprendiz y library-index.json de
// Engineering Forge. Sólo tipos.

export type Autoria = "verificado" | "autorado" | "especificado" | "importado" | "incompleta";
export type Disponible = "si" | "incluido" | "anterior" | "no" | "pendiente";

export interface LibraryRow {
  /** "libro:<id>" | "banco:<id>" | "forge-libro:<código>" | "forge-banco:<código>" */
  key: string;
  kind: "libro" | "banco";
  /** goalId null = «Sueltos» */
  world: { goalId: string | null; title: string };
  route: { id: string | null; slug: string | null; name: string | null };
  cell: { id: string | null; code: string | null; title: string | null };
  title: string;
  /** libros */
  minutes: number | null;
  /** bancos (los pendientes no cuentan como disponibles) */
  items: { total: number; disponibles: number } | null;
  autoria: Autoria;
  /** el frontmatter tal cual; "" se pinta «sin dato» */
  generatedBy: string;
  disponible: Disponible;
  /** texto exacto de §5.3 */
  disponibleDetalle: string;
  /** fog-of-war de la celda (§5.6) */
  sealed: boolean;
  source: "seed" | "import" | "forge";
  /** bankCodigo: el banco trae ítems code, choice o production */
  forge?: { file: string | null; sha10: string | null; bankCodigo: boolean };
}
