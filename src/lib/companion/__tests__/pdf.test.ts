// Escritor de PDF propio (design §17, CA-29). Comprueba: %PDF-1.4; startxref apunta a xref y cada desplazamiento a
// «N 0 obj»; un extractor des-escapa las cadenas literales y mapea WinAnsi a Unicode y encuentra el texto con acentos,
// los títulos de las citas y «Generado por IA»; hay un /Subtype /Form por diagrama; y accionesPdf da [] con enlaces
// https: y javascript:. Red-check: los mismos bytes con /OpenAction y con /URI insertados → las dos acciones.
import { describe, it, expect } from "vitest";
import { generarPdf, accionesPdf, type RespuestaPdf } from "@/lib/companion/pdf/escritor";
import { parsearDiagrama } from "@/lib/companion/diagrama/parser";
import { disponerDiagrama } from "@/lib/companion/diagrama/layout";

const FECHA = new Date(2026, 10, 8, 9, 30); // determinista

// Mapa inverso de WinAnsi (los puntos que usamos en el escritor) para el extractor.
const WINANSI_INV: Record<number, number> = {
  128: 0x20ac, 130: 0x201a, 131: 0x0192, 132: 0x201e, 133: 0x2026, 145: 0x2018, 146: 0x2019, 147: 0x201c, 148: 0x201d,
  149: 0x2022, 150: 0x2013, 151: 0x2014, 153: 0x2122,
};

function bytesAString(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]!);
  return s;
}

/** Extrae el texto de todos los literales `( … )` de los flujos, des-escapando `\ddd` octal y `\(` `\)` `\\`, y
 *  mapeando WinAnsi (128-159) a Unicode. Devuelve el texto concatenado. */
function extraerTexto(b: Uint8Array): string {
  const raw = bytesAString(b);
  let out = "";
  const re = /\(((?:\\.|[^\\()])*)\)\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const lit = m[1]!;
    let i = 0;
    while (i < lit.length) {
      if (lit[i] === "\\") {
        const next = lit[i + 1]!;
        if (/[0-7]/.test(next)) {
          let oct = "";
          i++;
          while (oct.length < 3 && /[0-7]/.test(lit[i] ?? "")) {
            oct += lit[i];
            i++;
          }
          const code = parseInt(oct, 8);
          out += String.fromCodePoint(WINANSI_INV[code] ?? code);
        } else {
          out += next;
          i += 2;
        }
      } else {
        out += lit[i];
        i++;
      }
    }
    out += "\n";
  }
  return out;
}

const respuestaBase: RespuestaPdf = {
  markdown: "# Resumen\n\nEsto explica la **remediación** por ambigüedad y la verificación.\n\n- primer punto\n- segundo punto\n\nUn enlace [docs](https://www.palantir.com/docs/x) y uno [malo](javascript:alert(1)).",
  diagramas: [],
  citas: [{ titulo: "Two Pointers", seccion: "Ventana deslizante" }],
};

describe("escritor de PDF (§17, CA-29)", () => {
  it("empieza con %PDF-1.4 y startxref apunta a la tabla xref", () => {
    const bytes = generarPdf([respuestaBase], { titulo: "Respuesta", fecha: FECHA });
    const s = bytesAString(bytes);
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    const mStart = s.match(/startxref\s+(\d+)/);
    expect(mStart).not.toBeNull();
    const pos = Number(mStart![1]);
    expect(s.slice(pos, pos + 4)).toBe("xref");
    // cada desplazamiento (salvo el 0) apunta a «N 0 obj»
    const tabla = s.slice(pos);
    const offsets = [...tabla.matchAll(/^(\d{10}) 00000 n /gm)].map((x) => Number(x[1]));
    expect(offsets.length).toBeGreaterThan(0);
    offsets.forEach((off, i) => {
      expect(s.slice(off, off + 32)).toMatch(new RegExp(`^${i + 1} 0 obj`));
    });
  });

  it("el extractor encuentra el texto con acentos, la cita y «Generado por IA»", () => {
    const bytes = generarPdf([respuestaBase], { titulo: "Respuesta", fecha: FECHA });
    const texto = extraerTexto(bytes);
    expect(texto).toContain("remediación");
    expect(texto).toContain("ambigüedad");
    expect(texto).toContain("Fuente: Two Pointers · Ventana deslizante");
    expect(texto).toContain("Generado por IA");
    // el enlace https: quedó como «texto (url)» y el javascript: perdió la url
    expect(texto).toContain("docs (https://www.palantir.com/docs/x)");
    expect(texto).not.toContain("javascript:");
  });

  it("hay un /Subtype /Form por diagrama", () => {
    const r1 = parsearDiagrama("flowchart TD\n  A[Inicio] --> B[Fin]");
    const r2 = parsearDiagrama("sequenceDiagram\n  participant A\n  participant B\n  A->>B: hola");
    expect(r1.ok && r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    const resp: RespuestaPdf = { ...respuestaBase, diagramas: [disponerDiagrama(r1.ast), disponerDiagrama(r2.ast)] };
    const bytes = generarPdf([resp], { titulo: "Con diagramas", fecha: FECHA });
    const s = bytesAString(bytes);
    const forms = [...s.matchAll(/\/Subtype\s*\/Form/g)].length;
    expect(forms).toBe(2);
  });

  it("accionesPdf da [] con una respuesta que trae enlaces https: y javascript:", () => {
    const bytes = generarPdf([respuestaBase], { titulo: "Respuesta", fecha: FECHA });
    expect(accionesPdf(bytes)).toEqual([]);
  });

  it("un símbolo fuera de WinAnsi se sustituye y la primera página lo avisa", () => {
    const resp: RespuestaPdf = { markdown: "La complejidad es O(n) y x ≤ y → z.", diagramas: [], citas: [] };
    const bytes = generarPdf([resp], { titulo: "Símbolos", fecha: FECHA });
    const texto = extraerTexto(bytes);
    expect(texto).toContain("x <= y -> z");
    expect(texto).toContain("Algunos símbolos se sustituyeron");
  });

  // Red-check de §17.4: los mismos bytes con /OpenAction y con /URI insertados → las dos acciones.
  it("red-check: /OpenAction insertado en el catálogo → «el PDF trae una acción: /OpenAction»", () => {
    const bytes = generarPdf([respuestaBase], { titulo: "Respuesta", fecha: FECHA });
    const s = bytesAString(bytes).replace("<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Catalog /Pages 2 0 R /OpenAction 3 0 R >>");
    const mut = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) mut[i] = s.charCodeAt(i) & 0xff;
    const halladas = accionesPdf(bytes);
    const halladasMut = accionesPdf(mut);
    expect(halladas).toEqual([]); // los bytes reales no traen la acción
    expect(halladasMut).toContain("/OpenAction");
    expect(`el PDF trae una acción: ${halladasMut.find((x) => x === "/OpenAction")}`).toBe("el PDF trae una acción: /OpenAction");
  });

  it("red-check: /URI insertado en una anotación → «el PDF trae una acción: /URI»", () => {
    const bytes = generarPdf([respuestaBase], { titulo: "Respuesta", fecha: FECHA });
    const s = bytesAString(bytes).replace("trailer", "% << /URI (https://x.test) >>\ntrailer");
    const mut = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) mut[i] = s.charCodeAt(i) & 0xff;
    expect(accionesPdf(bytes)).toEqual([]);
    expect(accionesPdf(mut)).toContain("/URI");
  });
});
