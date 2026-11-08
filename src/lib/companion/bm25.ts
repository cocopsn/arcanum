// BM25 del compañero (design §9.2, §9.6). Puntuación pura sobre particiones ya cargadas por indice.ts: idf y score
// con k1 = 1.2 y b = 0.75, N y avgdl por partición; realces ×1.5 (libro o celda abierta) y ×1.2 (mundo activo) con
// el themeForGoal real de la app; top 8 con empates por nombre de partición y luego por índice de documento. Puro:
// sólo importa el tokenizador compartido y el tema de mundos; no toca el DOM ni la red.
import { tokenizar } from "./tokenizar.mjs";
import { themeForGoal } from "@/lib/subject-themes";
import type { ParticionCargada, DocCargado } from "./indice";

/** Parámetros de BM25 (§9.2). */
export const K1 = 1.2;
export const B = 0.75;
/** Resultados que devuelve una búsqueda (§9.2). */
export const TOP = 8;
/** Mensaje cuando la consulta no tiene términos útiles (§9.2). */
export const SIN_TERMINOS = "Escribe palabras con contenido para buscar";

/** Lo que la búsqueda sabe del contexto para aplicar los realces (§9.2). */
export interface ContextoBusqueda {
  /** sha10 del libro abierto (BookRow de loadResume().bookId), si hay uno */
  libroSha10?: string | null;
  /** código de la celda abierta en Forge, si hay una */
  celdaCodigo?: string | null;
  /** module_id de la celda abierta (cualquier mundo), si lo hay */
  celdaModulo?: string | null;
  /** título del goal activo (mundo activo); con él se compara el slug de cada partición */
  tituloMundo?: string | null;
}

/** Un documento puntuado por la búsqueda. */
export interface Resultado {
  particion: string;
  /** índice del documento dentro de la partición */
  doc: number;
  /** ancla del documento (sección, código de celda o índice de banco) */
  ancla: string;
  etiqueta: string;
  spine: string;
  ruta: string | null;
  tipo: ParticionCargada["tipo"];
  /** archivo fuente (de la tabla `s`) */
  archivo: string;
  /** handle/module_id/código de la fuente */
  handle: string;
  /** sha10 de la fuente */
  sha10: string;
  puntaje: number;
}

/** Términos únicos de una consulta, con la misma tokenización del índice. */
export function terminosConsulta(q: string): string[] {
  return [...new Set(tokenizar(q))];
}

/** idf de Robertson: ln(1 + (N − df + 0.5) / (df + 0.5)) (§9.2). */
export function idf(N: number, df: number): number {
  return Math.log(1 + (N - df + 0.5) / (df + 0.5));
}

/**
 * Realce multiplicativo de un documento (§9.2): ×1.5 si es del libro o de la celda abiertos, ×1.2 si su mundo es el
 * activo. Los dos factores se multiplican entre sí.
 */
export function realce(p: ParticionCargada, d: DocCargado, ctx: ContextoBusqueda): number {
  let f = 1;
  const abierto =
    (!!ctx.libroSha10 && p.tipo === "libros" && d.sha10 === ctx.libroSha10) ||
    (!!ctx.celdaCodigo && (p.tipo === "fichas" || p.tipo === "bancos") && d.handle.toUpperCase() === ctx.celdaCodigo.toUpperCase()) ||
    (!!ctx.celdaModulo && d.handle === ctx.celdaModulo);
  if (abierto) f *= 1.5;
  if (ctx.tituloMundo && mismoMundo(p.spine, ctx.tituloMundo)) f *= 1.2;
  return f;
}

/** Mundo de una partición contra el mundo activo (§9.2): slug de themeForGoal; con «default», igualdad de slug. */
export function mismoMundo(spine: string, tituloMundo: string): boolean {
  const a = themeForGoal(spine).slug;
  const b = themeForGoal(tituloMundo).slug;
  return a === b;
}

/** Puntúa una consulta contra una partición cargada. Devuelve todos los documentos con puntaje > 0. */
export function puntuarParticion(p: ParticionCargada, terminos: string[], ctx: ContextoBusqueda): Resultado[] {
  if (terminos.length === 0) return [];
  const puntajes = new Float64Array(p.N);
  for (const t of terminos) {
    const postings = p.postings(t);
    if (!postings) continue;
    const df = postings.length;
    const w = idf(p.N, df);
    for (const [doc, tf] of postings) {
      const d = p.docs[doc];
      if (!d) continue;
      const dl = d.dl;
      const s = w * (tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * dl) / (p.avgdl || 1)));
      puntajes[doc] = (puntajes[doc] ?? 0) + s;
    }
  }
  const out: Resultado[] = [];
  for (let doc = 0; doc < p.N; doc++) {
    const base = puntajes[doc] ?? 0;
    if (base <= 0) continue;
    const d = p.docs[doc]!;
    out.push({
      particion: p.nombre,
      doc,
      ancla: d.ancla,
      etiqueta: d.etiqueta,
      spine: p.spine,
      ruta: p.ruta,
      tipo: p.tipo,
      archivo: d.archivo,
      handle: d.handle,
      sha10: d.sha10,
      puntaje: base * realce(p, d, ctx),
    });
  }
  return out;
}

/**
 * Los TOP mejores de varias particiones (§9.2): por puntaje descendente; empates por nombre de partición y después
 * por índice de documento, para que el orden sea determinista.
 */
export function buscar(particiones: ParticionCargada[], consulta: string, ctx: ContextoBusqueda = {}): Resultado[] {
  const terminos = terminosConsulta(consulta);
  if (terminos.length === 0) return [];
  const todos: Resultado[] = [];
  for (const p of particiones) todos.push(...puntuarParticion(p, terminos, ctx));
  todos.sort((a, b) => b.puntaje - a.puntaje || cmp(a.particion, b.particion) || a.doc - b.doc);
  return todos.slice(0, TOP);
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
