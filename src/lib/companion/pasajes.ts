// Texto de los pasajes (design §9.4, §9.5). Arma el texto completo de cada resultado de la búsqueda, sin escribir en
// ninguna base. Los libros de los cinco mundos salen de listBooks() buscando por sha10 (SubtleCrypto) con respaldo por
// título; los bancos usan bloquesBanco(md)[ancla] con comprobación de título, nunca parseExercisesMd. El acceso a Forge
// (libro, banco, ficha) llega inyectado por el adaptador forge.ts (única capa que importa los loaders). Las notas de la
// búsqueda nunca entran a pasajes (§9.5); los documentos de una celda D1-D8 sin evidencia se descartan.
import { parseBook } from "@/lib/book";
import { getBank, listBanks } from "@/lib/exercise-store";
import { listBooks } from "@/lib/book-store";
import { SEED_EXERCISE_MD } from "@/lib/seed-exercises";
import { bloquesBanco } from "./bloques.mjs";
import type { AdaptadorForge } from "./forge";
import type { Resultado } from "./bm25";
import type { PasajeCandidato, TipoPasaje } from "./tipos";

/** sha256[:10] por SubtleCrypto (la misma huella que el generador y los loaders). */
export async function sha10(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 10);
}

/** Lo que pasajes.ts necesita del mundo exterior; todo inyectable para las pruebas. */
export interface DepsPasajes {
  forge: AdaptadorForge;
  listBooks?: typeof listBooks;
  listBanks?: typeof listBanks;
  getBank?: typeof getBank;
  /** evidencia por celda para la guarda de diagnóstico de §9.5 (via forge.diagnosticoVisible) */
  diagnosticoVisible?: (code: string) => boolean;
}

const TEXTO_VERSION_DISTINTA = "versión distinta en este dispositivo";
const TEXTO_LIBRO_NO_DESCARGADO = "Libro no descargado · requiere conexión una vez";

/** El tipo de pasaje según la partición de la que salió el resultado. */
function tipoDe(r: Resultado): TipoPasaje {
  if (r.tipo === "libros") return "libro";
  if (r.tipo === "fichas") return "ficha";
  return "ejercicio";
}

/** La sección de un libro por su ancla (id), o por título si el ancla no aparece. */
function seccionLibro(md: string, ancla: string, etiqueta: string): { seccion: string; texto: string } | null {
  const pb = parseBook(md);
  if (!pb) return null;
  if (ancla === "") {
    const texto = [pb.rootQuestion, pb.lead].filter(Boolean).join("\n").trim();
    return { seccion: "Introducción", texto: `${pb.meta.title}\n${texto}` };
  }
  const s = pb.sections.find((x) => x.id === ancla) ?? pb.sections.find((x) => x.title === etiqueta);
  if (!s) return null;
  return { seccion: s.title, texto: `${s.title}\n${s.markdown}` };
}

/** El texto de un bloque de banco por su ancla (índice), con comprobación de título (§9.4). */
function bloqueBanco(md: string, ancla: string, etiqueta: string): string | null {
  const b = bloquesBanco(md)[Number(ancla)];
  if (!b) return null;
  if (b.titulo !== etiqueta) return null; // versión distinta: el ancla ya no es ese ejercicio
  const partes: string[] = [b.titulo, b.enunciado];
  if (b.tipo === "code" && b.firma) partes.push(...b.firma.map((f) => f.code));
  else if (b.opciones) partes.push(b.opciones.join("\n"));
  return partes.filter(Boolean).join("\n");
}

/** Hidrata un resultado de libro de los cinco mundos (§9.4). */
async function libroCincoMundos(r: Resultado, libros: Awaited<ReturnType<typeof listBooks>>): Promise<{ seccion: string; texto: string }> {
  // sha10 de cada libro local, buscado por igualdad con el del resultado
  for (const row of libros) {
    if ((await sha10(row.md)) === r.sha10) {
      const s = seccionLibro(row.md, r.ancla, r.etiqueta);
      if (s) return s;
    }
  }
  // respaldo por título
  const porTitulo = libros.find((row) => row.title === r.etiqueta || row.title === r.handle);
  if (porTitulo) {
    const s = seccionLibro(porTitulo.md, r.ancla, r.etiqueta);
    if (s) return s;
  }
  return { seccion: r.etiqueta, texto: `${r.etiqueta} — ${TEXTO_VERSION_DISTINTA}` };
}

/**
 * Hidrata un resultado de la búsqueda a un pasaje con texto completo (§9.4). Devuelve null si el documento debe
 * descartarse (diagnóstico sin evidencia, §9.5). Un pasaje sin texto (libro no descargado) vuelve como candidato pero
 * se marca con texto vacío para que no se mande a la IA.
 */
export async function hidratarResultado(r: Resultado, deps: DepsPasajes): Promise<PasajeCandidato | null> {
  const forge = deps.forge;
  const esForge = r.spine === "Engineering Forge";
  const codigo = r.handle;

  // §9.5 punto 1: un documento de una celda D1-D8 sin evidencia se descarta. `diagnosticoVisible` lo inyecta consultar
  // con el readModel real; sin él, se asume visible (la guarda vive en consultar, aquí sólo se aplica si llega).
  if (esForge && /^D[1-8]$/.test(codigo) && deps.diagnosticoVisible && !deps.diagnosticoVisible(codigo)) {
    return null;
  }

  const base = { clave: `${r.particion}#${r.ancla}`, tipo: tipoDe(r), titulo: r.etiqueta, seccion: "", puntaje: r.puntaje, particion: r.particion };

  if (r.tipo === "libros") {
    if (esForge) {
      const md = await forge.libroForgeMd(codigo);
      if (md === null) return { ...base, seccion: r.etiqueta, texto: `${r.etiqueta} — ${TEXTO_LIBRO_NO_DESCARGADO}` };
      const s = seccionLibro(md, r.ancla, r.etiqueta);
      return { ...base, seccion: s?.seccion ?? r.etiqueta, texto: s?.texto ?? "" };
    }
    const libros = await (deps.listBooks ?? listBooks)();
    const s = await libroCincoMundos(r, libros);
    return { ...base, seccion: s.seccion, texto: s.texto };
  }

  if (r.tipo === "bancos") {
    const md = esForge ? await forge.bancoForgeMd(codigo) : await bancoCincoMundosMd(r, deps);
    if (md === null) return { ...base, texto: "" };
    const texto = bloqueBanco(md, r.ancla, r.etiqueta);
    if (texto === null) return { ...base, texto: `${r.etiqueta} — ${TEXTO_VERSION_DISTINTA}` };
    return { ...base, texto };
  }

  // fichas (sólo Forge en esta tarea): la lista blanca de §8.2.
  if (esForge) {
    const slug = r.ruta ?? "";
    const celda = await forge.celdaForge(slug, codigo);
    if (celda) {
      const f = celda.ficha;
      const campos = [
        f.foco,
        f.resultado,
        f.mision,
        f.defensa,
        f.transferencia,
        ...celda.capacidades,
        ...celda.criticas.map((k) => k.texto),
        ...f.fuentes.map((s) => s.etiqueta),
        celda.gate?.pregunta,
        ...(celda.gate?.rubrica ?? []),
      ].filter((x): x is string => typeof x === "string" && x.trim() !== "");
      return { ...base, texto: `${celda.title}\n${campos.join("\n")}` };
    }
  }
  return { ...base, texto: "" };
}

/** Markdown de un banco de los cinco mundos: getBank(handle) o el SEED con ese sha10 (§9.4). */
async function bancoCincoMundosMd(r: Resultado, deps: DepsPasajes): Promise<string | null> {
  const row = await (deps.getBank ?? getBank)(r.handle).catch(() => null);
  if (row && (await sha10(row.md)) === r.sha10) return row.md;
  for (const md of SEED_EXERCISE_MD) if ((await sha10(md)) === r.sha10) return md;
  return row?.md ?? null;
}

/**
 * Hidrata varios resultados y aplica los filtros de §9.5: descarta los de diagnóstico sin evidencia y los que no son
 * notas (las notas de la búsqueda nunca entran a pasajes; llegan por `notas`). Conserva el orden de puntaje.
 */
export async function hidratar(resultados: Resultado[], deps: DepsPasajes): Promise<PasajeCandidato[]> {
  const out: PasajeCandidato[] = [];
  for (const r of resultados) {
    const p = await hidratarResultado(r, deps);
    if (p) out.push(p);
  }
  return out;
}
