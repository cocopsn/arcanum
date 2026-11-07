// Colocación del orbe y del pestillo (design §5, RF-B7): una función pura sobre rectángulos y una lectura del DOM.
import type { Esquina } from "@/lib/companion/estado-ui";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** Caja de una pieza y su distancia a los bordes (más el área segura). */
export interface Pieza {
  w: number;
  h: number;
  lado: number;
  vertical: number;
}
export interface Marco {
  ancho: number;
  alto: number;
  sa: { t: number; r: number; b: number; l: number };
}
export interface Colocacion {
  esquina: Esquina;
  dy: number;
  colision: boolean;
}

/** El orbe mide 56×56 y va a 12 px del área segura. */
export const ORBE: Pieza = { w: 56, h: 56, lado: 12, vertical: 12 };
/** El pestillo: caja táctil de 44×44 pegada al borde lateral, a la altura del centro del orbe. */
export const PESTILLO: Pieza = { w: 44, h: 44, lado: 0, vertical: 18 };
export const PASO = 8;
export const MAX_DESPLAZAMIENTO = 160;
export const MARGEN = 4;
/** Orden horario en pantalla. */
export const HORARIO: readonly Esquina[] = ["sup-izq", "sup-der", "inf-der", "inf-izq"];

/** Caja de la pieza en una esquina, desplazada `dy` px hacia el centro. */
export function cajaEn(esquina: Esquina, dy: number, p: Pieza, m: Marco): Rect {
  const der = esquina.endsWith("der");
  const inf = esquina.startsWith("inf");
  const x = der ? m.ancho - m.sa.r - p.lado - p.w : m.sa.l + p.lado;
  const y = inf ? m.alto - m.sa.b - p.vertical - dy - p.h : m.sa.t + p.vertical + dy;
  return { x, y, w: p.w, h: p.h };
}

export function seCruzan(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Libre: la caja más el margen de 4 px no se cruza con ningún control. */
export function libre(caja: Rect, controles: readonly Rect[]): boolean {
  const c = { x: caja.x - MARGEN, y: caja.y - MARGEN, w: caja.w + 2 * MARGEN, h: caja.h + 2 * MARGEN };
  return controles.every((r) => !seCruzan(c, r));
}

/** La esquina preferida con 21 desplazamientos (0…160 px de 8 en 8) y después las otras tres en orden horario. */
export function orden(preferida: Esquina): Esquina[] {
  const i = HORARIO.indexOf(preferida);
  return [0, 1, 2, 3].map((k) => HORARIO[(i + k) % 4]!);
}

export function colocar(preferida: Esquina, p: Pieza, m: Marco, controles: readonly Rect[]): Colocacion {
  for (const esquina of orden(preferida)) {
    for (let dy = 0; dy <= MAX_DESPLAZAMIENTO; dy += PASO) {
      if (libre(cajaEn(esquina, dy, p, m), controles)) return { esquina, dy, colision: false };
    }
  }
  return { esquina: preferida, dy: 0, colision: true };
}

export const SELECTOR_CONTROLES =
  'button:not([disabled]), [role="button"]:not([aria-disabled="true"]), a[href], input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled])';

const delCompanero = (n: Element): boolean => n.closest("#arcanum-companion") !== null;
const conCaja = (n: Element): boolean => {
  const r = n.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

const FIRMA =
  '[role="dialog"], [role="group"], [data-forge-flow], [data-forge-runner], [data-forge-stub], [data-forge-cell-panel], [role="status"] button, [role="alert"] button, [data-lecturas-descarga] button';
const ATRIBUTOS_FORGE = ["data-forge-flow", "data-forge-runner", "data-forge-stub", "data-forge-cell-panel"] as const;

/** Firma de superficies (§5) con una sola consulta: si cambia, el reloj de 1 s recalcula la colocación. Sólo lee. */
export function firmaSuperficies(): string {
  const partes: string[] = [`mundo=${document.body.dataset.world ?? ""}`];
  let botones = 0;
  for (const el of document.querySelectorAll(FIRMA)) {
    if (delCompanero(el)) continue;
    if (el.tagName === "BUTTON") {
      if (conCaja(el)) botones++;
      continue;
    }
    const rol = el.getAttribute("role");
    if (rol === "dialog" && conCaja(el)) partes.push(`dialogo=${el.getAttribute("aria-label") ?? ""}|${el.getAttribute("aria-labelledby") ?? ""}`);
    else if (rol === "group") partes.push(`grupo=${el.getAttribute("aria-label") ?? ""}`);
    for (const a of ATRIBUTOS_FORGE) if (el.hasAttribute(a)) partes.push(`${a}=${el.getAttribute(a)}`);
  }
  partes.push(`botones=${botones}`);
  return partes.join(";");
}

/** Controles visibles fuera del compañero. Sin `document.elementsFromPoint` devuelve «sin controles» (§3.4). */
export function leerControles(): Rect[] {
  if (typeof document === "undefined" || typeof document.elementsFromPoint !== "function") return [];
  const ancho = window.innerWidth;
  const alto = window.innerHeight;
  const out: Rect[] = [];
  for (const el of document.querySelectorAll(SELECTOR_CONTROLES)) {
    if (delCompanero(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.right <= 0 || r.bottom <= 0 || r.left >= ancho || r.top >= alto) continue;
    if (getComputedStyle(el).visibility === "hidden") continue;
    const cx = Math.min(Math.max(r.left + r.width / 2, 0), ancho - 1);
    const cy = Math.min(Math.max(r.top + r.height / 2, 0), alto - 1);
    const primero = document.elementsFromPoint(cx, cy).find((n) => !delCompanero(n));
    if (primero && (primero === el || el.contains(primero))) out.push({ x: r.left, y: r.top, w: r.width, h: r.height });
  }
  return out;
}
