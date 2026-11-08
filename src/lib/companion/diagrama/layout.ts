// Disposición de un diagrama ya parseado (design §16.3). Puro, sin DOM: `flowchart` con @dagrejs/dagre (ya carga con
// la página, cero bytes nuevos) y `sequenceDiagram` en columnas de 140 px y filas de 36 px. El resultado es un modelo
// de cajas, polilíneas y texto que Diagrama.tsx y svg-texto.ts dibujan sin volver a mirar la fuente del modelo.
import dagre from "@dagrejs/dagre";
import type { Ast, Flujo, Secuencia, FormaNodo, FormaMensaje } from "./parser";

export interface CajaDibujo {
  id: string;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  texto: string[];
  forma: FormaNodo;
}
export interface SubgrafoDibujo {
  id: string;
  titulo: string;
  x: number;
  y: number;
  ancho: number;
  alto: number;
}
export interface Punto {
  x: number;
  y: number;
}
export interface AristaDibujo {
  puntos: Punto[];
  etiqueta: string;
  etiquetaPos?: Punto;
  punta: boolean;
  punteada: boolean;
}
export interface NotaDibujo {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  texto: string[];
}
export interface ModeloDiagrama {
  ancho: number;
  alto: number;
  nodos: CajaDibujo[];
  subgrafos: SubgrafoDibujo[];
  aristas: AristaDibujo[];
  /** Líneas de vida de secuencia: una línea vertical por participante. */
  lineasVida: { x: number; y1: number; y2: number; etiqueta: string; ex: number }[];
  notas: NotaDibujo[];
}

const CHAR_PX = 7.2; // ancho estimado por carácter a 12 px
const LINEA_ALTO = 16;
const MAX_LINEA = 24; // caracteres por línea
const MAX_LINEAS = 3;

/** Parte un texto en hasta 3 líneas de 24 caracteres (§16.3). */
function envolver(texto: string): string[] {
  if (!texto) return [""];
  const palabras = texto.split(/\s+/);
  const lineas: string[] = [];
  let actual = "";
  for (const p of palabras) {
    const tentativa = actual ? actual + " " + p : p;
    if (tentativa.length > MAX_LINEA && actual) {
      lineas.push(actual);
      actual = p;
    } else {
      actual = tentativa;
    }
    if (lineas.length >= MAX_LINEAS) break;
  }
  if (actual && lineas.length < MAX_LINEAS) lineas.push(actual);
  if (lineas.length > MAX_LINEAS) lineas.length = MAX_LINEAS;
  return lineas.map((l) => (l.length > MAX_LINEA ? l.slice(0, MAX_LINEA - 1) + "…" : l));
}

function medida(texto: string): { ancho: number; alto: number; lineas: string[] } {
  const lineas = envolver(texto);
  const anchoTexto = Math.max(...lineas.map((l) => l.length * CHAR_PX), 20);
  return { ancho: Math.ceil(anchoTexto) + 24, alto: lineas.length * LINEA_ALTO + 16, lineas };
}

function disponerFlujo(f: Flujo): ModeloDiagrama {
  const g = new dagre.graphlib.Graph({ multigraph: true, compound: true });
  g.setGraph({ rankdir: f.direccion === "TD" ? "TB" : f.direccion, nodesep: 24, ranksep: 48, marginx: 12, marginy: 12 });
  g.setDefaultEdgeLabel(() => ({}));

  const medidas = new Map<string, { ancho: number; alto: number; lineas: string[] }>();
  for (const n of f.nodos) {
    const m = medida(n.texto);
    medidas.set(n.id, m);
    g.setNode(n.id, { width: m.ancho, height: m.alto });
  }
  for (const sg of f.subgrafos) {
    g.setNode(sg.id, { label: sg.titulo, clusterLabelPos: "top" });
    for (const hijo of sg.nodos) if (g.hasNode(hijo)) g.setParent(hijo, sg.id);
  }
  f.aristas.forEach((a, i) => {
    const ew = a.etiqueta ? a.etiqueta.length * CHAR_PX + 8 : 0;
    g.setEdge(a.de, a.a, { label: a.etiqueta, width: ew, height: a.etiqueta ? LINEA_ALTO : 0, labelpos: "c" }, `e${i}`);
  });

  dagre.layout(g);

  const nodos: CajaDibujo[] = f.nodos.map((n) => {
    const d = g.node(n.id) as { x: number; y: number; width: number; height: number };
    const m = medidas.get(n.id)!;
    return { id: n.id, x: d.x - d.width / 2, y: d.y - d.height / 2, ancho: d.width, alto: d.height, texto: m.lineas, forma: n.forma };
  });

  const subgrafos: SubgrafoDibujo[] = f.subgrafos
    .filter((sg) => g.hasNode(sg.id))
    .map((sg) => {
      const d = g.node(sg.id) as { x: number; y: number; width: number; height: number };
      return { id: sg.id, titulo: sg.titulo, x: d.x - d.width / 2, y: d.y - d.height / 2, ancho: d.width, alto: d.height };
    });

  const aristas: AristaDibujo[] = f.aristas.map((a, i) => {
    const d = g.edge({ v: a.de, w: a.a, name: `e${i}` }) as { points?: Punto[]; x?: number; y?: number };
    const puntos = d.points ?? [];
    return {
      puntos,
      etiqueta: a.etiqueta,
      etiquetaPos: a.etiqueta && d.x !== undefined && d.y !== undefined ? { x: d.x, y: d.y } : undefined,
      punta: a.punta,
      punteada: a.punteada,
    };
  });

  const gl = g.graph() as { width?: number; height?: number };
  return { ancho: Math.ceil(gl.width ?? 0), alto: Math.ceil(gl.height ?? 0), nodos, subgrafos, aristas, lineasVida: [], notas: [] };
}

const COL_ANCHO = 140;
const FILA_ALTO = 36;
const MARGEN = 12;
const CABECERA_ALTO = 40;

function disponerSecuencia(s: Secuencia): ModeloDiagrama {
  const ps = s.participantes;
  const colX = new Map<string, number>();
  ps.forEach((p, i) => colX.set(p.id, MARGEN + COL_ANCHO / 2 + i * COL_ANCHO));

  const topMsg = MARGEN + CABECERA_ALTO + 8;
  const totalFilas = s.mensajes.length + s.notas.length;
  const altoCuerpo = Math.max(totalFilas, 1) * FILA_ALTO;
  const abajo = topMsg + altoCuerpo + 8;

  const lineasVida = ps.map((p) => ({
    x: colX.get(p.id)!,
    y1: MARGEN + CABECERA_ALTO,
    y2: abajo,
    etiqueta: p.etiqueta,
    ex: colX.get(p.id)!,
  }));

  const aristas: AristaDibujo[] = [];
  const notas: NotaDibujo[] = [];
  let fila = 0;
  const forma = (f: FormaMensaje) => ({
    punta: f === "solida-punta" || f === "punteada-punta",
    punteada: f === "punteada-punta" || f === "punteada",
  });
  // Recorremos mensajes y notas en el orden en que se parsearon no está disponible aquí; dibujamos mensajes y luego
  // notas, cada uno en su fila (§16.3 pide columnas y filas, no el orden exacto de Mermaid).
  for (const m of s.mensajes) {
    const y = topMsg + fila * FILA_ALTO;
    const x1 = colX.get(m.de)!;
    const x2 = colX.get(m.a)!;
    const f = forma(m.forma);
    aristas.push({
      puntos: [
        { x: x1, y },
        { x: x2, y },
      ],
      etiqueta: m.texto,
      etiquetaPos: { x: (x1 + x2) / 2, y: y - 6 },
      punta: f.punta,
      punteada: f.punteada,
    });
    fila++;
  }
  for (const n of s.notas) {
    const y = topMsg + fila * FILA_ALTO;
    const xs = n.participantes.map((p) => colX.get(p) ?? MARGEN + COL_ANCHO / 2);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const lineas = envolver(n.texto);
    const ancho = Math.max(maxX - minX + COL_ANCHO * 0.8, 80);
    const x = n.posicion === "left" ? minX - ancho - 10 : n.posicion === "right" ? maxX + 10 : (minX + maxX) / 2 - ancho / 2;
    notas.push({ x, y: y - LINEA_ALTO, ancho, alto: lineas.length * LINEA_ALTO + 12, texto: lineas });
    fila++;
  }

  const ancho = MARGEN * 2 + Math.max(ps.length, 1) * COL_ANCHO;
  return { ancho, alto: abajo + MARGEN, nodos: [], subgrafos: [], aristas, lineasVida, notas };
}

/** Dispone un AST en un modelo de dibujo puro (§16.3). Lanza si dagre falla (Diagrama.tsx lo atrapa, §16.3). */
export function disponerDiagrama(ast: Ast): ModeloDiagrama {
  return ast.tipo === "flowchart" ? disponerFlujo(ast) : disponerSecuencia(ast);
}
