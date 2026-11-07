"use client";
// Trampa de foco propia del compañero (design §6.2). Igual que use-focus-trap.ts (misma lista de enfocables), pero todo
// foco va con preventScroll: true, para no mover el scroll de la vista de abajo (§3.3).
import { useEffect, type RefObject } from "react";

const ENFOCABLES =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

const enfocar = (el: HTMLElement | null | undefined): void => el?.focus({ preventScroll: true });

/** Al activarse guarda el abridor y enfoca el compositor (`[data-cmp-autofoco]`, o el primer enfocable, o el panel);
 *  Tab y Shift+Tab ciclan dentro; al soltarse devuelve el foco al abridor si sigue en el documento y es enfocable.
 *  Si no, el foco queda libre y el orbe nuevo lo toma al montarse (Orbe.tsx, enfocarAlMontar). */
export function useTrampaCompanero(ref: RefObject<HTMLElement | null>, activo: boolean): void {
  useEffect(() => {
    if (!activo) return;
    const nodo = ref.current;
    if (!nodo) return;
    const abridor = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const lista = () => [...nodo.querySelectorAll<HTMLElement>(ENFOCABLES)];
    enfocar(nodo.querySelector<HTMLElement>("[data-cmp-autofoco]") ?? lista()[0] ?? nodo);

    function alTeclear(e: KeyboardEvent) {
      if (e.key !== "Tab" || !nodo) return;
      const items = lista();
      if (items.length === 0) {
        e.preventDefault();
        enfocar(nodo);
        return;
      }
      const primero = items[0]!;
      const ultimo = items[items.length - 1]!;
      const activoAhora = document.activeElement;
      if (e.shiftKey && (activoAhora === primero || activoAhora === nodo)) {
        e.preventDefault();
        enfocar(ultimo);
      } else if (!e.shiftKey && activoAhora === ultimo) {
        e.preventDefault();
        enfocar(primero);
      }
    }

    nodo.addEventListener("keydown", alTeclear);
    return () => {
      nodo.removeEventListener("keydown", alTeclear);
      if (abridor && abridor !== document.body && abridor.isConnected && !nodo.contains(abridor) && !abridor.closest("[inert]")) enfocar(abridor);
    };
  }, [ref, activo]);
}
