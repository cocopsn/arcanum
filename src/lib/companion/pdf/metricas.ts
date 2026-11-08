// Anchos de carácter (AFM) de las fuentes estándar del Core 14 de Adobe, para el ajuste de línea del PDF (design §17.2).
// Las tablas son los anchos AFM públicos de Helvetica y Helvetica-Bold, indexados por el código WinAnsi (32-255); los
// huecos de WinAnsi no mapeados y los códigos de control valen 0. Courier es monoespaciada de 600 unidades. Las
// unidades son milésimas de em; el ancho en puntos de una cadena a un tamaño `pt` es Σ(ancho)/1000 × pt.

/** Anchos AFM de Helvetica para los códigos 32..255 (WinAnsi). Índice i del arreglo = código 32 + i. */
// prettier-ignore
const HELVETICA: number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, // 32-47
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, // 48-63
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, // 64-79
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, // 80-95
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, // 96-111
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 0,    // 112-127
  556, 0, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0,     // 128-143
  0, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 0, 500, 667,    // 144-159
  278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333,  // 160-175
  400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611,  // 176-191
  667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, // 192-207
  722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,  // 208-223
  556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278,  // 224-239
  556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500,  // 240-255
];

/** Anchos AFM de Helvetica-Bold para los códigos 32..255 (WinAnsi). */
// prettier-ignore
const HELVETICA_BOLD: number[] = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, // 32-47
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, // 48-63
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, // 64-79
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, // 80-95
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, // 96-111
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 0,   // 112-127
  556, 0, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0,    // 128-143
  0, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 0, 500, 667,   // 144-159
  278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333, // 160-175
  400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611, // 176-191
  722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,// 192-207
  722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, // 208-223
  556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278, // 224-239
  611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556, // 240-255
];

export type FuentePdf = "Helvetica" | "Helvetica-Bold" | "Courier";

const COURIER = 600;

/** Ancho AFM (milésimas de em) de un código WinAnsi en la fuente pedida. */
export function anchoCodigo(fuente: FuentePdf, code: number): number {
  if (fuente === "Courier") return code >= 32 && code <= 255 ? COURIER : 0;
  const tabla = fuente === "Helvetica-Bold" ? HELVETICA_BOLD : HELVETICA;
  if (code < 32 || code > 255) return 0;
  return tabla[code - 32] ?? 0;
}

/** Ancho en puntos de una cadena WinAnsi a un tamaño dado. La cadena ya debe estar en WinAnsi (ver escritor.ts). */
export function anchoCadena(fuente: FuentePdf, s: string, pt: number): number {
  let total = 0;
  for (let i = 0; i < s.length; i++) total += anchoCodigo(fuente, s.charCodeAt(i));
  return (total / 1000) * pt;
}
