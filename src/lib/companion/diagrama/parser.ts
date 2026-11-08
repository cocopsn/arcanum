// Parser de un subconjunto de Mermaid (design §16.1, §16.2). Puro, sin DOM. Acepta `flowchart`/`graph` y
// `sequenceDiagram`; cualquier otra sentencia (click, style, classDef, linkStyle, %%{init}%%, &, loop, alt, HTML, …)
// da { ok: false } nombrando la línea. Nunca ejecuta ni interpola el texto del modelo: sólo lo describe como datos.
// Las etiquetas se guardan como texto plano (sin caracteres de control, recortadas a 80 con «…»).

/** Límites del subconjunto (§16.2). */
export const LIMITES_DIAGRAMA = {
  fuente: 4_000,
  nodos: 60,
  aristas: 120,
  subgrafos: 10,
  participantes: 12,
  mensajes: 80,
  etiqueta: 80,
} as const;

export type Direccion = "TD" | "TB" | "LR" | "RL" | "BT";
export type FormaNodo = "rect" | "redondo" | "rombo" | "circulo" | "cilindro";

export interface NodoFlujo {
  id: string;
  texto: string;
  forma: FormaNodo;
}
export interface AristaFlujo {
  de: string;
  a: string;
  etiqueta: string;
  /** `-->` y `-.->` y `==>` llevan punta; `---` no. */
  punta: boolean;
  /** `-.->` punteada. */
  punteada: boolean;
}
export interface SubgrafoFlujo {
  id: string;
  titulo: string;
  nodos: string[];
}
export interface Flujo {
  tipo: "flowchart";
  direccion: Direccion;
  nodos: NodoFlujo[];
  aristas: AristaFlujo[];
  subgrafos: SubgrafoFlujo[];
}

export type FormaMensaje = "solida-punta" | "punteada-punta" | "solida" | "punteada";
export interface ParticipanteSec {
  id: string;
  etiqueta: string;
}
export interface MensajeSec {
  de: string;
  a: string;
  texto: string;
  forma: FormaMensaje;
}
export type PosicionNota = "over" | "left" | "right";
export interface NotaSec {
  posicion: PosicionNota;
  participantes: string[];
  texto: string;
}
export interface Secuencia {
  tipo: "sequenceDiagram";
  participantes: ParticipanteSec[];
  mensajes: MensajeSec[];
  notas: NotaSec[];
}

export type Ast = Flujo | Secuencia;
export type ResultadoParser = { ok: true; ast: Ast } | { ok: false; linea: number; motivo: string };

const ID_RE = /^[A-Za-z0-9_]{1,40}$/;

/** Limpia una etiqueta: quita caracteres de control, colapsa espacios, recorta a 80 con «…». */
function limpiarEtiqueta(s: string): string {
  // eslint-disable-next-line no-control-regex
  const limpio = s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return limpio.length > LIMITES_DIAGRAMA.etiqueta ? limpio.slice(0, LIMITES_DIAGRAMA.etiqueta - 1) + "…" : limpio;
}

/** Quita comillas dobles envolventes, si las hay. */
function desencomillar(s: string): string {
  const t = s.trim();
  return t.length >= 2 && t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
}

/** Divide la fuente en líneas lógicas: salto de línea o `;`, quitando comentarios `%%` y líneas vacías.
 *  Devuelve pares [texto, lineaOriginal] para que un motivo pueda nombrar la línea real. */
function lineasLogicas(fuente: string): { texto: string; linea: number }[] {
  const out: { texto: string; linea: number }[] = [];
  const fisicas = fuente.split(/\r?\n/);
  for (let i = 0; i < fisicas.length; i++) {
    // Una directiva %%{...}%% NO es un comentario (Mermaid la interpreta): se deja entrar para que el parser la
    // rechace como fuera del subconjunto. Un %% normal sí comenta el resto de la línea.
    const cruda = fisicas[i]!;
    const comentada = /%%\{/.test(cruda) ? cruda : cruda.replace(/%%.*$/, "");
    for (const trozo of comentada.split(";")) {
      const t = trozo.trim();
      if (t) out.push({ texto: t, linea: i + 1 });
    }
  }
  return out;
}

const no = (linea: number, motivo: string): ResultadoParser => ({ ok: false, linea, motivo });

// Nodo con una de las cinco formas y su texto. Devuelve null si la sintaxis del nodo no encaja.
const FORMAS: { re: RegExp; forma: FormaNodo }[] = [
  { re: /^([A-Za-z0-9_]+)\(\((.*)\)\)$/, forma: "circulo" },
  { re: /^([A-Za-z0-9_]+)\[\((.*)\)\]$/, forma: "cilindro" },
  { re: /^([A-Za-z0-9_]+)\{(.*)\}$/, forma: "rombo" },
  { re: /^([A-Za-z0-9_]+)\((.*)\)$/, forma: "redondo" },
  { re: /^([A-Za-z0-9_]+)\[(.*)\]$/, forma: "rect" },
];

/** Reconoce un término de nodo (`id`, `id[texto]`, …). Devuelve el id y, si trae forma, la forma y el texto. */
function leerNodo(term: string): { id: string; forma?: FormaNodo; texto?: string } | null {
  const t = term.trim();
  for (const { re, forma } of FORMAS) {
    const m = t.match(re);
    if (m) return { id: m[1]!, forma, texto: limpiarEtiqueta(desencomillar(m[2]!)) };
  }
  return ID_RE.test(t) ? { id: t } : null;
}

// Un conector de arista con su etiqueta opcional: `-->`, `---`, `-.->`, `==>`, con `|txt|` o `-- txt -->`.
const CONECTOR_RE = /^(-->|---|-\.->|==>|--\s+[^>]*?\s+-->|-\.\s+[^>]*?\s+\.->|==\s+[^>]*?\s+==>)(?:\|([^|]*)\|)?$/;

function clasificarConector(raw: string): { punta: boolean; punteada: boolean; etiqueta: string } | null {
  const m = raw.match(CONECTOR_RE);
  if (!m) return null;
  const cuerpo = m[1]!;
  let etiqueta = m[2] ?? "";
  let punteada = false;
  let punta = true;
  if (cuerpo === "---") punta = false;
  if (cuerpo.includes("-.")) punteada = true;
  // forma `-- txt -->`
  const inline = cuerpo.match(/^(--|-\.|==)\s+(.*?)\s+(-->|\.->|==>)$/);
  if (inline) etiqueta = inline[2]!;
  return { punta, punteada, etiqueta: limpiarEtiqueta(etiqueta) };
}

function parsearFlujo(lineas: { texto: string; linea: number }[], direccion: Direccion): ResultadoParser {
  const nodos = new Map<string, NodoFlujo>();
  const aristas: AristaFlujo[] = [];
  const subgrafos: SubgrafoFlujo[] = [];
  let sgActual: SubgrafoFlujo | null = null;

  const asegurarNodo = (n: { id: string; forma?: FormaNodo; texto?: string }) => {
    const prev = nodos.get(n.id);
    if (!prev) nodos.set(n.id, { id: n.id, texto: n.texto ?? n.id, forma: n.forma ?? "rect" });
    else if (n.forma) {
      prev.forma = n.forma;
      prev.texto = n.texto ?? prev.texto;
    }
    if (sgActual && !sgActual.nodos.includes(n.id)) sgActual.nodos.push(n.id);
  };

  for (const { texto, linea } of lineas) {
    if (/^subgraph\b/i.test(texto)) {
      if (subgrafos.length >= LIMITES_DIAGRAMA.subgrafos) return no(linea, "Diagrama demasiado grande (subgrafos)");
      const m = texto.match(/^subgraph\s+([A-Za-z0-9_]+)(?:\s*\[(.*)\])?$/i);
      if (!m) return no(linea, "Sintaxis fuera del subconjunto");
      sgActual = { id: m[1]!, titulo: limpiarEtiqueta(desencomillar(m[2] ?? m[1]!)), nodos: [] };
      subgrafos.push(sgActual);
      continue;
    }
    if (/^end$/i.test(texto)) {
      if (!sgActual) return no(linea, "Sintaxis fuera del subconjunto");
      sgActual = null;
      continue;
    }

    // ¿cadena de aristas? Partimos por los conectores conservándolos.
    const partes = texto.split(/(-->|---|-\.->|==>|--\s+[^>]*?\s+-->|-\.\s+[^>]*?\s+\.->|==\s+[^>]*?\s+==>|\|[^|]*\|)/).map((s) => s.trim()).filter(Boolean);
    if (partes.length === 1) {
      const n = leerNodo(partes[0]!);
      if (!n) return no(linea, "Sintaxis fuera del subconjunto");
      asegurarNodo(n);
      continue;
    }
    // intercalado nodo (conector [|etq|]) nodo …
    let i = 0;
    const primero = leerNodo(partes[0]!);
    if (!primero) return no(linea, "Sintaxis fuera del subconjunto");
    asegurarNodo(primero);
    let prevId = primero.id;
    i = 1;
    while (i < partes.length) {
      let conectorRaw = partes[i]!;
      i++;
      // etiqueta en segmento propio `|txt|`
      if (i < partes.length && /^\|[^|]*\|$/.test(partes[i]!)) {
        conectorRaw += partes[i]!;
        i++;
      }
      const con = clasificarConector(conectorRaw);
      if (con === null) return no(linea, "Sintaxis fuera del subconjunto");
      const destino = partes[i] !== undefined ? leerNodo(partes[i]!) : null;
      if (!destino) return no(linea, "Sintaxis fuera del subconjunto");
      i++;
      asegurarNodo(destino);
      if (aristas.length >= LIMITES_DIAGRAMA.aristas) return no(linea, "Diagrama demasiado grande (aristas)");
      aristas.push({ de: prevId, a: destino.id, etiqueta: con.etiqueta, punta: con.punta, punteada: con.punteada });
      if (nodos.size > LIMITES_DIAGRAMA.nodos) return no(linea, "Diagrama demasiado grande (nodos)");
      prevId = destino.id;
    }
  }
  if (sgActual) return no(lineas[lineas.length - 1]?.linea ?? 1, "Sintaxis fuera del subconjunto");
  if (nodos.size > LIMITES_DIAGRAMA.nodos) return no(1, "Diagrama demasiado grande (nodos)");
  return { ok: true, ast: { tipo: "flowchart", direccion, nodos: [...nodos.values()], aristas, subgrafos } };
}

const MENSAJE_RE = /^(.+?)\s*(->>|-->>|->|-->)\s*(.+?)\s*:\s*(.*)$/;

function parsearSecuencia(lineas: { texto: string; linea: number }[]): ResultadoParser {
  const participantes = new Map<string, ParticipanteSec>();
  const mensajes: MensajeSec[] = [];
  const notas: NotaSec[] = [];
  const asegurarP = (id: string) => {
    if (!participantes.has(id)) participantes.set(id, { id, etiqueta: id });
  };
  const formaDe = (op: string): FormaMensaje =>
    op === "->>" ? "solida-punta" : op === "-->>" ? "punteada-punta" : op === "->" ? "solida" : "punteada";

  for (const { texto, linea } of lineas) {
    if (/^(participant|actor)\b/i.test(texto)) {
      const m = texto.match(/^(?:participant|actor)\s+([A-Za-z0-9_]+)(?:\s+as\s+(.+))?$/i);
      if (!m) return no(linea, "Sintaxis fuera del subconjunto");
      if (participantes.size >= LIMITES_DIAGRAMA.participantes) return no(linea, "Diagrama demasiado grande (participantes)");
      participantes.set(m[1]!, { id: m[1]!, etiqueta: limpiarEtiqueta(m[2] ? desencomillar(m[2]) : m[1]!) });
      continue;
    }
    if (/^note\b/i.test(texto)) {
      const m = texto.match(/^note\s+(over|left of|right of)\s+([A-Za-z0-9_]+(?:\s*,\s*[A-Za-z0-9_]+)?)\s*:\s*(.*)$/i);
      if (!m) return no(linea, "Sintaxis fuera del subconjunto");
      const pos = m[1]!.toLowerCase().startsWith("left") ? "left" : m[1]!.toLowerCase().startsWith("right") ? "right" : "over";
      const ps = m[2]!.split(",").map((s) => s.trim());
      for (const p of ps) asegurarP(p);
      notas.push({ posicion: pos, participantes: ps, texto: limpiarEtiqueta(m[3]!) });
      continue;
    }
    const mm = texto.match(MENSAJE_RE);
    if (!mm) return no(linea, "Sintaxis fuera del subconjunto");
    const de = mm[1]!.trim();
    const a = mm[3]!.trim();
    if (!ID_RE.test(de) || !ID_RE.test(a)) return no(linea, "Sintaxis fuera del subconjunto");
    asegurarP(de);
    asegurarP(a);
    if (participantes.size > LIMITES_DIAGRAMA.participantes) return no(linea, "Diagrama demasiado grande (participantes)");
    if (mensajes.length >= LIMITES_DIAGRAMA.mensajes) return no(linea, "Diagrama demasiado grande (mensajes)");
    mensajes.push({ de, a, texto: limpiarEtiqueta(mm[4]!), forma: formaDe(mm[2]!) });
  }
  return { ok: true, ast: { tipo: "sequenceDiagram", participantes: [...participantes.values()], mensajes, notas } };
}

/**
 * Parsea una fuente del subconjunto de Mermaid (§16.2). Nunca ejecuta ni interpola el texto del modelo; cualquier
 * sentencia fuera del subconjunto rechaza TODO el diagrama nombrando la línea, así que el dibujo nunca recibe algo que
 * no entendió (CA-26).
 */
export function parsearDiagrama(fuente: string): ResultadoParser {
  if (fuente.length > LIMITES_DIAGRAMA.fuente) return no(1, "Diagrama demasiado grande (longitud)");
  const todas = fuente.split(/\r?\n/);
  let encabezadoIdx = -1;
  let cabecera = "";
  for (let i = 0; i < todas.length; i++) {
    const t = todas[i]!.replace(/%%.*$/, "").trim();
    if (t) {
      cabecera = t;
      encabezadoIdx = i;
      break;
    }
  }
  if (encabezadoIdx < 0) return no(1, "Sintaxis fuera del subconjunto");

  const resto = lineasLogicas(todas.slice(encabezadoIdx + 1).join("\n"));

  const flow = cabecera.match(/^(?:flowchart|graph)\s+(TD|TB|LR|RL|BT)\b/i);
  if (flow) return parsearFlujo(resto, flow[1]!.toUpperCase() as Direccion);
  if (/^sequenceDiagram\b/i.test(cabecera)) return parsearSecuencia(resto);
  return no(encabezadoIdx + 1, "Sintaxis fuera del subconjunto");
}
