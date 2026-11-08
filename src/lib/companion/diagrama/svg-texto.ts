// Serializa un modelo de diagrama (§16.3) a una cadena SVG con lista blanca de elementos y atributos (design §16.4).
// Monocromo sobre blanco (SÓLO #ffffff de fondo, #1e2124 de texto, #494a4b de trazo): es la excepción declarada de §7
// (colores.test.ts exige que sus únicos literales de color sean esos tres). El archivo se abre fuera de la app, por eso
// no lleva `currentColor` ni clases. Pura: no hay DOM. Escapa & < > " ' en todo texto y atributo, así que nada del
// modelo puede cerrar una etiqueta ni inyectar un atributo (sin foreignObject/script/image/href/on*).
import type { ModeloDiagrama, CajaDibujo, AristaDibujo } from "./layout";

const FONDO = "#ffffff";
const TEXTO = "#1e2124";
const TRAZO = "#494a4b";
const FUENTE = "Helvetica, Arial, sans-serif";

/** Lista blanca de elementos y de los atributos que cada uno puede llevar (sólo geometría y color de la escala). */
const PERMITIDOS: Record<string, Set<string>> = {
  svg: new Set(["xmlns", "viewBox", "width", "height", "font-family"]),
  g: new Set([]),
  defs: new Set([]),
  marker: new Set(["id", "markerWidth", "markerHeight", "refX", "refY", "orient", "markerUnits"]),
  rect: new Set(["x", "y", "width", "height", "rx", "ry", "fill", "stroke", "stroke-width", "stroke-dasharray"]),
  ellipse: new Set(["cx", "cy", "rx", "ry", "fill", "stroke", "stroke-width"]),
  polygon: new Set(["points", "fill", "stroke", "stroke-width"]),
  path: new Set(["d", "fill", "stroke", "stroke-width", "stroke-dasharray", "marker-end"]),
  line: new Set(["x1", "y1", "x2", "y2", "stroke", "stroke-width", "stroke-dasharray"]),
  text: new Set(["x", "y", "fill", "font-size", "font-weight", "text-anchor"]),
  tspan: new Set(["x", "y", "dy", "fill"]),
  title: new Set([]),
};

/** Escapa los cinco caracteres peligrosos en texto y en valores de atributo. */
function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Un número redondeado a 2 decimales como cadena segura (nunca NaN ni notación científica rara). */
function num(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return (Math.round(n * 100) / 100).toString();
}

interface Nodo {
  tag: keyof typeof PERMITIDOS;
  attrs?: Record<string, string | number>;
  hijos?: Nodo[];
  texto?: string;
}

/** Arma la cadena de un nodo pasando cada atributo por la lista blanca y escapando todo. Un atributo fuera de la lista
 *  se omite (no se emite jamás un `on*`, `href` ni `xlink:href`). */
function render(n: Nodo): string {
  const permit = PERMITIDOS[n.tag];
  if (!permit) return "";
  const attrs = Object.entries(n.attrs ?? {})
    .filter(([k]) => permit.has(k))
    .map(([k, v]) => `${k}="${esc(String(v))}"`)
    .join(" ");
  const abre = attrs ? `<${n.tag} ${attrs}>` : `<${n.tag}>`;
  const dentro = (n.texto !== undefined ? esc(n.texto) : "") + (n.hijos ?? []).map(render).join("");
  return `${abre}${dentro}</${n.tag}>`;
}

function dCaja(c: CajaDibujo): Nodo {
  const { x, y, ancho: w, alto: h } = c;
  const base = { fill: FONDO, stroke: TRAZO, "stroke-width": 1 };
  switch (c.forma) {
    case "redondo":
      return { tag: "rect", attrs: { x: num(x), y: num(y), width: num(w), height: num(h), rx: 10, ry: 10, ...base } };
    case "circulo":
      return { tag: "ellipse", attrs: { cx: num(x + w / 2), cy: num(y + h / 2), rx: num(w / 2), ry: num(h / 2), ...base } };
    case "rombo":
      return {
        tag: "polygon",
        attrs: { points: `${num(x + w / 2)},${num(y)} ${num(x + w)},${num(y + h / 2)} ${num(x + w / 2)},${num(y + h)} ${num(x)},${num(y + h / 2)}`, ...base },
      };
    case "cilindro":
      return {
        tag: "path",
        attrs: { d: `M${num(x)},${num(y + 6)} C${num(x)},${num(y)} ${num(x + w)},${num(y)} ${num(x + w)},${num(y + 6)} L${num(x + w)},${num(y + h)} C${num(x + w)},${num(y + h - 6)} ${num(x)},${num(y + h - 6)} ${num(x)},${num(y + h)} Z`, ...base },
      };
    default:
      return { tag: "rect", attrs: { x: num(x), y: num(y), width: num(w), height: num(h), ...base } };
  }
}

function dTexto(lineas: string[], cx: number, cy: number): Nodo {
  const alto = lineas.length * 16;
  const y0 = cy - alto / 2 + 12;
  return {
    tag: "text",
    attrs: { x: num(cx), y: num(y0), fill: TEXTO, "font-size": 12, "text-anchor": "middle" },
    hijos: lineas.map((l, i) => ({ tag: "tspan", attrs: { x: num(cx), dy: i === 0 ? 0 : 16 }, texto: l })),
  };
}

function dArista(a: AristaDibujo): Nodo[] {
  if (a.puntos.length < 2) return [];
  const d = a.puntos.map((p, i) => `${i === 0 ? "M" : "L"}${num(p.x)},${num(p.y)}`).join(" ");
  const attrs: Record<string, string | number> = { d, fill: "none", stroke: TRAZO, "stroke-width": 1 };
  if (a.punteada) attrs["stroke-dasharray"] = "4 3";
  if (a.punta) attrs["marker-end"] = "url(#cmp-flecha)";
  const salida: Nodo[] = [{ tag: "path", attrs }];
  if (a.etiqueta && a.etiquetaPos) salida.push(dTexto([a.etiqueta], a.etiquetaPos.x, a.etiquetaPos.y));
  return salida;
}

/** Serializa el modelo a una cadena SVG monocroma segura (§16.4). */
export function diagramaASvg(m: ModeloDiagrama): string {
  const hijos: Nodo[] = [];
  // marcador de flecha
  hijos.push({
    tag: "defs",
    hijos: [
      {
        tag: "marker",
        attrs: { id: "cmp-flecha", markerWidth: 8, markerHeight: 8, refX: 7, refY: 3, orient: "auto", markerUnits: "strokeWidth" },
        hijos: [{ tag: "polygon", attrs: { points: "0,0 8,3 0,6", fill: TRAZO } }],
      },
    ],
  });
  for (const sg of m.subgrafos) {
    hijos.push({ tag: "rect", attrs: { x: num(sg.x), y: num(sg.y), width: num(sg.ancho), height: num(sg.alto), fill: "none", stroke: TRAZO, "stroke-width": 1, "stroke-dasharray": "2 2" } });
    if (sg.titulo) hijos.push(dTexto([sg.titulo], sg.x + sg.ancho / 2, sg.y + 10));
  }
  for (const lv of m.lineasVida) {
    hijos.push({ tag: "line", attrs: { x1: num(lv.x), y1: num(lv.y1), x2: num(lv.x), y2: num(lv.y2), stroke: TRAZO, "stroke-width": 1, "stroke-dasharray": "3 3" } });
    hijos.push(dTexto([lv.etiqueta], lv.ex, lv.y1 - 16));
  }
  for (const a of m.aristas) hijos.push(...dArista(a));
  for (const c of m.nodos) {
    hijos.push(dCaja(c));
    hijos.push(dTexto(c.texto, c.x + c.ancho / 2, c.y + c.alto / 2));
  }
  for (const n of m.notas) {
    hijos.push({ tag: "rect", attrs: { x: num(n.x), y: num(n.y), width: num(n.ancho), height: num(n.alto), fill: FONDO, stroke: TRAZO, "stroke-width": 1 } });
    hijos.push(dTexto(n.texto, n.x + n.ancho / 2, n.y + n.alto / 2));
  }
  const ancho = Math.max(m.ancho, 1);
  const alto = Math.max(m.alto, 1);
  const raiz: Nodo = {
    tag: "svg",
    attrs: { xmlns: "http://www.w3.org/2000/svg", viewBox: `0 0 ${num(ancho)} ${num(alto)}`, width: num(ancho), height: num(alto), "font-family": FUENTE },
    hijos: [{ tag: "rect", attrs: { x: 0, y: 0, width: num(ancho), height: num(alto), fill: FONDO } }, ...hijos],
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n${render(raiz)}`;
}
