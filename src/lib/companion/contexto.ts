// Armado del contexto que viaja a la Edge (design §12.5). armarSolicitud recorta dos veces (antes y después de
// redactar) a los mismos límites, con el redactor inyectado entre las dos pasadas; si el redactor devuelve null en
// alguna cadena, corta y devuelve { ok: false, motivo: "sin-filtro" } (no hay payload parcial). tieneForge y
// esPasajeForge son puras y miran también la conversación entera (§12.5, r3c #4). Puras: no tocan DOM ni red.
import { MANIFIESTO } from "./generated/particiones";
import {
  LIMITES,
  recortar,
  type CompanionContext,
  type EntradaSolicitud,
  type NotaContexto,
  type PasajeCandidato,
  type PasajeContexto,
  type TurnoContexto,
  type Ubicacion,
} from "./tipos";

/** El redactor que armarSolicitud recibe (§12.5): texto redactado y si cambió, o null para fallar-cerrado. */
export type Redactar = (s: string) => { texto: string; cambio: boolean } | null;

/** Particiones del MANIFIESTO cuyo spine es Engineering Forge (§8.5), para esPasajeForge. */
const PARTICIONES_FORGE = new Set<string>(MANIFIESTO.filter((m) => m.spine === "Engineering Forge").map((m) => m.nombre));

/** Un pasaje es de Forge si vino de una partición Forge o es una nota adjuntada de una celda de Forge (§12.5). */
export function esPasajeForge(p: Pick<PasajeCandidato, "particion" | "notaForge">): boolean {
  if (p.particion && PARTICIONES_FORGE.has(p.particion)) return true;
  return p.notaForge === true;
}

/** «Algo de Forge» para cargar reservado.json y redactar (§9.5 punto 3, §12.5). Mira la solicitud y la conversación. */
export function tieneForge(entrada: EntradaSolicitud): boolean {
  if (entrada.mundo === "forge") return true; // 1. mundo activo
  if (entrada.ubicacion.celda?.codigo) return true; // 2. celda de Forge (el código sólo existe en Forge)
  if (entrada.pasajes.some(esPasajeForge)) return true; // 3. algún pasaje de Forge
  const conv = entrada.conversacion;
  if (!conv) return false;
  if (conv.mundo === "forge") return true; // 4. conversación en Forge
  // 5. algún mensaje en Forge, sin mundo válido (fallar-cerrado) o con un pasaje enviado de Forge
  for (const m of conv.mensajes) {
    if (m.mundo === "forge" || m.mundo === undefined) return true;
    if (m.pasajesEnviados.some((pe) => pe.forge)) return true;
  }
  return false;
}

/** trim y corte a `max` con «…» (regla única, §12.5); vacío si queda vacío tras trim. */
function corte(s: string, max: number): string {
  return recortar(s.trim(), max);
}

/** Corte de un pasaje a `max`: en el último fin de oración antes del límite o, si no hay, con «…» (§12.5). */
function corteOracion(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const ventana = t.slice(0, max);
  const fin = Math.max(ventana.lastIndexOf(". "), ventana.lastIndexOf("."), ventana.lastIndexOf("\n"));
  if (fin > 0) return t.slice(0, fin + 1);
  return recortar(t, max);
}

/** Sufijo « [recortado]» de historial (12 caracteres), como s.slice(0, max - 12) + " [recortado]" (§12.5). */
function corteHistorial(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? t.slice(0, max - 12) + " [recortado]" : t;
}

type Resultado = { ok: true; payload: CompanionContext; redacto: boolean } | { ok: false; motivo: "sin-filtro" };

/**
 * Arma y recorta el contexto, redacta entre las dos pasadas y recorta otra vez (§12.5). `limites` existe sólo para el
 * red-check; `redactar` es obligatorio (nadie arma una solicitud sin decidir la redacción).
 */
export function armarSolicitud(entrada: EntradaSolicitud, opciones: { limites?: typeof LIMITES; redactar: Redactar }): Resultado {
  const limites = opciones.limites ?? LIMITES;
  const redactar = opciones.redactar;
  let redacto = false;
  let abortar = false;

  /** Pasa una cadena por redactar (si no está vacía); marca abortar si devuelve null. */
  const red = (s: string): string => {
    if (abortar || s === "") return s;
    const r = redactar(s);
    if (r === null) {
      abortar = true;
      return s;
    }
    if (r.cambio) redacto = true;
    return r.texto;
  };

  // Construye una pasada completa: recorte → redacción → recorte, en orden fijo de campos.
  const armar = (): CompanionContext => {
    const u = entrada.ubicacion;

    // pregunta
    const pregunta = corte(red(corte(entrada.pregunta, limites.pregunta)), limites.pregunta);

    // historial: últimos `max` turnos con estado ok, texto no vacío tras redactar/recortar
    const historial: TurnoContexto[] = [];
    for (const t of entrada.historial) {
      if (t.estado !== "ok") continue;
      const texto = corteHistorial(red(corteHistorial(t.texto, limites.historial.texto)), limites.historial.texto);
      if (texto.trim() === "") continue;
      historial.push({ rol: t.rol, texto });
    }
    const historialFinal = historial.slice(-limites.historial.max);

    // pasajes: en orden de puntaje; título/texto no vacíos
    const pasajes: PasajeContexto[] = [];
    for (const [i, p] of entrada.pasajes.entries()) {
      const titulo = corte(red(corte(p.titulo, limites.pasajes.titulo)), limites.pasajes.titulo);
      const seccion = corte(red(corte(p.seccion, limites.pasajes.seccion)), limites.pasajes.seccion);
      const texto = corteOracion(red(corteOracion(p.texto, limites.pasajes.texto)), limites.pasajes.texto);
      if (titulo === "" || texto === "") continue;
      pasajes.push({ id: `P${i + 1}`, tipo: p.tipo, titulo, seccion, texto });
    }
    const pasajesFinal = pasajes.slice(0, limites.pasajes.max).map((p, i) => ({ ...p, id: `P${i + 1}` }));

    // notas: texto no vacío
    const notas: NotaContexto[] = [];
    for (const nt of entrada.notas) {
      const titulo = corte(red(corte(nt.titulo, limites.notas.titulo)), limites.notas.titulo);
      const texto = corte(red(corte(nt.texto.replace(/\s+/g, " "), limites.notas.texto)), limites.notas.texto);
      if (texto === "") continue;
      notas.push({ titulo, texto });
    }

    const ubicacion = armarUbicacionRecortada(u, limites, red);
    return { pregunta, pedido: entrada.pedido, nivelPista: entrada.nivelPista, lenguaje: entrada.lenguaje, historial: historialFinal, pasajes: pasajesFinal, notas: notas.slice(0, limites.notas.max), ubicacion };
  };

  const payload = armar();
  if (abortar) return { ok: false, motivo: "sin-filtro" };

  // 60,000: si se pasa, quita pasajes desde el de menor puntaje hasta cumplir (§12.5).
  while (JSON.stringify(payload).length > limites.contexto && payload.pasajes.length > 0) {
    payload.pasajes.pop();
    payload.pasajes.forEach((p, i) => (p.id = `P${i + 1}`));
  }

  return { ok: true, payload, redacto };
}

/** Recorta y redacta la ubicación con sus límites y omisiones (§12.5). */
function armarUbicacionRecortada(u: Ubicacion, limites: typeof LIMITES, red: (s: string) => string): Ubicacion {
  const L = limites.ubicacion;
  const mundo = corte(red(corte(u.mundo, L.mundo)), L.mundo) || "Inicio";
  const out: Ubicacion = {
    mundo,
    superficie: u.superficie,
    fase: u.fase,
    faseFuente: u.faseFuente,
    modosFalla: u.modosFalla.slice(0, L.modosFalla),
    brechas: u.brechas.map((b) => corte(red(corte(b, L.brechas.texto)), L.brechas.texto)).filter((b) => b !== "").slice(0, L.brechas.max),
    repasos: u.repasos.map((r) => corte(red(corte(r, L.repasos.texto)), L.repasos.texto)).filter((r) => r !== "").slice(0, L.repasos.max),
    tiposSugeridos: [...new Set(u.tiposSugeridos)].slice(0, L.tiposSugeridos),
  };

  if (u.celda) {
    const titulo = corte(red(corte(u.celda.titulo, L.celdaTitulo)), L.celdaTitulo);
    if (titulo !== "") out.celda = { ...u.celda, titulo };
  }
  if (u.libro) {
    const titulo = corte(red(corte(u.libro.titulo, L.libroTitulo)), L.libroTitulo);
    const seccion = u.libro.seccion !== undefined ? corte(red(corte(u.libro.seccion, L.libroSeccion)), L.libroSeccion) : undefined;
    if (titulo !== "") out.libro = seccion ? { titulo, seccion } : { titulo };
  }
  if (u.ejercicio) {
    const titulo = corte(red(corte(u.ejercicio.titulo, L.ejercicioTitulo)), L.ejercicioTitulo);
    if (titulo !== "") out.ejercicio = { titulo, tipo: u.ejercicio.tipo };
  }
  if (u.remediacion) {
    const diagnostico = corte(red(corte(u.remediacion.diagnostico, L.diagnostico)), L.diagnostico);
    const intervencion = corte(red(corte(u.remediacion.intervencion, L.intervencion)), L.intervencion);
    if (diagnostico !== "" && intervencion !== "") out.remediacion = { modo: u.remediacion.modo, diagnostico, intervencion };
  }
  if (u.ultimoVeredicto) {
    const resumen = corte(red(corte(u.ultimoVeredicto.resumen, L.resumen)), L.resumen);
    out.ultimoVeredicto = { aprobado: u.ultimoVeredicto.aprobado, resumen };
  }
  if (u.practicaGenerada) out.practicaGenerada = u.practicaGenerada;
  return out;
}
