"use client";
// Orbe del compañero (design §5, §6.2): botón de 56×56, blanco en todos los mundos, con ojos que parpadean.
// Arrastre sin setState (transform dentro de requestAnimationFrame); un toque de menos de 8 px abre.
import { useEffect, useRef, type CSSProperties, type KeyboardEvent as KeyboardEventReact, type PointerEvent as PointerEventReact } from "react";
import type { Esquina, EventoUi } from "@/lib/companion/estado-ui";
import { consumirEscape } from "./teclado";

const UMBRAL_ARRASTRE = 8;

interface Gesto {
  id: number;
  x0: number;
  y0: number;
  movido: boolean;
  captura: boolean;
  raf: number;
}

export function Orbe({
  esquina,
  dy,
  colision,
  globo,
  enfocarAlMontar,
  despachar,
}: {
  esquina: Esquina;
  dy: number;
  colision: boolean;
  globo: boolean;
  enfocarAlMontar: boolean;
  despachar: (e: EventoUi) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const gesto = useRef<Gesto | null>(null);
  const suprimirClic = useRef(false);
  const fuera = useRef<{ mover: (e: PointerEvent) => void; soltar: (e: PointerEvent) => void; cancelar: () => void } | null>(null);

  // al minimizar, el orbe nuevo toma el foco si nadie lo tiene (el abridor ya no está en el documento, §6.2)
  useEffect(() => {
    if (!enfocarAlMontar) return;
    const activo = document.activeElement;
    if (!activo || activo === document.body) ref.current?.focus({ preventScroll: true });
    // sólo al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (gesto.current?.raf) cancelAnimationFrame(gesto.current.raf);
      quitarOyentes();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function quitarOyentes() {
    if (!fuera.current) return;
    window.removeEventListener("pointermove", fuera.current.mover);
    window.removeEventListener("pointerup", fuera.current.soltar);
    window.removeEventListener("pointercancel", fuera.current.soltar);
    fuera.current = null;
  }

  function mover(x: number, y: number) {
    const g = gesto.current;
    const el = ref.current;
    if (!g || !el) return;
    const dx = x - g.x0;
    const dyp = y - g.y0;
    if (!g.movido && Math.hypot(dx, dyp) < UMBRAL_ARRASTRE) return;
    g.movido = true;
    if (g.raf) cancelAnimationFrame(g.raf);
    g.raf = requestAnimationFrame(() => {
      el.style.transform = `translate(${dx}px, ${dyp}px)`;
    });
  }

  function terminar(x: number, y: number) {
    const g = gesto.current;
    gesto.current = null;
    quitarOyentes();
    if (!g) return;
    if (g.raf) cancelAnimationFrame(g.raf);
    if (ref.current) ref.current.style.transform = "";
    if (!g.movido) return; // un toque: el clic que sigue abre
    suprimirClic.current = true;
    const der = x >= window.innerWidth / 2;
    const inf = y >= window.innerHeight / 2;
    despachar({ t: "soltar", esquina: `${inf ? "inf" : "sup"}-${der ? "der" : "izq"}` });
  }

  function cancelar() {
    const g = gesto.current;
    gesto.current = null;
    quitarOyentes();
    if (g?.raf) cancelAnimationFrame(g.raf);
    if (ref.current) ref.current.style.transform = "";
  }

  function alBajar(e: PointerEventReact<HTMLButtonElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = e.currentTarget;
    let captura = typeof el.setPointerCapture === "function";
    if (captura) {
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        captura = false;
      }
    }
    gesto.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, movido: false, captura, raf: 0 };
    if (!captura) {
      // sin captura de puntero (happy-dom, §3.4): el gesto se sigue en window mientras dura
      quitarOyentes();
      const o = {
        mover: (ev: PointerEvent) => {
          if (ev.pointerId === gesto.current?.id) mover(ev.clientX, ev.clientY);
        },
        soltar: (ev: PointerEvent) => {
          if (ev.pointerId === gesto.current?.id) terminar(ev.clientX, ev.clientY);
        },
        cancelar,
      };
      fuera.current = o;
      window.addEventListener("pointermove", o.mover);
      window.addEventListener("pointerup", o.soltar);
      window.addEventListener("pointercancel", o.cancelar);
    }
  }

  const estilo = { ["--cmp-dy" as string]: `${dy}px` } as CSSProperties;

  return (
    <button
      ref={ref}
      type="button"
      className="cmp-orbe"
      aria-label="Abrir el compañero"
      aria-keyshortcuts="Control+Period"
      data-cmp-esquina={esquina}
      data-cmp-colision={colision ? "1" : undefined}
      style={estilo}
      onPointerDown={alBajar}
      onPointerMove={(e) => {
        if (gesto.current?.captura && e.pointerId === gesto.current.id) mover(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (gesto.current?.captura && e.pointerId === gesto.current.id) terminar(e.clientX, e.clientY);
      }}
      onPointerCancel={(e) => {
        if (gesto.current?.captura && e.pointerId === gesto.current.id) cancelar();
      }}
      onClick={() => {
        if (suprimirClic.current) {
          suprimirClic.current = false;
          return;
        }
        despachar({ t: "tocarOrbe" });
      }}
      onKeyDown={(e: KeyboardEventReact<HTMLButtonElement>) => {
        const a = consumirEscape(e, { vista: "orbe", menu: false, pantalla: "conversacion", globo });
        if (a && a.t !== "cerrarMenu" && a.t !== "volver") despachar(a);
      }}
    >
      <span className="cmp-ojos" aria-hidden="true">
        <span className="cmp-ojo" />
        <span className="cmp-ojo" />
      </span>
    </button>
  );
}
