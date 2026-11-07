// Sensor de sólo lectura del compañero (design §12.1). Lee el mundo, loadResume(), el [role="dialog"] visible fuera del
// compañero (gana el de mayor z-index y, a igualdad, el último en el DOM), sus aria-label/labelledby y marcadores ya
// presentes. NUNCA lee el value de un campo: el texto que el aprendiz escribe en una compuerta no sale del componente.
// fuentes-seguras.test.ts exige que este archivo no contenga /\.value\b/, innerText, FormData ni selectionStart.
import { loadResume, type ResumeState } from "@/lib/resume";
import type { Superficie } from "@/lib/companion/tipos";
import type { TipoItem } from "@/lib/companion/fase";

export type { TipoItem };

/** Lo que el sensor observa del DOM y del resume (§12.1); lo consume ubicacion.ts y, vía fase.ts, la inferencia. */
export interface Sensado {
  mundoData: string | null;
  resume: ResumeState | null;
  superficie: Superficie;
  /** título leído del h2 del diálogo ganador (con textContent, nunca de un campo) */
  tituloDialogo: string | null;
  /** etiqueta del libro abierto (aria-label del diálogo ganador) */
  libroEtiqueta: string | null;
  /** lenguaje del ejercicio abierto, si lo nombra la etiqueta previa */
  lenguaje: "javascript" | "python" | null;
  /** tipo del ítem de práctica/flujo abierto (data-item o el flujo) */
  tipoItem: TipoItem;
  /** código de celda de Forge leído de [data-forge-cell-panel] */
  codigoForge: string | null;
  /** hay un ítem de retención abierto */
  itemRetencion: boolean;
}

/** Un diálogo visible fuera del compañero, con su z-index computado. */
interface DialogoVisible {
  el: Element;
  z: number;
  etiqueta: string | null;
}

const COMPANERO = "#arcanum-companion";

/** Dentro de happy-dom no hay getComputedStyle completo; se detecta y cae a 0. */
function zIndexDe(el: Element): number {
  try {
    const z = getComputedStyle(el as HTMLElement).zIndex;
    const n = Number(z);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** aria-label directo o el texto del elemento al que apunta aria-labelledby. */
function etiquetaDe(el: Element): string | null {
  const label = el.getAttribute("aria-label");
  if (label) return label;
  const id = el.getAttribute("aria-labelledby");
  if (id) {
    const ref = (el.ownerDocument ?? document).getElementById(id);
    if (ref) return ref.textContent?.trim() ?? null;
  }
  return null;
}

/** El diálogo ganador fuera del compañero: mayor z-index, y a igualdad el último en el DOM. */
function dialogoGanador(doc: Document): DialogoVisible | null {
  const companero = doc.querySelector(COMPANERO);
  const dialogos = [...doc.querySelectorAll('[role="dialog"]')].filter((d) => !(companero && companero.contains(d)));
  let ganador: DialogoVisible | null = null;
  for (const el of dialogos) {
    const z = zIndexDe(el);
    if (!ganador || z >= ganador.z) ganador = { el, z, etiqueta: etiquetaDe(el) };
  }
  return ganador;
}

/** El h2 del diálogo (título del ejercicio o la lección), con textContent. */
function tituloH2(el: Element): string | null {
  return el.querySelector("h2")?.textContent?.trim() ?? null;
}

/** El tipo de ítem de un runner/stub abierto dentro del diálogo (§12.1). */
function tipoItemDe(dialogo: Element): { tipo: TipoItem; retencion: boolean } {
  const flow = dialogo.querySelector("[data-forge-flow]");
  if (flow) {
    const f = flow.getAttribute("data-forge-flow");
    if (f === "ontologia") return { tipo: "ontologia", retencion: false };
  }
  const stub = dialogo.querySelector("[data-forge-stub]");
  if (stub) {
    const s = (stub.getAttribute("data-forge-stub") ?? "").replace(/^flow-/, "");
    if (s === "retencion") return { tipo: "retencion", retencion: true };
    if (esTipoItem(s)) return { tipo: s, retencion: false };
  }
  const runner = dialogo.querySelector("[data-forge-runner][data-item], [data-forge-stub][data-item]");
  if (runner) {
    const t = runner.getAttribute("data-item") ?? "";
    if (esTipoItem(t)) return { tipo: t, retencion: t === "retencion" };
  }
  return { tipo: null, retencion: false };
}

const TIPOS_ITEM = new Set<string>([
  "prediccion",
  "desvanecido",
  "historial",
  "mutantes",
  "contraejemplo",
  "senal",
  "code",
  "sql",
  "ontologia",
  "permisos",
  "recuperacion",
  "forense",
  "gameday",
  "expediente",
  "practica",
  "retencion",
]);
function esTipoItem(s: string): s is Exclude<TipoItem, null> {
  return TIPOS_ITEM.has(s);
}

/** La superficie a partir del diálogo ganador y los marcadores (§12.1, orden de la tabla). */
function superficieDe(doc: Document, resume: ResumeState | null, dialogo: DialogoVisible | null): Superficie {
  const et = dialogo?.etiqueta ?? "";
  if (et.startsWith("Ejercicios · ")) return "ejercicios";
  if (et.startsWith("Lección · ")) return "leccion";
  if (dialogo) {
    const d = dialogo.el;
    if (d.querySelector('[data-forge-flow], [data-forge-stub^="flow-"]')) return "mision";
    if (d.querySelector("[data-forge-runner], [data-forge-stub]")) return "practica_forge";
    if (resume?.bookId && dialogo.etiqueta) return "libro";
    if (d.querySelector("[data-forge-cell-panel]") || resume?.cell) return "celda";
  }
  if (doc.querySelector("[data-forge-atlas]")) return "atlas";
  if (doc.querySelector('[role="region"][aria-label="Engineering Forge"]') || resume?.world) return "mundo";
  if (resume?.bookId) return "libro";
  return "inicio";
}

/** Lee el lenguaje de la etiqueta «JavaScript»/«Python» que precede al ítem (§12.1). */
function lenguajeDe(dialogo: Element | null): "javascript" | "python" | null {
  const t = dialogo?.textContent ?? "";
  if (/\bJavaScript\b/.test(t)) return "javascript";
  if (/\bPython\b/.test(t)) return "python";
  return null;
}

/** Lee el estado del DOM y del resume, sin tocar ningún campo (§12.1). */
export function sensar(doc: Document = document): Sensado {
  const mundoData = doc.body?.dataset?.world ?? null;
  const resume = loadResume();
  const dialogo = dialogoGanador(doc);
  const superficie = superficieDe(doc, resume, dialogo);
  const { tipo, retencion } = dialogo ? tipoItemDe(dialogo.el) : { tipo: null as TipoItem, retencion: false };
  const panel = dialogo ? (dialogo.el.matches("[data-forge-cell-panel]") ? dialogo.el : dialogo.el.querySelector("[data-forge-cell-panel]")) : null;
  return {
    mundoData,
    resume,
    superficie,
    tituloDialogo: dialogo ? tituloH2(dialogo.el) : null,
    libroEtiqueta: superficie === "libro" ? (dialogo?.etiqueta ?? null) : null,
    lenguaje: lenguajeDe(dialogo?.el ?? null),
    tipoItem: tipo,
    codigoForge: panel?.getAttribute("data-forge-cell-panel") || null,
    itemRetencion: retencion,
  };
}
