// Límite de consultas del cliente (design §14.3, RF-S5, DC-15). 10 llamadas por ventana móvil de 60 s, debajo de las
// 12 de la Edge. Marcas en localStorage["arcanum_companion_rl"] (arreglo de ms), compartidas por las pestañas; la
// operación «leer, podar, comprobar, agregar» corre dentro de navigator.locks cuando existe, así dos pestañas no pasan
// juntas. Reloj, almacenamiento y candado son inyectables para las pruebas. Puro salvo esos efectos inyectados.

/** Ventana móvil (ms) y máximo del cliente (§14.3). El máximo es menor que RATE.max de la Edge (12). */
export const VENTANA_MS = 60_000;
export const MAX = 10;
/** Llave de localStorage (§14.3). */
export const LLAVE_RL = "arcanum_companion_rl";
/** Nombre del candado Web Locks (§14.3). */
export const NOMBRE_CANDADO = "arcanum-companion-rl";

/** Lo que devuelve reservar() (§14.3). */
export type Reserva = { ok: true } | { ok: false; esperaS: number };

/** Almacenamiento mínimo inyectable (un subconjunto de Storage). */
export interface AlmacenRL {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

/** Candado inyectable: corre el trabajo en exclusión mutua si hay Web Locks. */
export type Candado = <T>(nombre: string, trabajo: () => Promise<T>) => Promise<T>;

export interface DepsLimite {
  /** reloj en ms; por omisión Date.now */
  ahora?: () => number;
  /** almacenamiento; por omisión localStorage o memoria si no hay */
  almacen?: AlmacenRL | null;
  /** candado; por omisión navigator.locks o uno sin exclusión */
  candado?: Candado;
  /** ventana y máximo, inyectables sólo para el red-check (g) */
  ventanaMs?: number;
  max?: number;
}

/** Almacén en memoria por pestaña cuando no hay localStorage (§14.3). */
function almacenMemoria(): AlmacenRL {
  let v: string | null = null;
  return { getItem: () => v, setItem: (_k, x) => (v = x) };
}

/** Candado por omisión: navigator.locks si existe; si no, corre sin exclusión (y la clase lo declara). */
function candadoPorOmision(): { candado: Candado; atomico: boolean } {
  const locks = (globalThis as { navigator?: { locks?: { request?: Candado } } }).navigator?.locks;
  if (locks && typeof locks.request === "function") {
    return { candado: (nombre, trabajo) => (locks.request as (n: string, t: () => Promise<unknown>) => Promise<unknown>)(nombre, trabajo) as Promise<never>, atomico: true };
  }
  return { candado: (_n, trabajo) => trabajo(), atomico: false };
}

/** Marcas válidas: arreglo de números dentro de [ahora − ventana, ahora + 1 s] (§14.3). */
function marcasValidas(raw: string | null, ahora: number, ventanaMs: number): number[] {
  let datos: unknown;
  try {
    datos = raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
  if (!Array.isArray(datos)) return [];
  return datos.filter((t): t is number => typeof t === "number" && Number.isFinite(t) && t >= ahora - ventanaMs && t <= ahora + 1_000);
}

/** Límite de consultas del compañero. Dos instancias con el mismo almacén simulan dos pestañas (red-check (g)). */
export class Limite {
  private readonly ahora: () => number;
  private readonly almacen: AlmacenRL;
  private readonly candado: Candado;
  private readonly ventanaMs: number;
  private readonly max: number;
  /** false si no hay Web Locks (la operación no es atómica entre pestañas, §14.3). */
  readonly atomico: boolean;

  constructor(deps: DepsLimite = {}) {
    this.ahora = deps.ahora ?? Date.now;
    this.ventanaMs = deps.ventanaMs ?? VENTANA_MS;
    this.max = deps.max ?? MAX;
    const ls = deps.almacen === undefined ? (typeof localStorage !== "undefined" ? localStorage : null) : deps.almacen;
    this.almacen = ls ?? almacenMemoria();
    if (deps.candado) {
      this.candado = deps.candado;
      this.atomico = true;
    } else {
      const d = candadoPorOmision();
      this.candado = d.candado;
      this.atomico = d.atomico;
    }
  }

  /** Reserva un cupo. Devuelve { ok: true } o { ok: false, esperaS } con los segundos hasta que se libere uno. */
  reservar(): Promise<Reserva> {
    return this.candado(NOMBRE_CANDADO, async () => {
      const t = this.ahora();
      const marcas = marcasValidas(this.almacen.getItem(LLAVE_RL), t, this.ventanaMs);
      if (marcas.length >= this.max) {
        const masVieja = Math.min(...marcas);
        const esperaS = Math.max(1, Math.ceil((masVieja + this.ventanaMs - t) / 1_000));
        return { ok: false, esperaS };
      }
      marcas.push(t);
      this.almacen.setItem(LLAVE_RL, JSON.stringify(marcas));
      return { ok: true };
    });
  }

  /** Marca el límite como lleno por `ventanaMs` (cuando la Edge responde 429, §14.2). */
  marcarLleno(): void {
    const t = this.ahora();
    const marcas = new Array(this.max).fill(t);
    this.almacen.setItem(LLAVE_RL, JSON.stringify(marcas));
  }
}
