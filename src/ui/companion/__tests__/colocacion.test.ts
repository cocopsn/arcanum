import { describe, it, expect, afterEach } from "vitest";
import {
  ORBE,
  PESTILLO,
  MARGEN,
  cajaEn,
  colocar,
  leerControles,
  libre,
  orden,
  seCruzan,
  type Colocacion,
  type Marco,
  type Pieza,
  type Rect,
} from "@/ui/companion/colocacion";
import type { Esquina } from "@/lib/companion/estado-ui";
import { rojoEscena } from "./rojo";

const M: Marco = { ancho: 390, alto: 844, sa: { t: 47, r: 0, b: 34, l: 0 } };
const fmt = (r: Rect) => `{x:${r.x},y:${r.y},w:${r.w},h:${r.h}}`;
type Colocar = (preferida: Esquina, p: Pieza, m: Marco, controles: readonly Rect[]) => Colocacion;

/** Escenas con controles en la franja de cada esquina; la caja elegida, con su margen, no puede tapar ninguno. */
const ESCENAS: { nombre: string; preferida: Esquina; pieza: Pieza; controles: Rect[] }[] = [
  { nombre: "botón sobre la base inf-der", preferida: "inf-der", pieza: ORBE, controles: [{ x: 300, y: 740, w: 80, h: 44 }] },
  { nombre: "barra de filtros abajo a todo lo ancho", preferida: "inf-izq", pieza: ORBE, controles: [{ x: 0, y: 720, w: 390, h: 60 }] },
  { nombre: "aviso arriba con Recargar y Cerrar", preferida: "sup-der", pieza: ORBE, controles: [{ x: 200, y: 50, w: 190, h: 48 }] },
  { nombre: "pestillo junto a un selector", preferida: "inf-der", pieza: PESTILLO, controles: [{ x: 330, y: 730, w: 60, h: 40 }] },
];

function comprobar(fn: Colocar): void {
  for (const e of ESCENAS) {
    const r = fn(e.preferida, e.pieza, M, e.controles);
    if (r.colision) continue;
    const caja = cajaEn(r.esquina, r.dy, e.pieza, M);
    const conMargen = { x: caja.x - MARGEN, y: caja.y - MARGEN, w: caja.w + 2 * MARGEN, h: caja.h + 2 * MARGEN };
    for (const c of e.controles) if (seCruzan(conMargen, c)) throw new Error(`el orbe tapó un control: ${fmt(c)} (${e.nombre})`);
  }
}

describe("colocación (design §5, RF-B7)", () => {
  it("la caja base respeta el área segura y 12 px", () => {
    expect(cajaEn("inf-der", 0, ORBE, M)).toEqual({ x: 390 - 12 - 56, y: 844 - 34 - 12 - 56, w: 56, h: 56 });
    expect(cajaEn("sup-izq", 0, ORBE, M)).toEqual({ x: 12, y: 47 + 12, w: 56, h: 56 });
    expect(cajaEn("inf-izq", 16, ORBE, M).y, "el desplazamiento abajo va hacia arriba").toBe(844 - 34 - 12 - 16 - 56);
    expect(cajaEn("sup-der", 16, ORBE, M).y, "el desplazamiento arriba va hacia abajo").toBe(47 + 12 + 16);
    expect(cajaEn("inf-der", 0, PESTILLO, M).x, "el pestillo va pegado al borde").toBe(390 - 44);
  });

  it("orden: la preferida y luego las otras tres en orden horario", () => {
    expect(orden("inf-der")).toEqual(["inf-der", "inf-izq", "sup-izq", "sup-der"]);
    expect(orden("sup-izq")).toEqual(["sup-izq", "sup-der", "inf-der", "inf-izq"]);
  });

  it("sin controles se queda en la base de la preferida", () => {
    expect(colocar("inf-izq", ORBE, M, [])).toEqual({ esquina: "inf-izq", dy: 0, colision: false });
  });

  it("el margen de 4 px cuenta: un control a 3 px aparta el orbe y uno a 4 px no", () => {
    const base = cajaEn("inf-der", 0, ORBE, M);
    const a3: Rect = { x: base.x - 3 - 20, y: base.y, w: 20, h: 20 };
    const a4: Rect = { x: base.x - 4 - 20, y: base.y, w: 20, h: 20 };
    expect(libre(base, [a3])).toBe(false);
    expect(libre(base, [a4])).toBe(true);
  });

  it("sube de 8 en 8 hasta el primer hueco libre", () => {
    const base = cajaEn("inf-der", 0, ORBE, M);
    // control que cubre la base y 20 px por encima: con el margen, el primer hueco libre queda en dy = 80
    const c: Rect = { x: base.x, y: base.y - 20, w: 56, h: 76 };
    const r = colocar("inf-der", ORBE, M, [c]);
    expect(r.esquina).toBe("inf-der");
    expect(r.dy).toBe(80);
    expect(libre(cajaEn("inf-der", r.dy, ORBE, M), [c])).toBe(true);
    expect(libre(cajaEn("inf-der", r.dy - 8, ORBE, M), [c]), "no eligió el primer hueco").toBe(false);
  });

  it("si la franja de 0 a 160 px está tapada, pasa a la siguiente esquina en orden horario", () => {
    const franja: Rect = { x: 300, y: 500, w: 90, h: 344 };
    const r = colocar("inf-der", ORBE, M, [franja]);
    expect(r).toEqual({ esquina: "inf-izq", dy: 0, colision: false });
  });

  it("si nada queda libre usa la base de la preferida y marca la colisión", () => {
    const todo: Rect = { x: 0, y: 0, w: 390, h: 844 };
    expect(colocar("sup-der", ORBE, M, [todo])).toEqual({ esquina: "sup-der", dy: 0, colision: true });
  });

  it("en las escenas, la caja elegida nunca tapa un control", () => {
    expect(() => comprobar(colocar)).not.toThrow();
  });

  it("red-check: una colocación que devuelve siempre la base tapa un control", async () => {
    expect(() => comprobar(colocar), "la colocación real debe pasar antes del red-check").not.toThrow();
    const siempreBase: Colocar = (preferida) => ({ esquina: preferida, dy: 0, colision: false });
    await rojoEscena(() => comprobar(siempreBase), "el orbe tapó un control: ");
  });
});

describe("lectura de controles del DOM (§5)", () => {
  const original = Object.getOwnPropertyDescriptor(document, "elementsFromPoint");
  afterEach(() => {
    document.body.innerHTML = "";
    if (original) Object.defineProperty(document, "elementsFromPoint", original);
    else delete (document as unknown as Record<string, unknown>).elementsFromPoint;
  });

  const caja = (el: Element, r: Rect) => {
    el.getBoundingClientRect = () =>
      ({ x: r.x, y: r.y, left: r.x, top: r.y, width: r.w, height: r.h, right: r.x + r.w, bottom: r.y + r.h, toJSON: () => r }) as DOMRect;
  };

  it("sin document.elementsFromPoint (happy-dom) devuelve «sin controles»", () => {
    expect(typeof (document as { elementsFromPoint?: unknown }).elementsFromPoint, "happy-dom ya trae elementsFromPoint: revisar el respaldo").not.toBe("function");
    const b = document.createElement("button");
    document.body.appendChild(b);
    caja(b, { x: 10, y: 10, w: 40, h: 40 });
    expect(leerControles()).toEqual([]);
  });

  it("con elementsFromPoint: cuenta el control visible y descarta el tapado, el del compañero, el deshabilitado y el oculto", () => {
    const visible = document.createElement("button");
    const tapado = document.createElement("button");
    const capa = document.createElement("div");
    const deshabilitado = document.createElement("button");
    deshabilitado.disabled = true;
    const oculto = document.createElement("button");
    oculto.style.visibility = "hidden";
    const host = document.createElement("div");
    host.id = "arcanum-companion";
    const propio = document.createElement("button");
    host.appendChild(propio);
    const icono = document.createElement("span");
    visible.appendChild(icono);
    document.body.append(visible, tapado, capa, deshabilitado, oculto, host);
    caja(visible, { x: 0, y: 0, w: 40, h: 40 });
    caja(tapado, { x: 100, y: 0, w: 40, h: 40 });
    caja(deshabilitado, { x: 200, y: 0, w: 40, h: 40 });
    caja(oculto, { x: 300, y: 0, w: 40, h: 40 });
    caja(propio, { x: 0, y: 100, w: 40, h: 40 });
    Object.defineProperty(document, "elementsFromPoint", {
      configurable: true,
      value: (x: number) => {
        if (x < 50) return [propio, icono, visible, document.body]; // el orbe encima: se salta lo del compañero
        if (x < 150) return [capa, tapado, document.body];
        return [document.body];
      },
    });
    expect(leerControles()).toEqual([{ x: 0, y: 0, w: 40, h: 40 }]);
  });
});
