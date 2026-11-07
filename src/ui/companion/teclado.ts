// Escape dentro del compañero (design §6.3). Módulo propio para que el red-check de CA-05 sustituya consumirEscape con
// vi.mock: un vi.mock no reemplaza una función interna del mismo módulo.
import type { EventoUi, Vista } from "@/lib/companion/estado-ui";

export type Pantalla = "conversacion" | "visor" | "practica" | "historial";

export interface EstadoEscape {
  vista: Vista;
  menu: boolean;
  pantalla: Pantalla;
  globo: boolean;
}

/** Lo que hace un Escape consumido: cierra el menú, vuelve a la conversación o es un evento de la UI. */
export type AccionEscape = { t: "cerrarMenu" } | { t: "volver" } | EventoUi;

/** Orden de §6.3: menú, pantalla, globo, minimizar. Null si el Escape no cambia nada. Pura. */
export function decidirEscape(s: EstadoEscape): AccionEscape | null {
  if (s.vista === "panel") {
    if (s.menu) return { t: "cerrarMenu" };
    if (s.pantalla !== "conversacion") return { t: "volver" };
    return { t: "escape" };
  }
  if (s.vista === "orbe" && s.globo) return { t: "globoVisto" };
  return null;
}

/** Decide y, si el Escape cambia algo, lo detiene: en React 18 eso detiene también el evento nativo en el contenedor
 *  del portal, así que no llega a los oyentes de window de la vista de abajo. Si no cambia nada, el evento sigue. */
export function consumirEscape(e: { key: string; stopPropagation(): void }, s: EstadoEscape): AccionEscape | null {
  if (e.key !== "Escape") return null;
  const a = decidirEscape(s);
  if (a) e.stopPropagation();
  return a;
}
