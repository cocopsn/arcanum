// Citas y enlaces del visor (design §10). Puro: filtra las citas del modelo contra los pasajes que de verdad se
// mandaron (RF-R9), arma la línea «Fuentes: …» con los datos de la tabla local (nunca con texto del modelo), convierte
// las marcas [Pn] del markdown en enlaces internos #cita-Pn, y valida el enlace al Atlas (palantir.com/docs). No toca
// el DOM ni la red.
import type { PasajeEnviado } from "./tipos";

/** Un id de pasaje válido: P1…P8. */
export const ID_PASAJE_RE = /^P[1-8]$/;

/** Una cita ya resuelta contra la tabla local del mensaje. */
export interface CitaResuelta {
  id: string;
  titulo: string;
  seccion: string;
  /** a dónde lleva el visor (§10) */
  destino: string;
}

/**
 * Filtro de citas (RF-R9): de `respuesta.citas` deja sólo los ids que están en `pasajesEnviados` de ese mensaje, sin
 * repetidos y en el orden en que aparecen, con los datos de la tabla local (nunca con texto del modelo).
 */
export function citasValidas(citas: unknown, pasajesEnviados: PasajeEnviado[]): CitaResuelta[] {
  const porId = new Map(pasajesEnviados.map((p) => [p.id, p]));
  const lista = Array.isArray(citas) ? citas : [];
  const vistos = new Set<string>();
  const out: CitaResuelta[] = [];
  for (const c of lista) {
    if (typeof c !== "string" || !ID_PASAJE_RE.test(c) || vistos.has(c)) continue;
    const p = porId.get(c);
    if (!p) continue;
    vistos.add(c);
    out.push({ id: c, titulo: p.titulo, seccion: p.seccion, destino: p.destino });
  }
  return out;
}

/** Los ids de pasaje que de verdad se mandaron, para que Markdown.tsx pinte [Pn] como botón sólo si está (§10). */
export function idsEnviados(pasajesEnviados: PasajeEnviado[]): Set<string> {
  return new Set(pasajesEnviados.map((p) => p.id));
}

/** La línea «Fuentes: [1] <título> · <sección>» con los datos locales; sin citas válidas, el texto fijo (§10). */
export function lineaFuentes(citas: CitaResuelta[]): string {
  if (citas.length === 0) return "Sin cita de tus materiales";
  const partes = citas.map((c, i) => `[${i + 1}] ${c.titulo}${c.seccion ? ` · ${c.seccion}` : ""}`);
  return `Fuentes: ${partes.join("  ")}`;
}

/**
 * Convierte las marcas [Pn] del markdown en enlaces internos [Pn](#cita-Pn), sólo para los ids válidos que están en
 * `enviados`; las demás quedan como texto. Se aplica antes de pintar (Markdown.tsx pinta el botón sólo si el id está en
 * la tabla, §10). No toca las marcas dentro de cercas de código.
 */
export function enlazarCitas(md: string, enviados: Set<string>): string {
  return md.replace(/\[(P[1-8])\]/g, (m, id: string) => (enviados.has(id) ? `[${id}](#cita-${id})` : m));
}

/** Clave del Atlas válida (§10): sólo minúsculas/dígitos y `/_.-`, sin `..`. */
export function kAtlasValida(k: string): boolean {
  return typeof k === "string" && /^[a-z0-9][a-z0-9/_.-]*$/.test(k) && !k.includes("..");
}

/**
 * Enlace al Atlas (§10): `https://www.palantir.com/docs/<k>` sólo si `k` pasa `valida` y el resultado, leído con
 * `new URL`, tiene host `www.palantir.com` y un pathname que empieza con `/docs/`. Las dos comprobaciones fallan con el
 * mismo `null`. `valida` es inyectable sólo para el red-check (§10): `enlaceAtlas(k, () => true)` → «el visor armó un
 * enlace fuera de palantir.com/docs: ../x».
 */
export function enlaceAtlas(k: string, valida: (k: string) => boolean = kAtlasValida): string | null {
  if (!valida(k)) return null;
  const url = `https://www.palantir.com/docs/${k}`;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.host !== "www.palantir.com") return null;
  if (!u.pathname.startsWith("/docs/")) return null;
  return u.href;
}
