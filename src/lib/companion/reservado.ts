// Filtro de contenido reservado D12 (design §12.7, §9.5). Usa gramas.mjs, el mismo módulo con el que el generador hizo
// reservado.json, así que índice y cliente cuentan igual: palabras [\p{L}\p{N}]+ normalizadas, 5-gramas con al menos
// dos palabras con contenido, hash de 48 bits y pertenencia por búsqueda binaria en el arreglo ordenado (que ya
// excluye los 5-gramas públicos, §8.5). Cada racha de palabras cubierta por 5-gramas reservados se cambia por
// «[contenido reservado]». Puro salvo cargarReservado(), que pide el chunk companion-reservado.
import { CARGAR_RESERVADO } from "./generated/particiones";
import { conContenido, decodificarHashes, deBase64, contiene, hash48, palabras as palabrasDe } from "./gramas.mjs";

/** Formato que escribe build-index.mjs para reservado.json (§8.5). */
export const FORMATO_RESERVADO = "arcanum-companion-reservado/1";
/** Lo que reemplaza una racha reservada (§12.7); 21 caracteres. */
export const MARCA_RESERVADA = "[contenido reservado]";

/** La tabla de hashes reservados, lista para la búsqueda binaria. */
export type TablaReservada = ArrayLike<number>;

/** Lo que devuelve un redactor sobre una cadena: el texto (con las rachas reemplazadas) y si cambió algo. */
export type ResultadoRedaccion = { texto: string; cambio: boolean };
/** El redactor que armarSolicitud recibe inyectado (§12.5). `null` = fallar-cerrado: no armar la solicitud. */
export type Redactar = (s: string) => ResultadoRedaccion | null;

/**
 * Carga y valida reservado.json (§9.1, §21): etiqueta `f` y bytes decodificables (múltiplo de 6 y ordenados, lo que
 * comprueba decodificarHashes). Devuelve la tabla ordenada o null si no carga o no valida. El panel usa el null para
 * el fallar-cerrado de §12.7.
 */
export async function cargarReservado(cargar: () => Promise<unknown> = CARGAR_RESERVADO): Promise<TablaReservada | null> {
  let mod: unknown;
  try {
    mod = await cargar();
  } catch {
    return null;
  }
  const json = ((mod as { default?: unknown })?.default ?? mod) as { f?: unknown; h?: unknown } | null;
  if (!json || typeof json !== "object") return null;
  if (json.f !== FORMATO_RESERVADO) return null;
  if (typeof json.h !== "string") return null;
  const bytes = deBase64(json.h);
  if (!bytes) return null;
  const tabla = decodificarHashes(bytes);
  return tabla; // null si el largo no es múltiplo de 6 o no está ordenado
}

/** Un segmento de palabra del texto original: su posición y su forma normalizada. */
interface Segmento {
  inicio: number;
  fin: number;
  normalizada: string;
}

/** Palabras del texto con sus posiciones y su forma normalizada (la misma que usa gramas.mjs para contar). */
function segmentos(s: string): Segmento[] {
  const out: Segmento[] = [];
  const re = /[\p{L}\p{N}]+/gu;
  const normal = palabrasDe(s); // mismas palabras normalizadas, en el mismo orden
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(s)) !== null) {
    out.push({ inicio: m.index, fin: m.index + m[0].length, normalizada: normal[k] ?? "" });
    k++;
  }
  return out;
}

/**
 * Redacta una cadena contra una tabla de hashes reservados: marca las palabras cubiertas por algún 5-grama reservado
 * (con al menos dos palabras con contenido) y reemplaza cada racha de palabras marcadas por «[contenido reservado]»,
 * conservando el texto de alrededor. Pura.
 */
export function redactarTexto(s: string, tabla: TablaReservada): ResultadoRedaccion {
  const segs = segmentos(s);
  if (segs.length < 5) return { texto: s, cambio: false };
  const normal = segs.map((x) => x.normalizada);
  const cubierta = new Array<boolean>(segs.length).fill(false);
  for (let i = 0; i + 5 <= segs.length; i++) {
    const g = normal.slice(i, i + 5);
    if (!conContenido(g)) continue;
    if (contiene(tabla, hash48(g.join(" ")))) for (let j = i; j < i + 5; j++) cubierta[j] = true;
  }
  if (!cubierta.some(Boolean)) return { texto: s, cambio: false };

  // Reconstruye el texto; cada racha maximal de palabras cubiertas (y el texto entre ellas) → una marca.
  let out = "";
  let cursor = 0;
  let i = 0;
  while (i < segs.length) {
    if (!cubierta[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < segs.length && cubierta[j + 1]) j++;
    out += s.slice(cursor, segs[i]!.inicio) + MARCA_RESERVADA;
    cursor = segs[j]!.fin;
    i = j + 1;
  }
  out += s.slice(cursor);
  return { texto: out, cambio: true };
}

/**
 * Crea el redactor que inyecta consultar() en armarSolicitud (§12.5, «Dónde vive la redacción»):
 * - con tabla: la redacción real de §12.7;
 * - sin tabla y con Forge: `() => null`, el fallar-cerrado (no se arma la solicitud);
 * - sin Forge: la identidad `{ texto: s, cambio: false }` (los textos D12 son todos de Forge).
 */
export function crearRedactor(tabla: TablaReservada | null, conForge: boolean): Redactar {
  if (tabla) return (s: string) => redactarTexto(s, tabla);
  if (conForge) return () => null;
  return (s: string) => ({ texto: s, cambio: false });
}
