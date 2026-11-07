"use client";
// Panel del compañero (design §6.1-§6.3, §9.1): hoja inferior o panel flotante, scrim, encabezado con menú, estado
// vacío y el aviso del contrato de chunks con «Recargar» cuando aplica. Diálogo modal con trampa de foco propia.
import { useEffect, useRef, useState, type KeyboardEvent as KeyboardEventReact } from "react";
import type { Esquina, EventoUi } from "@/lib/companion/estado-ui";
import { useLayoutMode } from "@/ui/layout-mode";
import { avisoCarga } from "./aviso-carga";
import { useTrampaCompanero } from "./foco";
import { IconoAviso, IconoMenu, IconoNueva, IconoVacio } from "./iconos";
import { consumirEscape, type Pantalla } from "./teclado";
import { Conversacion, type ConversacionDeps } from "./Conversacion";

const ESQUINAS: { esquina: Esquina; texto: string }[] = [
  { esquina: "inf-der", texto: "Abajo a la derecha" },
  { esquina: "inf-izq", texto: "Abajo a la izquierda" },
  { esquina: "sup-der", texto: "Arriba a la derecha" },
  { esquina: "sup-izq", texto: "Arriba a la izquierda" },
];

type Menu = "cerrado" | "abierto" | "esquinas";

/** Hoja cuando el modo no es escritorio o la ventana mide menos de 640 px (§6.1). */
function useHoja(): boolean {
  const { mode } = useLayoutMode();
  const [ancho, setAncho] = useState(() => window.innerWidth);
  useEffect(() => {
    const alCambiar = () => setAncho(window.innerWidth);
    window.addEventListener("resize", alCambiar);
    return () => window.removeEventListener("resize", alCambiar);
  }, []);
  return mode !== "desktop" || ancho < 640;
}

export function Panel({
  esquina,
  activo,
  despachar,
  precargar,
  conversacion,
}: {
  esquina: Esquina;
  /** false durante una ceremonia: la trampa de foco se suspende (§3.2) */
  activo: boolean;
  despachar: (e: EventoUi) => void;
  /** carga en reposo de las partes perezosas; si falla, el panel pinta el contrato de chunks (§9.1) */
  precargar?: () => Promise<unknown>;
  /** dependencias de la conversación; si están, el cuerpo pinta la conversación en vez del estado vacío */
  conversacion?: ConversacionDeps;
}) {
  const hoja = useHoja();
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<Menu>("cerrado");
  const [pantalla, setPantalla] = useState<Pantalla>("conversacion");
  const [aviso, setAviso] = useState<{ texto: string; recargar: boolean } | null>(null);
  useTrampaCompanero(panel, activo);

  // la rueda y el dedo sobre el scrim no desplazan el documento de abajo (oyentes nativos no pasivos)
  useEffect(() => {
    const el = scrim.current;
    if (!el) return;
    const frenar = (e: Event) => e.preventDefault();
    el.addEventListener("wheel", frenar, { passive: false });
    el.addEventListener("touchmove", frenar, { passive: false });
    return () => {
      el.removeEventListener("wheel", frenar);
      el.removeEventListener("touchmove", frenar);
    };
  }, []);

  // --cmp-vv-h sigue al teclado de iOS si existe visualViewport; si no, la hoja usa 100dvh
  useEffect(() => {
    const vv = window.visualViewport;
    const el = panel.current;
    if (!vv || !el) return;
    const medir = () => el.style.setProperty("--cmp-vv-h", `${vv.height}px`);
    medir();
    vv.addEventListener("resize", medir);
    return () => vv.removeEventListener("resize", medir);
  }, []);

  // si iOS desplazó window al abrir el teclado, se deshace al cerrar (§3.3, única excepción)
  useEffect(() => {
    const x = window.scrollX;
    const y = window.scrollY;
    return () => {
      if (window.scrollX !== x || window.scrollY !== y) window.scrollTo(x, y);
    };
  }, []);

  useEffect(() => {
    if (!precargar) return;
    let vivo = true;
    const correr = () => {
      precargar().catch((e: unknown) => {
        if (!vivo) return;
        console.warn("[compañero] una parte no cargó:", e instanceof Error ? e.name : "error");
        setAviso(avisoCarga(e, { controlled: !!navigator.serviceWorker?.controller, online: navigator.onLine }));
      });
    };
    const idle = typeof window.requestIdleCallback === "function";
    const t = idle ? window.requestIdleCallback(correr, { timeout: 1500 }) : window.setTimeout(correr, 300);
    return () => {
      vivo = false;
      if (idle) window.cancelIdleCallback(t);
      else window.clearTimeout(t);
    };
  }, [precargar]);

  function alTeclear(e: KeyboardEventReact<HTMLDivElement>) {
    const a = consumirEscape(e, { vista: "panel", menu: menu !== "cerrado", pantalla, globo: false });
    if (!a) return;
    if (a.t === "cerrarMenu") setMenu("cerrado");
    else if (a.t === "volver") setPantalla("conversacion");
    else despachar(a);
  }

  return (
    <>
      <div
        ref={scrim}
        className={hoja ? "cmp-scrim cmp-scrim-hoja" : "cmp-scrim"}
        aria-hidden="true"
        onClick={() => despachar({ t: "tocarFuera" })}
      />
      <div
        ref={panel}
        id="cmp-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cmp-titulo"
        tabIndex={-1}
        className={hoja ? "cmp-panel cmp-hoja" : "cmp-panel cmp-flotante"}
        data-cmp-esquina={esquina}
        onKeyDown={alTeclear}
      >
        {hoja && <span className="cmp-asa" aria-hidden="true" />}
        <div data-cmp-contenido="" className="cmp-contenido">
          <div className="cmp-encabezado">
            <div className="cmp-encabezado-texto">
              <h2 id="cmp-titulo" className="cmp-titulo">
                Nueva conversación
              </h2>
              <p className="cmp-subtitulo">¿En qué te ayudo?</p>
            </div>
            <button
              type="button"
              className="cmp-boton-redondo"
              aria-label="Nueva conversación"
              onClick={() => {
                setMenu("cerrado");
                setPantalla("conversacion");
              }}
            >
              <IconoNueva />
            </button>
            <button
              type="button"
              className="cmp-boton-redondo"
              aria-label="Menú del compañero"
              aria-haspopup="true"
              aria-expanded={menu !== "cerrado"}
              onClick={() => setMenu(menu === "cerrado" ? "abierto" : "cerrado")}
            >
              <IconoMenu />
            </button>
            {menu === "abierto" && (
              <div className="cmp-menu">
                <button type="button" className="cmp-menu-item" onClick={() => despachar({ t: "ocultar" })}>
                  Ocultar compañero
                </button>
                <button type="button" className="cmp-menu-item" onClick={() => setMenu("esquinas")}>
                  Mover a la esquina…
                </button>
              </div>
            )}
            {menu === "esquinas" && (
              <div className="cmp-menu">
                <p className="cmp-menu-titulo">Mover a la esquina</p>
                {ESQUINAS.map((o) => (
                  <button
                    key={o.esquina}
                    type="button"
                    className="cmp-menu-item"
                    aria-current={o.esquina === esquina ? "true" : undefined}
                    onClick={() => {
                      setMenu("cerrado");
                      despachar({ t: "moverA", esquina: o.esquina });
                    }}
                  >
                    {o.texto}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="cmp-cuerpo">
            {aviso && (
              <div className="cmp-aviso">
                <IconoAviso />
                <span>{aviso.texto}</span>
                {aviso.recargar && (
                  <button type="button" className="cmp-boton cmp-recargar" onClick={() => location.reload()}>
                    Recargar
                  </button>
                )}
              </div>
            )}
            {pantalla === "conversacion" && conversacion ? (
              <Conversacion deps={conversacion} />
            ) : (
              <div className="cmp-vacio">
                <IconoVacio />
                <p className="cmp-vacio-titulo">Empecemos.</p>
                <p className="cmp-vacio-texto">Escribe tu pregunta y envíala para empezar.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
