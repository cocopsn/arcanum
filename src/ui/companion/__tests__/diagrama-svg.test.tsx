// Protección (d): diagrama hostil (design §16.5, CA-25, CA-26). Dibuja fuentes con etiquetas hostiles y comprueba, con
// una sola función detectora sobre el DOM y sobre la cadena exportada, que no hay script/img/image/foreignObject,
// atributos on*, href ni xlink:href, y que window.__pwned sigue sin definir. También: una línea fuera del subconjunto
// deja ver la fuente como texto y «Sintaxis fuera del subconjunto (línea N)», sin SVG. Red-check: una copia insegura
// del componente (etiqueta pintada con dangerouslySetInnerHTML) sí dispara el mensaje (rojo.ts).
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { Diagrama } from "../diagrama/Diagrama";
import { parsearDiagrama } from "@/lib/companion/diagrama/parser";
import { disponerDiagrama } from "@/lib/companion/diagrama/layout";
import { diagramaASvg } from "@/lib/companion/diagrama/svg-texto";
import { rojoEscena } from "./rojo";

afterEach(cleanup);

const HOSTILES = [
  "flowchart TD\n  A[<script>window.__pwned=1</script>] --> B[fin]",
  'flowchart LR\n  A["<img src=x onerror=\\"window.__pwned=1\\">"] --> B',
  'flowchart TD\n  A["javascript:alert(1)"] --> B',
  "flowchart TD\n  A[</text><script>window.__pwned=1</script>] --> B",
];

/** La detectora única: lanza con el mensaje de §16.5 si el subárbol o la cadena traen HTML del modelo ejecutable. */
function detectar(where: string, nodo: Element | null, exportado: string): void {
  const prohibidos = ["script", "img", "image", "foreignObject"];
  if (nodo) {
    for (const tag of prohibidos) {
      if (nodo.querySelector(tag)) throw new Error(`un diagrama ejecutó HTML del modelo (${where}: <${tag}> en el DOM)`);
    }
    for (const el of nodo.querySelectorAll("*")) {
      for (const at of el.getAttributeNames()) {
        if (/^on/i.test(at) || at.toLowerCase() === "href" || at.toLowerCase() === "xlink:href") {
          throw new Error(`un diagrama ejecutó HTML del modelo (${where}: atributo ${at})`);
        }
      }
    }
  }
  const low = exportado.toLowerCase();
  for (const tag of prohibidos) {
    if (low.includes("<" + tag)) throw new Error(`un diagrama ejecutó HTML del modelo (${where}: <${tag}> exportado)`);
  }
  if (/\son[a-z]+\s*=/.test(low) || /\shref\s*=/.test(low) || low.includes("xlink:href")) {
    throw new Error(`un diagrama ejecutó HTML del modelo (${where}: atributo exportado)`);
  }
}

/** Exporta la cadena SVG de una fuente (vacía si no parsea). */
function exportarFuente(fuente: string): string {
  const r = parsearDiagrama(fuente);
  return r.ok ? diagramaASvg(disponerDiagrama(r.ast)) : "";
}

describe("Diagrama hostil (protección d, §16.5)", () => {
  it("ninguna fuente hostil ejecuta HTML del modelo ni define window.__pwned", () => {
    delete (window as unknown as Record<string, unknown>).__pwned;
    for (const fuente of HOSTILES) {
      const { container, unmount } = render(<Diagrama fuente={fuente} />);
      detectar("DOM", container, exportarFuente(fuente));
      unmount();
    }
    expect((window as unknown as Record<string, unknown>).__pwned).toBeUndefined();
  });

  it("la cadena exportada de una fuente hostil es monocroma y sin elementos prohibidos", () => {
    for (const fuente of HOSTILES) {
      const svg = exportarFuente(fuente);
      if (!svg) continue;
      detectar("exportado", null, svg);
      // monocromo: sólo los tres literales de la escala
      const colores = [...svg.matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0].toLowerCase());
      for (const c of colores) expect(["#ffffff", "#1e2124", "#494a4b"]).toContain(c);
    }
  });

  it("una línea fuera del subconjunto no dibuja SVG y muestra la fuente como texto con la línea (CA-26)", () => {
    const extras = ['click A "javascript:alert(1)"', "style A fill:#f00", "classDef x fill:#f00", "%%{init: {}}%%"];
    for (const extra of extras) {
      const fuente = "flowchart TD\n  A[Inicio] --> B[Fin]\n  " + extra;
      const { container, unmount } = render(<Diagrama fuente={fuente} />);
      expect(container.querySelector("svg.cmp-dg-svg")).toBeNull();
      expect(container.textContent).toContain("Sintaxis fuera del subconjunto (línea");
      expect(container.querySelector("pre.cmp-dg-codigo")?.textContent).toContain(extra);
      unmount();
    }
  });

  // Red-check: una copia insegura del componente que pinta la etiqueta con dangerouslySetInnerHTML dispara la detectora.
  it("red-check: una copia con dangerouslySetInnerHTML ejecuta HTML del modelo", async () => {
    const InseguroSvg = ({ fuente }: { fuente: string }): ReactElement => {
      // simula lo que pasaría si el texto del modelo se pintara como HTML (lo que el componente real NO hace)
      const html = fuente.replace(/^flowchart\s+\w+\s*/i, "").replace(/-->.*$/s, "");
      return <svg className="cmp-dg-svg">{/* eslint-disable-next-line react/no-danger */}<text dangerouslySetInnerHTML={{ __html: html.replace(/^\s*A\[|\]\s*$/g, "") }} /></svg>;
    };
    await rojoEscena(() => {
      delete (window as unknown as Record<string, unknown>).__pwned;
      const { container } = render(<InseguroSvg fuente={HOSTILES[0]!} />);
      detectar("DOM", container, "");
    }, "un diagrama ejecutó HTML del modelo");
  });
});
