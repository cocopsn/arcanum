// 5-gramas normalizados y hash de 48 bits del filtro de contenido reservado (design §8.5, §12.7). El generador hace
// reservado.json con este módulo y el cliente redacta con el mismo, así que los dos cuentan igual. Puro: sólo importa
// el tokenizador, que tampoco importa nada.
import { PALABRAS_VACIAS, normalizar } from "./tokenizar.mjs";

/** Bytes de cada hash en la codificación de reservado.json. */
export const BYTES_POR_GRAMA = 6;
const DOS32 = 4294967296;

/**
 * Palabras de un texto: secuencias [\p{L}\p{N}]+ del texto original, cada una normalizada como en §8.3 (sin raíz).
 * @param {string} s
 * @returns {string[]}
 */
export function palabras(s) {
  return (s.match(/[\p{L}\p{N}]+/gu) ?? []).map(normalizar);
}

/**
 * Un 5-grama cuenta si al menos 2 de sus palabras no son vacías.
 * @param {string[]} g
 * @returns {boolean}
 */
export function conContenido(g) {
  let n = 0;
  for (const w of g) if (!PALABRAS_VACIAS.has(w)) n++;
  return n >= 2;
}

/**
 * Los 5-gramas con contenido de una lista de palabras, como cadenas unidas por un espacio, en orden y con su posición.
 * @param {string[]} w
 * @returns {{ i: number, g: string }[]}
 */
export function gramas5(w) {
  /** @type {{ i: number, g: string }[]} */
  const out = [];
  for (let i = 0; i + 5 <= w.length; i++) {
    const g = w.slice(i, i + 5);
    if (conContenido(g)) out.push({ i, g: g.join(" ") });
  }
  return out;
}

/**
 * cyrb53 (dominio público, bryc): hash de 53 bits de una cadena.
 * @param {string} str
 * @param {number} [seed]
 * @returns {{ alto: number, bajo: number }} alto: 21 bits altos; bajo: 32 bits bajos
 */
function cyrb53Partes(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return { alto: h2 & 0x1fffff, bajo: h1 >>> 0 };
}

/**
 * cyrb53 completo (53 bits) como número.
 * @param {string} str
 * @param {number} [seed]
 * @returns {number}
 */
export function cyrb53(str, seed = 0) {
  const { alto, bajo } = cyrb53Partes(str, seed);
  return alto * DOS32 + bajo;
}

/**
 * Los 48 bits bajos de cyrb53 de un 5-grama, como número entero (< 2^48).
 * @param {string} grama
 * @returns {number}
 */
export function hash48(grama) {
  const { alto, bajo } = cyrb53Partes(grama);
  return (alto & 0xffff) * DOS32 + bajo;
}

/**
 * Hashes de 48 bits → bytes: ordenados, sin repetidos, 6 bytes big-endian cada uno.
 * @param {Iterable<number>} hashes
 * @returns {Uint8Array}
 */
export function codificarHashes(hashes) {
  const orden = [...new Set(hashes)].sort((a, b) => a - b);
  const out = new Uint8Array(orden.length * BYTES_POR_GRAMA);
  orden.forEach((h, k) => {
    const alto = Math.floor(h / DOS32);
    const bajo = h % DOS32;
    const o = k * BYTES_POR_GRAMA;
    out[o] = (alto >>> 8) & 0xff;
    out[o + 1] = alto & 0xff;
    out[o + 2] = (bajo >>> 24) & 0xff;
    out[o + 3] = (bajo >>> 16) & 0xff;
    out[o + 4] = (bajo >>> 8) & 0xff;
    out[o + 5] = bajo & 0xff;
  });
  return out;
}

/**
 * Bytes de 6 en 6 → arreglo ordenado de hashes. Devuelve null si el largo no es múltiplo de 6 o no está ordenado.
 * @param {Uint8Array} bytes
 * @returns {Float64Array | null}
 */
export function decodificarHashes(bytes) {
  if (bytes.length % BYTES_POR_GRAMA !== 0) return null;
  const n = bytes.length / BYTES_POR_GRAMA;
  const out = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const o = k * BYTES_POR_GRAMA;
    const alto = ((bytes[o] ?? 0) << 8) | (bytes[o + 1] ?? 0);
    const bajo = (((bytes[o + 2] ?? 0) << 24) >>> 0) + ((bytes[o + 3] ?? 0) << 16) + ((bytes[o + 4] ?? 0) << 8) + (bytes[o + 5] ?? 0);
    out[k] = alto * DOS32 + bajo;
    if (k > 0 && (out[k] ?? 0) <= (out[k - 1] ?? 0)) return null;
  }
  return out;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Bytes → base64 (sin depender de Buffer ni de btoa).
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function aBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    s += B64[(n >>> 18) & 63] + B64[(n >>> 12) & 63] + (b === undefined ? "=" : B64[(n >>> 6) & 63]) + (c === undefined ? "=" : B64[n & 63]);
  }
  return s;
}

/**
 * base64 → bytes. Devuelve null ante un carácter fuera del alfabeto o un largo inválido.
 * @param {string} s
 * @returns {Uint8Array | null}
 */
export function deBase64(s) {
  if (s.length % 4 !== 0) return null;
  const pad = s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0;
  const out = new Uint8Array((s.length / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    let n = 0;
    for (let j = 0; j < 4; j++) {
      const ch = s[i + j] ?? "";
      const v = ch === "=" && i + j >= s.length - pad ? 0 : B64.indexOf(ch);
      if (v < 0) return null;
      n = (n << 6) | v;
    }
    if (o < out.length) out[o++] = (n >>> 16) & 0xff;
    if (o < out.length) out[o++] = (n >>> 8) & 0xff;
    if (o < out.length) out[o++] = n & 0xff;
  }
  return out;
}

/**
 * Pertenencia por búsqueda binaria en un arreglo ordenado de hashes.
 * @param {ArrayLike<number>} tabla
 * @param {number} h
 * @returns {boolean}
 */
export function contiene(tabla, h) {
  let lo = 0;
  let hi = tabla.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const v = tabla[mid] ?? 0;
    if (v === h) return true;
    if (v < h) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}
