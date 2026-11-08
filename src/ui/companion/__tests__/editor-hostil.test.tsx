// Protección (h): editor de práctica hostil (design §18.5, hallazgo HIGH). El EditorPlano usa react-simple-code-editor
// con highlight que devuelve NODOS de React, así que ni la firma hostil que escribió el modelo ni lo que el aprendiz
// teclee se interpretan como HTML. La prueba monta Practica con un lote aceptado cuya firma es hostil, abre el code,
// teclea otra cadena hostil y exige: sin <img> ni <script> en el subárbol, el texto literal en el <pre> del resaltado y
// window.__pwned sin definir. Red-check: una copia de EditorPlano con highlight={(c) => c} hace que la librería pinte la
// cadena con dangerouslySetInnerHTML → aparece el <img> y la detectora da «el editor de práctica interpretó HTML del
// modelo».
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import Editor from "react-simple-code-editor";
import type { ReactNode } from "react";
import { armarLote, validarLote, type LoteAceptado } from "@/lib/companion/lote";
import { Practica } from "../practica/Practica";
import type { ExecRunner } from "@/lib/exercises-validate";
import type { RunResult, TestCase } from "@/lib/exercise";

afterEach(cleanup);

// La firma/solución hostil del modelo: devuelve una cadena con etiquetas que, pintadas como HTML, ejecutarían código.
const FIRMA_HOSTIL = 'function f() { return "</pre><img src=x onerror=\\"window.__pwned=1\\"><script>window.__pwned=2</script>"; }';
const SALIDA_HOSTIL = '</pre><img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>';
// Lo que el aprendiz teclea en el editor.
const TECLEADO_HOSTIL = '<img src=x onerror="window.__pwned=3">';

const jsRun: ExecRunner = async (code, functionName, cases: TestCase[]): Promise<RunResult> => {
  let fn: unknown;
  try {
    fn = new Function(`${code}\n;return typeof ${functionName}==="function"?${functionName}:undefined;`)();
  } catch (e) {
    return { syntaxError: String(e), cases: [] };
  }
  if (typeof fn !== "function") return { syntaxError: "sin función", cases: [] };
  return {
    syntaxError: null,
    cases: cases
      .filter((c) => !c.hint)
      .map((c) => {
        const out = (fn as (...a: unknown[]) => unknown)();
        return { input: c.input, expected: c.expected, output: out, pass: JSON.stringify(out) === JSON.stringify(c.expected) };
      }),
  };
};

const META = { tema: "hostil", mundo: "inicio", lenguaje: "javascript" as const };

function loteHostil(): string {
  return [
    "## Ejercicio hostil",
    "",
    "type: code",
    "Devuelve la cadena.",
    "",
    "### Firma",
    "```js",
    FIRMA_HOSTIL,
    "```",
    "",
    "### Casos",
    "```json",
    `[{ "input": [], "expected": ${JSON.stringify(SALIDA_HOSTIL)} }]`,
    "```",
    "",
    "### Solución",
    "```js",
    FIRMA_HOSTIL,
    "```",
    "",
  ].join("\n");
}

async function aceptarLote(): Promise<LoteAceptado> {
  const armado = armarLote(loteHostil(), META);
  if (!armado.ok) throw new Error("armarLote falló: " + armado.motivo);
  const r = await validarLote(armado.md, { jsRun });
  if (!r.ok) throw new Error("validarLote falló: " + r.motivo);
  return { md: r.md, banco: r.banco, practicables: r.practicables, etiquetas: r.etiquetas };
}

/** Detectora única: lanza con el mensaje de §18.5 si el subárbol trae HTML del modelo ejecutable o define __pwned. */
function detectar(nodo: Element): void {
  for (const tag of ["img", "script", "iframe"]) {
    if (nodo.querySelector(tag)) throw new Error(`el editor de práctica interpretó HTML del modelo (<${tag}> en el DOM)`);
  }
  if ((window as unknown as Record<string, unknown>).__pwned !== undefined) {
    throw new Error("el editor de práctica interpretó HTML del modelo (window.__pwned definido)");
  }
}

describe("protección (h): editor de práctica hostil (§18.5)", () => {
  it("la firma hostil y lo tecleado quedan como texto, sin img/script, y window.__pwned sin definir", async () => {
    delete (window as unknown as Record<string, unknown>).__pwned;
    const lote = await aceptarLote();
    const { container } = render(<Practica lote={lote} alAprobar={() => {}} deps={{ jsRun }} />);

    // la firma hostil se pintó como el valor inicial del editor: texto, no HTML
    detectar(container);
    const editor = screen.getByRole("textbox", { name: "Editor de práctica" }) as HTMLTextAreaElement;
    expect(editor.value).toContain("<script>");

    // el aprendiz teclea una cadena hostil
    await act(async () => {
      fireEvent.input(editor, { target: { value: TECLEADO_HOSTIL } });
    });
    detectar(container);
    // el <pre> del resaltado contiene el texto literal como nodo de texto
    const pre = container.querySelector("pre");
    expect(pre?.textContent).toContain("onerror");
    expect((window as unknown as Record<string, unknown>).__pwned).toBeUndefined();
  });

  // Red-check: una copia de EditorPlano con highlight que devuelve una CADENA hace que la librería pinte con
  // dangerouslySetInnerHTML → el <img> aparece en el DOM y la detectora da el mensaje.
  it("red-check: highlight que devuelve una cadena ejecuta el HTML del modelo", async () => {
    delete (window as unknown as Record<string, unknown>).__pwned;
    const inseguro = (code: string): ReactNode => code; // devuelve una cadena: el sumidero de la librería
    const { container } = render(
      <Editor value={TECLEADO_HOSTIL} onValueChange={() => {}} highlight={inseguro as (c: string) => string} padding={0} />,
    );
    let mensaje = "";
    try {
      detectar(container);
    } catch (e) {
      mensaje = e instanceof Error ? e.message : String(e);
    }
    expect(mensaje).toContain("el editor de práctica interpretó HTML del modelo");
  });
});
