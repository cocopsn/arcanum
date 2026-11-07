// Textos y estado visible de la barra de descarga de Lecturas (design poblar §5.4, §5.5, §6.4, §6.7 y §6.11). Puro:
// recibe el estado ya verificado contra el almacenamiento (forgeRouteStatus / forgeWorldStatus) y lo traduce a lo que
// la barra pinta. «Descargada ✓» sale sólo de `completa`; el registro de `routes` sólo separa «Sin descargar» de una
// descarga que quedó a medias.
import { OPAQUE_PAD_BYTES } from "@/lib/offline/rules";
import type { DeleteResult, OfflineKind, ScopeStatus } from "@/lib/offline/types";

/** §6.11, sin SW controlando: lo mismo que dice partialText cuando `app` es null. */
export const APP_NO_INSTALADA = "La app aún no está instalada para usarse sin red: ábrela una vez con conexión";
/** §6.7, Safari de iOS sin instalar. */
export const IOS_SIN_INSTALAR = "En Safari sin instalar, iOS borra los datos de un sitio tras 7 días sin abrirlo. Instálala en la pantalla de inicio.";
export const SIN_DESCARGAR = "Sin descargar";
export const PYTHON_SE_QUEDA = "Python se queda: lo usan todos los mundos";

/** Bytes como los cuenta Lecturas: MB con un decimal desde 1 MB, KB por debajo. */
export function sizeText(b: number): string {
  if (b <= 0) return "0 KB";
  return b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`;
}

export type BarView = { k: "completa"; texto: string } | { k: "parcial"; texto: string } | { k: "sin-descargar"; texto: string };

/** Lo que dice la barra en reposo. `registrada`: hay fila en `routes` para este alcance (se intentó descargar y no se
 *  borró). `parcial`: el texto de partialText(estado). */
export function barView(st: ScopeStatus, registrada: boolean, parcial: string | null): BarView {
  if (st.completa) {
    const libros = st.libros.total ? ` · ${st.libros.listos}/${st.libros.total} libros` : "";
    return { k: "completa", texto: `Descargada ✓${libros}` };
  }
  if (registrada) return { k: "parcial", texto: parcial || APP_NO_INSTALADA };
  return { k: "sin-descargar", texto: SIN_DESCARGAR };
}

/** Etiqueta del botón: «Descargar ruta S1 · ≈ 2.5 MB» o «Descargar mundo · ≈ 40.1 MB». Sin bytes por bajar, sin tamaño. */
export function downloadLabel(code: string | null, bytesPrevistos: number): string {
  const base = code ? `Descargar ruta ${code}` : "Descargar mundo";
  return bytesPrevistos > 0 ? `${base} · ≈ ${sizeText(bytesPrevistos)}` : base;
}

/** La línea de figuras (§5.5): no suman bytes, pero cuentan cuota por ser respuestas opacas (§6.5). */
export function figurasText(st: ScopeStatus): string | null {
  const n = st.figuras.total;
  if (!n) return null;
  const cuota = Math.round((n * OPAQUE_PAD_BYTES) / 1e6);
  const guardadas = st.figuras.listos > 0 && st.figuras.listos < n ? ` · ${st.figuras.listos} guardadas` : "";
  return `Incluye ${n} figura${n === 1 ? "" : "s"} de palantir.com (≈ ${cuota} MB de cuota)${guardadas}`;
}

const KIND_LABEL: Record<OfflineKind, string> = { libros: "libros", bancos: "bancos", atlas: "Atlas", python: "Python", figuras: "figuras", app: "app" };

/** «Descargando libros · 3 de 30»; antes del primer avance, «Preparando la descarga…». */
export function progressText(p: { hecho: number; total: number; tipo: OfflineKind | null }): string {
  if (!p.tipo || !p.total) return "Preparando la descarga…";
  return `Descargando ${KIND_LABEL[p.tipo]} · ${p.hecho} de ${p.total}`;
}

/** «Liberados X MB» y lo que se quedó: lo compartido con otras rutas y Python. */
export function freedText(r: DeleteResult, opts: { python: boolean }): string {
  const parts = [`Liberados ${sizeText(r.liberadosBytes)}`];
  if (r.figurasBorradas > 0) parts.push(`${r.figurasBorradas} figura${r.figurasBorradas === 1 ? "" : "s"} borrada${r.figurasBorradas === 1 ? "" : "s"}`);
  if (r.compartidosBytes > 0) parts.push(`${sizeText(r.compartidosBytes)} compartidos con otras rutas se quedan`);
  if (opts.python) parts.push(PYTHON_SE_QUEDA);
  return [...parts, ...r.errores].join(" · ");
}
