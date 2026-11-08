// Plugin rehype para las notas al pie de GFM del compañero (design §15, NIT 3 de r4). Sin él, el panel repite
// id="footnote-label" entre dos mensajes y pinta etiquetas en inglés. El plugin recorre el árbol hast y, en la
// `section` con `data-footnotes`:
//   - borra el encabezado `#footnote-label` (el «Footnotes» en inglés),
//   - le pone `aria-label="Notas"` a la section,
//   - le quita `id` y `aria-describedby` a lo que los lleve (para no repetir ids entre mensajes),
//   - no agrega ninguna className.
// Es un plugin puro de árbol (unist): no toca el DOM ni la red. Tipos mínimos para no depender de @types/hast.

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/** Un nodo es la `section` de notas si es `<section data-footnotes>`. */
function esSeccionNotas(n: HastNode): boolean {
  return n.type === "element" && n.tagName === "section" && !!n.properties && "dataFootnotes" in n.properties;
}

/** Quita id y aria-describedby de un nodo y, recursivo, de sus descendientes. */
function limpiarIds(n: HastNode): void {
  if (n.properties) {
    delete n.properties.id;
    delete n.properties.ariaDescribedBy;
  }
  for (const c of n.children ?? []) limpiarIds(c);
}

/** Borra el encabezado cuyo id es `footnote-label` dentro de un subárbol. */
function quitarEncabezado(n: HastNode): void {
  if (!n.children) return;
  n.children = n.children.filter((c) => !(c.type === "element" && c.properties?.id === "footnote-label"));
  for (const c of n.children) quitarEncabezado(c);
}

/** El plugin rehype: devuelve un transformador sobre el árbol. */
export function notasSinIds() {
  return (arbol: HastNode): void => recorrer(arbol);
}

function recorrer(n: HastNode): void {
  if (esSeccionNotas(n)) {
    n.properties = n.properties ?? {};
    n.properties.ariaLabel = "Notas";
    quitarEncabezado(n);
    for (const c of n.children ?? []) limpiarIds(c);
    return;
  }
  for (const c of n.children ?? []) recorrer(c);
}
