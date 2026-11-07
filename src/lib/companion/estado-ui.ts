// Estado de la UI del compañero y su persistencia (design §4). Puro, sin DOM: localStorage se lee y se escribe sólo en
// cargarUi/guardarUi, que nunca lanzan (Safari en privado deja el estado en memoria).

export type Vista = "oculto" | "orbe" | "panel";
export type Esquina = "inf-der" | "inf-izq" | "sup-der" | "sup-izq";
export interface EstadoUi {
  v: 1;
  vista: Vista;
  esquina: Esquina;
  globoVisto: boolean;
}
export type EventoUi =
  | { t: "tocarOrbe" }
  | { t: "atajo" }
  | { t: "minimizar" }
  | { t: "escape" }
  | { t: "tocarFuera" }
  | { t: "ocultar" }
  | { t: "tocarPestillo" }
  | { t: "soltar"; esquina: Esquina }
  | { t: "moverA"; esquina: Esquina }
  | { t: "globoVisto" };

export const INICIAL: EstadoUi = { v: 1, vista: "orbe", esquina: "inf-der", globoVisto: false };
export const LLAVE_UI = "arcanum_companion_ui";
export const VISTAS: readonly Vista[] = ["oculto", "orbe", "panel"];
export const ESQUINAS: readonly Esquina[] = ["inf-der", "inf-izq", "sup-der", "sup-izq"];

/** Tabla de §4. Un evento que no cambia nada devuelve el mismo objeto. */
export function transicion(s: EstadoUi, e: EventoUi): EstadoUi {
  const con = (cambio: Partial<EstadoUi>): EstadoUi => ({ ...s, ...cambio });
  switch (e.t) {
    case "tocarOrbe":
      return s.vista === "orbe" ? con({ vista: "panel" }) : s;
    case "atajo":
      return con({ vista: s.vista === "panel" ? "orbe" : "panel" });
    case "minimizar":
    case "escape":
    case "tocarFuera":
      return s.vista === "panel" ? con({ vista: "orbe" }) : s;
    case "ocultar":
      return s.vista === "oculto" ? s : con({ vista: "oculto" });
    case "tocarPestillo":
      return s.vista === "oculto" ? con({ vista: "orbe" }) : s;
    case "soltar":
    case "moverA":
      return s.esquina === e.esquina ? s : con({ esquina: e.esquina });
    case "globoVisto":
      return s.globoVisto ? s : con({ globoVisto: true });
  }
}

/** Fallar-cerrado: ausente, de otra versión, con campos fuera de enumeración o ilegible → INICIAL. */
export function cargarUi(): EstadoUi {
  try {
    const raw = localStorage.getItem(LLAVE_UI);
    if (!raw) return INICIAL;
    const p = JSON.parse(raw) as Partial<EstadoUi> | null;
    if (!p || typeof p !== "object" || p.v !== 1) return INICIAL;
    if (!VISTAS.includes(p.vista as Vista) || !ESQUINAS.includes(p.esquina as Esquina) || typeof p.globoVisto !== "boolean") return INICIAL;
    // una recarga nunca abre el diálogo modal encima de la vista restaurada
    return { v: 1, vista: p.vista === "panel" ? "orbe" : (p.vista as Vista), esquina: p.esquina as Esquina, globoVisto: p.globoVisto };
  } catch {
    return INICIAL;
  }
}

/** `vista: "panel"` se guarda como `"orbe"`. Best-effort. */
export function guardarUi(s: EstadoUi): void {
  try {
    const g: EstadoUi = { v: 1, vista: s.vista === "panel" ? "orbe" : s.vista, esquina: s.esquina, globoVisto: s.globoVisto };
    localStorage.setItem(LLAVE_UI, JSON.stringify(g));
  } catch {
    /* sin almacenamiento: el estado vive en memoria */
  }
}
