"use client";
// src/ui/companion/CompanionMount.tsx — lo ÚNICO del compañero en el chunk de página.
import { Component, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { createPortal } from "react-dom";

const ID = "arcanum-companion";
// Dueño a nivel de módulo (iteración 3, r3 #10): con dos instancias montadas, sólo pinta la que lo tomó primero.
let dueno: symbol | null = null;

// Límite de error propio (iteración 3): un error de render del compañero apaga el compañero y nada más. Sin él, el
// error sube por el padre de React del portal (CompanionMount, hermano de HomeView) hasta src/app/error.tsx de
// cb09d76, que reemplaza la página entera por «Algo falló al pintar esta pantalla» (y sin error.tsx, React 18
// desmonta la raíz). Eso desmontaría la vista de abajo (RF-B3).
class LimiteCompanero extends Component<{ children: ReactNode }, { roto: boolean }> {
  state = { roto: false };
  static getDerivedStateFromError() { return { roto: true }; }
  componentDidCatch(e: unknown) {
    console.warn("[compañero] se apagó por un error:", e instanceof Error ? e.name : "error");
  }
  render() { return this.state.roto ? null : this.props.children; }
}

export function CompanionMount() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [Root, setRoot] = useState<ComponentType | null>(null);
  useEffect(() => {
    if (dueno) return; // otra instancia ya pinta el compañero: ésta no crea, no carga y no pinta nada
    const yo = Symbol("compañero");
    dueno = yo;
    let el = document.getElementById(ID);
    const creado = !el;
    if (!el) {
      el = document.createElement("div");
      el.id = ID;
      // capa propia en la raíz (§3.2); pointer-events: none deja pasar los toques fuera de sus piezas
      el.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:92;isolation:isolate";
      document.body.appendChild(el); // el único cambio en <body> (RF-B3.4)
    }
    setHost(el);
    let vivo = true;
    let intentos = 0;
    const cargar = (): void => {
      import(/* webpackChunkName: "companion-ui" */ "./CompanionRoot")
        .then((m) => { if (vivo) setRoot(() => m.CompanionRoot); })
        .catch((e: unknown) => {
          console.warn("[compañero] no se pudo cargar:", e instanceof Error ? e.name : "error");
          if (vivo && ++intentos < 3) window.addEventListener("online", cargar, { once: true });
        });
    };
    const idle = typeof window.requestIdleCallback === "function";
    const t = idle ? window.requestIdleCallback(cargar, { timeout: 1500 }) : window.setTimeout(cargar, 300);
    return () => {
      vivo = false;
      if (idle) window.cancelIdleCallback(t);
      else window.clearTimeout(t);
      window.removeEventListener("online", cargar);
      if (creado) el?.remove();
      if (dueno === yo) dueno = null;
    };
  }, []);
  return host && Root ? createPortal(<LimiteCompanero><Root /></LimiteCompanero>, host) : null;
}
