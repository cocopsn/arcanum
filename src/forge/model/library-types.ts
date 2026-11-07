// Esquema v1 de src/forge/data/library-index.json, el índice de Lecturas (design poblar §5.2). Contrato congelado de
// la Fase 0: lo escribe scripts/forge/library-index.mjs en el build y lo lee el catálogo de Lecturas en un chunk
// perezoso. Sólo títulos, minutos, conteos, estados y `generated_by`: ninguna línea de prosa de un libro ni el
// enunciado de un ítem. Sólo tipos: este módulo no carga el JSON.

/** 136 entradas: las celdas de clase ruta y expediente, por código (`F0-04`, `SD-01`). */
export interface LibraryIndex {
  v: 1;
  celdas: Record<string, LibraryCell>;
}

export interface LibraryCell {
  /** slug de FORGE_PATHS */
  ruta: string;
  cls: "ruta" | "expediente";
  /** El libro publicado (book-index.json más su frontmatter); null en las celdas sin libro (P5-01 a P5-08). */
  libro: {
    file: string;
    sha10: string;
    bytes: number;
    minutes: number | null;
    title: string;
    generated_by: string;
    estado_declarado: string;
  } | null;
  /** El banco publicado; null si la celda no tiene banco. */
  banco: {
    sha10: string;
    title: string;
    generated_by: string;
    items: number;
    /** el `id:` pelado de cada ítem pendiente (sin el `<idBase>:` que antepone la ingesta) */
    pendientes: string[];
    /** trae ítems `code`, `choice` o `production` (los que pinta ExerciseMode) */
    codigo: boolean;
  } | null;
  /** Estado de autoría con las reglas de authoring.ts; `estado: null` = ficha incompleta. */
  autoria: { estado: "especificado" | "autorado" | "verificado" | null; ejecutables: number; sin_verificar: number };
}
