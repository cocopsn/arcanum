// Escritor de PDF propio (design §17.1, §17.2, DC-08). PDF 1.4 en carta, fuentes estándar Helvetica, Helvetica-Bold y
// Courier (no se incrustan), WinAnsi, flujos sin comprimir. Puro y determinista (la fecha se inyecta), verificable en
// Node. NUNCA emite acciones: sin /JS, /JavaScript, /OpenAction, /Launch, /AA, /AcroForm, /EmbeddedFile ni /URI
// (RF-F2). Cada diagrama es un XObject de formulario dibujado con operadores vectoriales desde el mismo modelo de §16.3.
// `accionesPdf(bytes)` detecta esas claves prohibidas para el red-check de §17.4.
import { aplanarMarkdown, type BloquePdf } from "./aplanar";
import { anchoCadena, type FuentePdf } from "./metricas";
import type { ModeloDiagrama, CajaDibujo } from "../diagrama/layout";

const ANCHO_PAGINA = 612;
const ALTO_PAGINA = 792;
const MARGEN = 54;
const ANCHO_UTIL = ANCHO_PAGINA - 2 * MARGEN;
const CUERPO_PT = 10.5;
const CUERPO_INTER = CUERPO_PT * 1.35;
const TITULO_PT = 13;
const CODIGO_PT = 9;
const CODIGO_INTER = CODIGO_PT * 1.3;
const PIE_PT = 8;

/** Una respuesta a exportar: texto markdown, sus diagramas y sus citas. */
export interface RespuestaPdf {
  /** turno del aprendiz, si se incluye (conversación entera) */
  pregunta?: string;
  /** markdown de la respuesta (o enunciado del ejercicio) */
  markdown: string;
  diagramas: ModeloDiagrama[];
  /** «Fuente: <título> · <sección>» */
  citas: { titulo: string; seccion: string }[];
}

export interface OpcionesPdf {
  titulo: string;
  /** fecha inyectada para que la salida sea determinista (DD/MM/AAAA se arma de aquí) */
  fecha: Date;
}

// --- WinAnsi: mapa de los puntos de código Unicode > 127 que WinAnsi representa (los usados en español y símbolos) ---
const WINANSI: Record<number, number> = {
  0x20ac: 128, 0x201a: 130, 0x0192: 131, 0x201e: 132, 0x2026: 133, 0x2020: 134, 0x2021: 135, 0x02c6: 136, 0x2030: 137,
  0x0160: 138, 0x2039: 139, 0x0152: 140, 0x017d: 142, 0x2018: 145, 0x2019: 146, 0x201c: 147, 0x201d: 148, 0x2022: 149,
  0x2013: 150, 0x2014: 151, 0x02dc: 152, 0x2122: 153, 0x0161: 154, 0x203a: 155, 0x0153: 156, 0x017e: 158, 0x0178: 159,
};

/** Sustituciones ASCII para símbolos fuera de WinAnsi (RF-F3). */
const SUSTITUTOS: Record<string, string> = { "→": "->", "≤": "<=", "≥": ">=", "≠": "!=" };

interface AWinAnsi {
  texto: string;
  sustituido: boolean;
}

/** Pasa una cadena Unicode a WinAnsi (como códigos 0-255), sustituyendo lo que no cabe (RF-F3). Devuelve también si
 *  hubo alguna sustitución, para el aviso de la primera página. */
function aWinAnsi(s: string): AWinAnsi {
  let out = "";
  let sustituido = false;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp <= 0xff && !(cp >= 0x80 && cp <= 0x9f)) {
      out += String.fromCharCode(cp);
      continue;
    }
    if (WINANSI[cp] !== undefined) {
      out += String.fromCharCode(WINANSI[cp]!);
      continue;
    }
    if (SUSTITUTOS[ch] !== undefined) {
      out += SUSTITUTOS[ch]!;
      sustituido = true;
      continue;
    }
    out += "?";
    sustituido = true;
  }
  return { texto: out, sustituido };
}

/** Escapa una cadena WinAnsi como literal PDF `( … )`: `\`, `(`, `)` y todo byte fuera de 32-126 como \ddd octal. */
function literalPdf(winansi: string): string {
  let out = "";
  for (let i = 0; i < winansi.length; i++) {
    const c = winansi.charCodeAt(i);
    if (c === 0x5c) out += "\\\\";
    else if (c === 0x28) out += "\\(";
    else if (c === 0x29) out += "\\)";
    else if (c >= 32 && c <= 126) out += winansi[i];
    else out += "\\" + c.toString(8).padStart(3, "0");
  }
  return out;
}

const FUENTE_RECURSO: Record<FuentePdf, string> = { Helvetica: "F1", "Helvetica-Bold": "F2", Courier: "F3" };

/** Parte una cadena WinAnsi en líneas que caben en `ancho` puntos a la fuente/tamaño dados. */
function envolver(fuente: FuentePdf, s: string, pt: number, ancho: number): string[] {
  const palabras = s.split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [""];
  const lineas: string[] = [];
  let actual = "";
  for (const p of palabras) {
    const tent = actual ? actual + " " + p : p;
    if (anchoCadena(fuente, tent, pt) > ancho && actual) {
      lineas.push(actual);
      actual = p;
    } else {
      actual = tent;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

// Operadores de texto de una página en construcción.
interface Pagina {
  ops: string[];
  xobjs: string[]; // nombres de XObject usados en esta página (Do)
}

class Documento {
  private paginas: Pagina[] = [];
  private pagina: Pagina;
  private y = ALTO_PAGINA - MARGEN;
  private formXObjects: { nombre: string; cuerpo: string; w: number; h: number }[] = [];
  private sustitucionAvisada = false;

  constructor(private opciones: OpcionesPdf) {
    this.pagina = { ops: [], xobjs: [] };
    this.paginas.push(this.pagina);
  }

  private nuevaPagina() {
    this.pagina = { ops: [], xobjs: [] };
    this.paginas.push(this.pagina);
    this.y = ALTO_PAGINA - MARGEN;
  }

  private asegurar(alto: number) {
    if (this.y - alto < MARGEN + 24) this.nuevaPagina();
  }

  private texto(fuente: FuentePdf, pt: number, x: number, s: string) {
    const { texto } = aWinAnsi(s);
    this.pagina.ops.push(`BT /${FUENTE_RECURSO[fuente]} ${pt} Tf 1 0 0 1 ${x.toFixed(2)} ${this.y.toFixed(2)} Tm (${literalPdf(texto)}) Tj ET`);
  }

  private parrafo(fuente: FuentePdf, pt: number, inter: number, s: string, sangria = 0) {
    const w = aWinAnsi(s);
    if (w.sustituido) this.sustitucionAvisada = true;
    const ancho = ANCHO_UTIL - sangria;
    const lineas = envolver(fuente, w.texto, pt, ancho);
    for (const l of lineas) {
      this.asegurar(inter);
      this.pagina.ops.push(`BT /${FUENTE_RECURSO[fuente]} ${pt} Tf 1 0 0 1 ${(MARGEN + sangria).toFixed(2)} ${this.y.toFixed(2)} Tm (${literalPdf(l)}) Tj ET`);
      this.y -= inter;
    }
  }

  private espacio(n = CUERPO_INTER * 0.4) {
    this.y -= n;
  }

  bloque(b: BloquePdf) {
    switch (b.tipo) {
      case "titulo":
        this.espacio(CUERPO_INTER * 0.5);
        this.parrafo("Helvetica-Bold", TITULO_PT - (b.nivel - 1), TITULO_PT * 1.3, b.texto);
        this.espacio(CUERPO_INTER * 0.2);
        break;
      case "parrafo":
        this.parrafo("Helvetica", CUERPO_PT, CUERPO_INTER, b.texto);
        this.espacio();
        break;
      case "vineta":
        this.parrafo("Helvetica", CUERPO_PT, CUERPO_INTER, "•  " + b.texto, 10);
        break;
      case "numerada":
        this.parrafo("Helvetica", CUERPO_PT, CUERPO_INTER, `${b.indice}.  ${b.texto}`, 10);
        break;
      case "cita":
        this.parrafo("Helvetica", CUERPO_PT, CUERPO_INTER, b.texto, 18);
        break;
      case "codigo":
        this.espacio(CUERPO_INTER * 0.2);
        for (const l of b.lineas) {
          this.asegurar(CODIGO_INTER);
          const w = aWinAnsi(l.replace(/\t/g, "  "));
          if (w.sustituido) this.sustitucionAvisada = true;
          // recorta el código al ancho útil sin envolver palabras (monoespaciada)
          let linea = w.texto;
          while (anchoCadena("Courier", linea, CODIGO_PT) > ANCHO_UTIL - 12 && linea.length > 1) linea = linea.slice(0, -1);
          this.pagina.ops.push(`BT /${FUENTE_RECURSO.Courier} ${CODIGO_PT} Tf 1 0 0 1 ${(MARGEN + 6).toFixed(2)} ${this.y.toFixed(2)} Tm (${literalPdf(linea)}) Tj ET`);
          this.y -= CODIGO_INTER;
        }
        this.espacio();
        break;
      case "tabla":
        for (const fila of b.filas) this.parrafo("Courier", CODIGO_PT, CODIGO_INTER, fila.join("  |  "));
        this.espacio();
        break;
    }
  }

  diagrama(modelo: ModeloDiagrama) {
    const escala = Math.min(1, ANCHO_UTIL / Math.max(modelo.ancho, 1));
    const altoEscalado = Math.max(modelo.alto, 1) * escala;
    this.asegurar(altoEscalado + 12);
    const nombre = `Dg${this.formXObjects.length + 1}`;
    const cuerpo = cuerpoDiagrama(modelo);
    this.formXObjects.push({ nombre, cuerpo, w: Math.max(modelo.ancho, 1), h: Math.max(modelo.alto, 1) });
    // coloca el XObject: el BBox del form tiene origen abajo-izquierda del tamaño del modelo; lo escalamos y trasladamos
    const ty = this.y - altoEscalado;
    this.pagina.xobjs.push(nombre);
    this.pagina.ops.push(`q ${escala.toFixed(4)} 0 0 ${escala.toFixed(4)} ${MARGEN.toFixed(2)} ${ty.toFixed(2)} cm /${nombre} Do Q`);
    this.y = ty - 12;
  }

  respuesta(r: RespuestaPdf) {
    if (r.pregunta) {
      this.parrafo("Helvetica-Bold", CUERPO_PT, CUERPO_INTER, "Tú: " + r.pregunta);
      this.espacio();
    }
    for (const b of aplanarMarkdown(r.markdown)) this.bloque(b);
    for (const d of r.diagramas) this.diagrama(d);
    for (const c of r.citas) this.parrafo("Helvetica", CUERPO_PT, CUERPO_INTER, `Fuente: ${c.titulo} · ${c.seccion}`);
    this.espacio(CUERPO_INTER);
  }

  /** Serializa el documento a bytes de PDF 1.4 con xref exacta. */
  serializar(): Uint8Array {
    const total = this.paginas.length;
    const fecha = `${String(this.opciones.fecha.getDate()).padStart(2, "0")}/${String(this.opciones.fecha.getMonth() + 1).padStart(2, "0")}/${this.opciones.fecha.getFullYear()}`;
    // pie «Generado por IA · borrador · Arcanum», fecha y «página N de M» en cada página
    const paginasOps = this.paginas.map((p, i) => {
      const pieTexto = `Generado por IA · borrador · Arcanum   ${fecha}   página ${i + 1} de ${total}`;
      const { texto } = aWinAnsi(pieTexto);
      let extra = `BT /F1 ${PIE_PT} Tf 1 0 0 1 ${MARGEN} ${(MARGEN - 18).toFixed(2)} Tm (${literalPdf(texto)}) Tj ET`;
      if (i === 0 && this.sustitucionAvisada) {
        const av = aWinAnsi("Algunos símbolos se sustituyeron").texto;
        extra += `\nBT /F1 ${PIE_PT} Tf 1 0 0 1 ${MARGEN} ${(ALTO_PAGINA - MARGEN + 8).toFixed(2)} Tm (${literalPdf(av)}) Tj ET`;
      }
      return p.ops.join("\n") + "\n" + extra;
    });

    // numeración de objetos:
    // 1 Catalog, 2 Pages, 3 F1, 4 F2, 5 F3, luego por cada form XObject, luego por cada página su content y su page obj.
    const objetos: string[] = [];
    const push = (s: string) => objetos.push(s);
    const idForm = (i: number) => 6 + i; // forms empiezan en 6
    const baseTrasForms = 6 + this.formXObjects.length;

    push("<< /Type /Catalog /Pages 2 0 R >>"); // 1
    // 2: Pages (hijos conocidos después)
    const kids: number[] = [];
    for (let i = 0; i < total; i++) kids.push(baseTrasForms + i * 2 + 1); // page objects
    push(`<< /Type /Pages /Count ${total} /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] >>`); // 2
    push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"); // 3
    push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"); // 4
    push("<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>"); // 5
    // forms
    this.formXObjects.forEach((f) => {
      const stream = f.cuerpo;
      push(
        `<< /Type /XObject /Subtype /Form /FormType 1 /BBox [0 0 ${f.w.toFixed(2)} ${f.h.toFixed(2)}] /Resources << /Font << /F1 3 0 R >> >> /Length ${byteLen(stream)} >>\nstream\n${stream}\nendstream`,
      );
    });
    // páginas: por cada una, un content stream y un page object
    const fuentes = "/Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >>";
    paginasOps.forEach((ops, i) => {
      push(`<< /Length ${byteLen(ops)} >>\nstream\n${ops}\nendstream`); // content
      const contentNum = baseTrasForms + i * 2; // número de este objeto (índice 1-based abajo)
      const usados = this.paginas[i]!.xobjs;
      const refs = usados.map((nombre) => `/${nombre} ${idForm(this.formXObjects.findIndex((f) => f.nombre === nombre))} 0 R`);
      const xobjRes = refs.length ? ` /XObject << ${refs.join(" ")} >>` : "";
      push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO_PAGINA} ${ALTO_PAGINA}] /Resources << ${fuentes}${xobjRes} >> /Contents ${contentNum} 0 R >>`);
    });

    // metadatos: objeto Info al final
    const infoNum = objetos.length + 1;
    push(`<< /Producer (${literalPdf(aWinAnsi("Arcanum companero cmp-pdf-v1").texto)}) /Title (${literalPdf(aWinAnsi(this.opciones.titulo).texto)}) >>`);

    // ensamblado con desplazamientos exactos
    let pdf = "%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n";
    const offsets: number[] = [];
    for (let n = 0; n < objetos.length; n++) {
      offsets.push(byteLen(pdf));
      pdf += `${n + 1} 0 obj\n${objetos[n]}\nendobj\n`;
    }
    const xrefPos = byteLen(pdf);
    const count = objetos.length + 1;
    let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
    for (const off of offsets) xref += `${String(off).padStart(10, "0")} 00000 n \n`;
    pdf += xref;
    pdf += `trailer\n<< /Size ${count} /Root 1 0 R /Info ${infoNum} 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
    return bytesDe(pdf);
  }
}

// longitud en bytes (UTF-8) de una cadena; el contenido real son códigos 0-255 escritos como latin1
function byteLen(s: string): number {
  return bytesDe(s).length;
}
function bytesDe(s: string): Uint8Array {
  // escribimos cada unidad de código como un byte (latin1); el contenido ya está en 0-255
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

/** Operadores vectoriales de un diagrama para un XObject de formulario. El form usa coordenadas con Y hacia arriba; el
 *  modelo tiene Y hacia abajo, así que invertimos (y' = alto - y). Sólo líneas, rectángulos y texto Helvetica. */
function cuerpoDiagrama(m: ModeloDiagrama): string {
  const H = Math.max(m.alto, 1);
  const inv = (y: number) => H - y;
  const ops: string[] = ["0.3 w"];
  const rect = (x: number, y: number, w: number, h: number) => ops.push(`${x.toFixed(2)} ${inv(y + h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
  const linea = (x1: number, y1: number, x2: number, y2: number) => ops.push(`${x1.toFixed(2)} ${inv(y1).toFixed(2)} m ${x2.toFixed(2)} ${inv(y2).toFixed(2)} l S`);
  const texto = (lineas: string[], cx: number, cy: number) => {
    const y0 = cy - (lineas.length * 12) / 2 + 9;
    lineas.forEach((l, i) => {
      const w = aWinAnsi(l).texto;
      const anchoTexto = anchoCadena("Helvetica", w, 9);
      ops.push(`BT /F1 9 Tf 1 0 0 1 ${(cx - anchoTexto / 2).toFixed(2)} ${inv(y0 + i * 12).toFixed(2)} Tm (${literalPdf(w)}) Tj ET`);
    });
  };
  for (const sg of m.subgrafos) rect(sg.x, sg.y, sg.ancho, sg.alto);
  for (const lv of m.lineasVida) {
    linea(lv.x, lv.y1, lv.x, lv.y2);
    texto([lv.etiqueta], lv.ex, lv.y1 - 6);
  }
  for (const a of m.aristas) {
    for (let i = 1; i < a.puntos.length; i++) linea(a.puntos[i - 1]!.x, a.puntos[i - 1]!.y, a.puntos[i]!.x, a.puntos[i]!.y);
    if (a.etiqueta && a.etiquetaPos) texto([a.etiqueta], a.etiquetaPos.x, a.etiquetaPos.y);
  }
  for (const n of m.nodos) dibujarNodo(ops, n, inv, texto, rect);
  for (const nota of m.notas) {
    rect(nota.x, nota.y, nota.ancho, nota.alto);
    texto(nota.texto, nota.x + nota.ancho / 2, nota.y + nota.alto / 2);
  }
  return ops.join("\n");
}

function dibujarNodo(
  ops: string[],
  n: CajaDibujo,
  inv: (y: number) => number,
  texto: (l: string[], cx: number, cy: number) => void,
  rect: (x: number, y: number, w: number, h: number) => void,
) {
  const { x, y, ancho: w, alto: h } = n;
  if (n.forma === "rombo") {
    ops.push(
      `${(x + w / 2).toFixed(2)} ${inv(y).toFixed(2)} m ${(x + w).toFixed(2)} ${inv(y + h / 2).toFixed(2)} l ${(x + w / 2).toFixed(2)} ${inv(y + h).toFixed(2)} l ${x.toFixed(2)} ${inv(y + h / 2).toFixed(2)} l s`,
    );
  } else {
    rect(x, y, w, h);
  }
  texto(n.texto, x + w / 2, y + h / 2);
}

/**
 * Genera el PDF de una o varias respuestas (§17.3). Sin red, puro.
 */
export function generarPdf(respuestas: RespuestaPdf[], opciones: OpcionesPdf): Uint8Array {
  const doc = new Documento(opciones);
  for (const r of respuestas) doc.respuesta(r);
  return doc.serializar();
}

/** Claves de acción prohibidas en un PDF (§17.2, RF-F2). */
const CLAVES_ACCION = ["/JS", "/JavaScript", "/OpenAction", "/Launch", "/AA", "/AcroForm", "/EmbeddedFile", "/URI"];

/** Devuelve las claves de acción presentes en los bytes del PDF (como nombres PDF, seguidas de un delimitador). `[]`
 *  si no hay ninguna (§17.4). */
export function accionesPdf(bytes: Uint8Array): string[] {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  const halladas: string[] = [];
  for (const clave of CLAVES_ACCION) {
    const re = new RegExp(clave.replace(/[/$]/g, "\\$&") + "(?=[\\s/<>\\[\\](])");
    if (re.test(s)) halladas.push(clave);
  }
  return halladas;
}
