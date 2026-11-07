// Tokenizador único del compañero (design §8.3). Lo importan el generador (Node, scripts/companion/build-index.mjs)
// y el cliente (webpack), así que índice y consulta no pueden divergir. Puro: no importa nada.

/** Palabras vacías de español e inglés (las de medir-indice.mjs más 18 de inglés, como prototipo-indice.mjs). */
export const PALABRAS_VACIAS = new Set(
  (
    "de la el en y a los las del que se un una por con para es al lo como su o no mas pero sus le ya este esta si porque cuando muy sin sobre tambien me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mi antes algunos unos yo otro otras otra tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo " +
    "the of and to in is it that for on with as are be this by an or from at which can not was were has have had will would should could its their there these those then than into also"
  ).split(/\s+/),
);

/**
 * Minúsculas, NFD y sin marcas U+0300-U+036F (la ñ queda como n).
 * @param {string} s
 * @returns {string}
 */
export function normalizar(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Limpieza de markdown antes de tokenizar: imágenes y enlaces quedan con su texto; URL y etiquetas se quitan.
 * @param {string} md
 * @returns {string}
 */
export function limpiar(md) {
  return md
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/<[^>]+>/g, " ");
}

/**
 * Raíz ligera: quita una `s` final (token de 4 o más) y después una `e` final (4 o más).
 * @param {string} t
 * @returns {string}
 */
export function raiz(t) {
  let r = t;
  if (r.length >= 4 && r.endsWith("s")) r = r.slice(0, -1);
  if (r.length >= 4 && r.endsWith("e")) r = r.slice(0, -1);
  return r;
}

/**
 * Texto → términos del índice: limpieza, normalización, corte por /[^a-z0-9]+/, tokens de 2 a 30 caracteres que no
 * son palabras vacías ni números de 5 cifras o más, y raíz ligera.
 * @param {string} texto
 * @returns {string[]}
 */
export function tokenizar(texto) {
  /** @type {string[]} */
  const out = [];
  for (const t of normalizar(limpiar(texto)).split(/[^a-z0-9]+/)) {
    if (t.length < 2 || t.length > 30 || PALABRAS_VACIAS.has(t) || /^\d{5,}$/.test(t)) continue;
    out.push(raiz(t));
  }
  return out;
}
