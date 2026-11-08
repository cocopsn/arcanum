// Índice del compañero: carga perezosa y validación (design §9.1, §9.3, §9.6). Importa el manifiesto generado
// (particiones.ts, ≈ 4 KB dentro de companion-ui) y carga cada partición con su import() perezoso cuando el alcance la
// pide. Valida al cargar (f, N = número de documentos, v y q del mismo largo); una que no carga o no valida queda en
// `faltantes`. El vocabulario se vuelve Map sólo la primera vez que se consulta esa partición, y los postings se
// decodifican por término. La precarga del mundo activo y de los chunks de diagrama/pdf/práctica la dispara el panel
// en un requestIdleCallback (§9.1). Este módulo no importa forge.ts ni el DOM.
import { MANIFIESTO, CARGAR } from "./generated/particiones";

/** Formato que escribe build-index.mjs (§8.4). */
export const FORMATO_INDICE = "arcanum-companion-index/1";

/** Una fuente de la tabla `s`: [archivo, handle/module_id/código, título, sha10]. */
type Fuente = [string, string, string, string];
/** Un documento del índice crudo: [índice de fuente, ancla, etiqueta, dl]. */
type DocCrudo = [number, string, string, number];

/** La forma cruda de una partición idx-*.json (§8.4). */
export interface ParticionJson {
  f: string;
  p: string;
  spine: string;
  ruta: string | null;
  N: number;
  avgdl: number;
  s: Fuente[];
  d: DocCrudo[];
  v: string;
  q: string;
}

/** Un documento ya resuelto con su fuente. */
export interface DocCargado {
  ancla: string;
  etiqueta: string;
  dl: number;
  archivo: string;
  handle: string;
  titulo: string;
  sha10: string;
}

/** Una posting: [índice de documento, frecuencia del término]. */
export type Posting = [number, number];

/** Una partición válida, lista para BM25. El vocabulario y los postings se decodifican de forma perezosa. */
export interface ParticionCargada {
  nombre: string;
  tipo: "libros" | "bancos" | "fichas";
  spine: string;
  ruta: string | null;
  N: number;
  avgdl: number;
  docs: DocCargado[];
  /** postings de un término, o null si no está en el vocabulario de esta partición */
  postings(termino: string): Posting[] | null;
}

/** El tipo de una partición según su nombre (libros-*, bancos-*, forge-fichas). */
function tipoDe(nombre: string): ParticionCargada["tipo"] {
  if (nombre === "forge-fichas") return "fichas";
  if (nombre.includes("bancos")) return "bancos";
  return "libros";
}

/**
 * Valida y arma una partición desde su JSON crudo (§9.1): etiqueta `f`, `N` igual al número de documentos, y `v`/`q`
 * del mismo largo. Devuelve null si algo no cuadra (va a `faltantes`).
 */
export function cargarParticionJson(json: unknown, nombreEsperado?: string): ParticionCargada | null {
  const p = json as Partial<ParticionJson> | null;
  if (!p || typeof p !== "object") return null;
  if (p.f !== FORMATO_INDICE) return null;
  if (typeof p.p !== "string" || (nombreEsperado !== undefined && p.p !== nombreEsperado)) return null;
  if (!Array.isArray(p.s) || !Array.isArray(p.d)) return null;
  if (typeof p.N !== "number" || p.N !== p.d.length) return null;
  if (typeof p.v !== "string" || typeof p.q !== "string") return null;
  const vocab = p.v ? p.v.split(" ") : [];
  const listas = p.q ? p.q.split(";") : [];
  if (vocab.length !== listas.length) return null;

  const fuentes = p.s;
  const docs: DocCargado[] = p.d.map(([fi, ancla, etiqueta, dl]) => {
    const f = fuentes[fi] ?? ["", "", "", ""];
    return { ancla, etiqueta, dl, archivo: f[0] ?? "", handle: f[1] ?? "", titulo: f[2] ?? "", sha10: f[3] ?? "" };
  });

  // Índice de vocabulario; los postings de cada término se decodifican a pedido y se memorizan.
  const indice = new Map<string, number>();
  vocab.forEach((t, k) => indice.set(t, k));
  const cache = new Map<string, Posting[]>();
  const postings = (termino: string): Posting[] | null => {
    const k = indice.get(termino);
    if (k === undefined) return null;
    const ya = cache.get(termino);
    if (ya) return ya;
    const lista = decodificarPostings(listas[k] ?? "");
    cache.set(termino, lista);
    return lista;
  };

  return {
    nombre: p.p,
    tipo: tipoDe(p.p),
    spine: typeof p.spine === "string" ? p.spine : "",
    ruta: typeof p.ruta === "string" ? p.ruta : null,
    N: p.N,
    avgdl: typeof p.avgdl === "number" ? p.avgdl : 0,
    docs,
    postings,
  };
}

/** Decodifica una lista de postings `delta[:tf],…` (§8.4): delta base36 acumulado y tf base36 (1 si falta). */
export function decodificarPostings(lista: string): Posting[] {
  if (!lista) return [];
  const out: Posting[] = [];
  let doc = 0;
  for (const e of lista.split(",")) {
    const [dStr, tfStr] = e.split(":");
    doc += parseInt(dStr ?? "", 36);
    const tf = tfStr ? parseInt(tfStr, 36) : 1;
    out.push([doc, tf]);
  }
  return out;
}

/** Una partición cargada o la razón por la que faltó. */
export interface Faltante {
  nombre: string;
  motivo: "no-carga" | "invalida";
}

/**
 * Gestor del índice en el cliente (§9.1). Carga perezosa por nombre con `CARGAR`, memoria de lo ya cargado, y lista de
 * `faltantes`. `cargar` acepta un cargador inyectable para las pruebas (por omisión, el `CARGAR` generado).
 */
export class Indice {
  private cargadas = new Map<string, ParticionCargada>();
  private readonly faltantes_ = new Map<string, Faltante["motivo"]>();
  private readonly cargador: Record<string, () => Promise<unknown>>;

  constructor(cargador: Record<string, () => Promise<unknown>> = CARGAR) {
    this.cargador = cargador;
  }

  /** Los nombres del manifiesto (todas las particiones conocidas). */
  get nombres(): string[] {
    return MANIFIESTO.map((m) => m.nombre);
  }

  /** Las particiones faltantes hasta ahora, con su motivo. */
  get faltantes(): Faltante[] {
    return [...this.faltantes_.entries()].map(([nombre, motivo]) => ({ nombre, motivo }));
  }

  /** Lo ya cargado y válido (para BM25). */
  get listas(): ParticionCargada[] {
    return [...this.cargadas.values()];
  }

  /** Nombres de las particiones de un mundo (spine), por el manifiesto. */
  nombresDeSpine(spine: string): string[] {
    return MANIFIESTO.filter((m) => m.spine === spine).map((m) => m.nombre);
  }

  /**
   * Carga una partición si no está ya. Devuelve la partición válida, o null si no carga o no valida (y la anota en
   * `faltantes`). Idempotente: una partición ya marcada faltante no se reintenta en la misma sesión.
   */
  async cargar(nombre: string): Promise<ParticionCargada | null> {
    const ya = this.cargadas.get(nombre);
    if (ya) return ya;
    const importar = this.cargador[nombre];
    if (!importar) {
      this.faltantes_.set(nombre, "invalida");
      return null;
    }
    let mod: unknown;
    try {
      mod = await importar();
    } catch {
      this.faltantes_.set(nombre, "no-carga");
      return null;
    }
    const json = (mod as { default?: unknown })?.default ?? mod;
    const p = cargarParticionJson(json, nombre);
    if (!p) {
      this.faltantes_.set(nombre, "invalida");
      return null;
    }
    this.faltantes_.delete(nombre);
    this.cargadas.set(nombre, p);
    return p;
  }

  /** Carga varias particiones en paralelo y devuelve las que cargaron. */
  async cargarVarias(nombres: Iterable<string>): Promise<ParticionCargada[]> {
    const res = await Promise.all([...nombres].map((n) => this.cargar(n)));
    return res.filter((p): p is ParticionCargada => p !== null);
  }
}

/** Corre un trabajo cuando el navegador esté en reposo; si no hay requestIdleCallback (happy-dom), con setTimeout. */
function enReposo(trabajo: () => void): void {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (typeof ric === "function") ric(() => trabajo());
  else setTimeout(trabajo, 0);
}

/**
 * Precarga de la primera apertura (§9.1): en reposo, carga las particiones del mundo activo y pide los chunks de
 * diagrama, pdf y práctica (que ya están en el precache). `pedirChunks` lo inyecta el panel con los import() de
 * forge.ts (tarea 29); aquí es opcional para no acoplar este módulo a forge.ts. Cualquier fallo lo absorbe el gestor
 * (queda en `faltantes`) o el panel, sin recargar la página.
 */
export function precargar(indice: Indice, spineActivo: string | null, pedirChunks?: () => void): void {
  enReposo(() => {
    if (spineActivo) void indice.cargarVarias(indice.nombresDeSpine(spineActivo));
    if (pedirChunks) {
      try {
        pedirChunks();
      } catch {
        /* el panel ya pinta el aviso de chunk si un import() falla */
      }
    }
  });
}
