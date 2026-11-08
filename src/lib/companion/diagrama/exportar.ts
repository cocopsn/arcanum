// Exportación de un diagrama a SVG y PNG (design §16.4). El SVG sale de svg-texto.ts (puro, lista blanca, monocromo).
// El PNG se rasteriza a 2× con un <canvas>; si toBlob falla (canvas contaminado en WebKit, R8) devuelve el aviso
// «No se pudo generar el PNG; el SVG sigue disponible» y el SVG sigue disponible. Detecta cada API del DOM antes de
// usarla (§3.4): en Node/SSR sólo el SVG está disponible.
import type { ModeloDiagrama } from "./layout";
import { diagramaASvg } from "./svg-texto";

export const AVISO_PNG = "No se pudo generar el PNG; el SVG sigue disponible.";

/** El SVG como cadena (puro). */
export function exportarSvg(modelo: ModeloDiagrama): string {
  return diagramaASvg(modelo);
}

/** El SVG como Blob para descarga. */
export function svgBlob(modelo: ModeloDiagrama): Blob {
  return new Blob([exportarSvg(modelo)], { type: "image/svg+xml" });
}

/** Rasteriza el SVG a PNG 2× en un canvas. Devuelve el Blob o, si no se pudo, el aviso. */
export async function exportarPng(modelo: ModeloDiagrama): Promise<{ ok: true; blob: Blob } | { ok: false; aviso: string }> {
  if (typeof document === "undefined" || typeof Image === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return { ok: false, aviso: AVISO_PNG };
  }
  const svg = exportarSvg(modelo);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = await cargarImagen(url);
    const escala = 2;
    const w = Math.max(modelo.ancho, 1) * escala;
    const h = Math.max(modelo.alto, 1) * escala;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ok: false, aviso: AVISO_PNG };
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob((b) => resolve(b), "image/png");
      } catch {
        resolve(null);
      }
    });
    return blob ? { ok: true, blob } : { ok: false, aviso: AVISO_PNG };
  } catch {
    return { ok: false, aviso: AVISO_PNG };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function cargarImagen(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("no se pudo cargar el SVG"));
    img.src = url;
  });
}
