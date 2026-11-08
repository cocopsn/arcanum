// Aplana markdown en bloques para el PDF (design §17.2). Sin HTML ni anotaciones de enlace: un enlace https: queda como
// «texto (url)»; las marcas en línea (**, *, `, ~~) se quitan. No interpreta nada del modelo como HTML. Puro.

export type BloquePdf =
  | { tipo: "titulo"; nivel: 1 | 2 | 3; texto: string }
  | { tipo: "parrafo"; texto: string }
  | { tipo: "vineta"; texto: string }
  | { tipo: "numerada"; indice: number; texto: string }
  | { tipo: "cita"; texto: string }
  | { tipo: "codigo"; lineas: string[] }
  | { tipo: "tabla"; filas: string[][] };

/** Quita las marcas en línea de markdown y convierte `[texto](https://url)` en «texto (url)». Nunca deja HTML. */
export function enLinea(s: string): string {
  let t = s;
  // enlaces: sólo https: como «texto (url)»; otros esquemas pierden la url
  t = t.replace(/\[([^\]]*)\]\((https:\/\/[^\s)]+)\)/g, (_m, txt: string, url: string) => `${txt} (${url})`);
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, (_m, txt: string) => txt);
  // imágenes: «[imagen: alt]»
  t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, (_m, alt: string) => `[imagen: ${alt}]`);
  // código, negrita, cursiva, tachado
  t = t.replace(/`([^`]*)`/g, "$1");
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1");
  t = t.replace(/\*([^*]+)\*/g, "$1").replace(/_([^_]+)_/g, "$1");
  t = t.replace(/~~([^~]+)~~/g, "$1");
  return t.trim();
}

function filaTabla(linea: string): string[] {
  return linea
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => enLinea(c.trim()));
}

const SEP_TABLA = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** Convierte un markdown en una lista de bloques (§17.2). */
export function aplanarMarkdown(md: string): BloquePdf[] {
  const lineas = md.replace(/\r\n/g, "\n").split("\n");
  const bloques: BloquePdf[] = [];
  let i = 0;
  let parrafo: string[] = [];
  const cerrarParrafo = () => {
    if (parrafo.length) {
      bloques.push({ tipo: "parrafo", texto: enLinea(parrafo.join(" ")) });
      parrafo = [];
    }
  };

  while (i < lineas.length) {
    const linea = lineas[i]!;
    const cerca = linea.match(/^\s*(```|~~~)/);
    if (cerca) {
      cerrarParrafo();
      const codigo: string[] = [];
      i++;
      while (i < lineas.length && !/^\s*(```|~~~)/.test(lineas[i]!)) {
        codigo.push(lineas[i]!);
        i++;
      }
      i++; // cerca de cierre
      bloques.push({ tipo: "codigo", lineas: codigo });
      continue;
    }
    const titulo = linea.match(/^(#{1,3})\s+(.*)$/);
    if (titulo) {
      cerrarParrafo();
      bloques.push({ tipo: "titulo", nivel: titulo[1]!.length as 1 | 2 | 3, texto: enLinea(titulo[2]!) });
      i++;
      continue;
    }
    const vineta = linea.match(/^\s*[-*+]\s+(.*)$/);
    if (vineta) {
      cerrarParrafo();
      bloques.push({ tipo: "vineta", texto: enLinea(vineta[1]!) });
      i++;
      continue;
    }
    const num = linea.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (num) {
      cerrarParrafo();
      bloques.push({ tipo: "numerada", indice: Number(num[1]), texto: enLinea(num[2]!) });
      i++;
      continue;
    }
    const cita = linea.match(/^\s*>\s?(.*)$/);
    if (cita) {
      cerrarParrafo();
      bloques.push({ tipo: "cita", texto: enLinea(cita[1]!) });
      i++;
      continue;
    }
    // tabla GFM: una fila con | seguida de una fila separadora
    if (/\|/.test(linea) && i + 1 < lineas.length && SEP_TABLA.test(lineas[i + 1]!)) {
      cerrarParrafo();
      const filas: string[][] = [filaTabla(linea)];
      i += 2; // encabezado y separador
      while (i < lineas.length && /\|/.test(lineas[i]!) && lineas[i]!.trim() !== "") {
        filas.push(filaTabla(lineas[i]!));
        i++;
      }
      bloques.push({ tipo: "tabla", filas });
      continue;
    }
    if (linea.trim() === "") {
      cerrarParrafo();
      i++;
      continue;
    }
    parrafo.push(linea.trim());
    i++;
  }
  cerrarParrafo();
  return bloques;
}
