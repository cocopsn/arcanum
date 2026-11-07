// Fuentes seguras del compañero (design §15, §12.1, DP-5; §23.3). Ningún archivo del compañero (fuera de pruebas) usa un
// sumidero de HTML sin escapar; safe-area-inset/--safe- aparecen SÓLO en las cuatro líneas de estilos.ts; y ningún
// archivo declara una CSP (sólo src/lib/csp.mjs la declara, DP-5). Cada regla lleva su red-check en memoria. Las salidas
// van a redchecks.md.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const RAICES = [join(ROOT, "src", "ui", "companion"), join(ROOT, "src", "lib", "companion")];
const ESTILOS = join(ROOT, "src", "ui", "companion", "estilos.ts");

/** Sumideros de §15: HTML del modelo sin escapar. */
const SUMIDEROS = ["dangerouslySetInnerHTML", "innerHTML", "outerHTML", "insertAdjacentHTML", "createContextualFragment", "DOMParser", "document.write", "foreignObject"] as const;
/** Declaraciones de CSP (DP-5): sólo src/lib/csp.mjs puede tenerlas. */
const CSP = [/Content-Security-Policy/i, /\bhttp-equiv\b/i, /\bhttpEquiv\b/, /["'@/]*csp\.mjs/];

function esPrueba(p: string): boolean {
  return /[\\/]__tests__[\\/]/.test(p) || /\.test\.[cm]?tsx?$/.test(p) || /[\\/]generated[\\/]/.test(p);
}
function caminar(dir: string): string[] {
  if (!existsSync(dir)) return [];
  let out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out = out.concat(caminar(p));
    else if (/\.[cm]?tsx?$/.test(p) && !esPrueba(p)) out.push(p);
  }
  return out;
}
const rel = (p: string) => p.replace(ROOT, "").replace(/\\/g, "/");
const lineaEn = (texto: string, idx: number) => texto.slice(0, idx).split("\n").length;

/** Las cuatro líneas de --cmp-sa-* de estilos.ts, que SON el único lugar permitido para safe-area-inset/--safe-. */
const LINEAS_SA = [
  "--cmp-sa-t: var(--safe-top, env(safe-area-inset-top, 0px));",
  "--cmp-sa-r: var(--safe-right, env(safe-area-inset-right, 0px));",
  "--cmp-sa-b: var(--safe-bottom, env(safe-area-inset-bottom, 0px));",
  "--cmp-sa-l: var(--safe-left, env(safe-area-inset-left, 0px));",
];

/** Corre las tres reglas sobre el disco con sustituciones en memoria opcionales. */
function analizar(sustituciones: Record<string, string> = {}): string[] {
  const archivos = RAICES.flatMap(caminar);
  const bad: string[] = [];
  for (const archivo of archivos) {
    const texto = sustituciones[archivo] ?? readFileSync(archivo, "utf8");
    // sumideros
    for (const s of SUMIDEROS) {
      let idx = texto.indexOf(s);
      while (idx >= 0) {
        bad.push(`el compañero usa un sumidero de HTML sin escapar: ${s} en ${rel(archivo)}:${lineaEn(texto, idx)}`);
        idx = texto.indexOf(s, idx + s.length);
      }
    }
    // CSP (DP-5)
    for (const re of CSP) {
      const m = texto.match(re);
      if (m) bad.push(`el compañero declara una CSP fuera de src/lib/csp.mjs: ${rel(archivo)}:${lineaEn(texto, texto.indexOf(m[0]))}`);
    }
    // safe-area: fuera de estilos.ts, en ningún lado; en estilos.ts, sólo en las cuatro líneas. Los comentarios
    // (prosa: el encabezado nombra --safe-*) no cuentan; se blanquean conservando los saltos de línea.
    const sa = /safe-area-inset|--safe-/g;
    const sinComentarios = texto.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (c) => c.replace(/[^\n]/g, " "));
    if (archivo === ESTILOS) {
      let resto = sinComentarios;
      for (const l of LINEAS_SA) resto = resto.replace(l, " ".repeat(l.length));
      for (const m of resto.matchAll(sa)) bad.push(`safe-area fuera de las cuatro líneas de estilos.ts: ${m[0]} en ${rel(archivo)}:${lineaEn(resto, m.index!)}`);
    } else {
      for (const m of sinComentarios.matchAll(sa)) bad.push(`safe-area fuera de estilos.ts: ${m[0]} en ${rel(archivo)}:${lineaEn(sinComentarios, m.index!)}`);
    }
  }
  return bad;
}

function redcheck(archivo: string, intacto: string, mutado: string, mensaje: string | RegExp) {
  expect(analizar({ [archivo]: intacto }), "la copia intacta debe pasar antes del red-check").toEqual([]);
  const bad = analizar({ [archivo]: mutado });
  const casa = (h: string) => (typeof mensaje === "string" ? h.includes(mensaje) : mensaje.test(h));
  expect(bad.some(casa), `el red-check no dio «${String(mensaje)}»; dio: ${bad.join(" | ") || "nada"}`).toBe(true);
}

describe("fuentes-seguras.test.ts (design §15, DP-5)", () => {
  const estilos = readFileSync(ESTILOS, "utf8");
  const panel = readFileSync(join(ROOT, "src", "ui", "companion", "Panel.tsx"), "utf8");
  const PANEL = join(ROOT, "src", "ui", "companion", "Panel.tsx");

  it("ningún sumidero, ninguna CSP y safe-area sólo en las cuatro líneas de estilos.ts", () => {
    const bad = analizar();
    expect(bad, bad.join("\n")).toEqual([]);
  });

  it("red-check: un sumidero (innerHTML) agregado a Panel.tsx → archivo y línea", () => {
    const mut = panel.replace("const hoja = useHoja();", 'const hoja = useHoja();\n  if (panel.current) panel.current.innerHTML = "x";');
    redcheck(PANEL, panel, mut, "el compañero usa un sumidero de HTML sin escapar: innerHTML");
  });

  it("red-check: env(safe-area-inset-bottom) en la regla del orbe → archivo y línea", () => {
    const mut = estilos.replace(
      "#arcanum-companion .cmp-orbe[data-cmp-esquina=\"inf-der\"] {\n  right: calc(var(--cmp-sa-r) + 12px);\n  bottom: calc(var(--cmp-sa-b) + 12px + var(--cmp-dy, 0px));\n}",
      "#arcanum-companion .cmp-orbe[data-cmp-esquina=\"inf-der\"] {\n  right: calc(var(--cmp-sa-r) + 12px);\n  bottom: calc(env(safe-area-inset-bottom) + 12px + var(--cmp-dy, 0px));\n}",
    );
    redcheck(ESTILOS, estilos, mut, "safe-area fuera de las cuatro líneas de estilos.ts");
  });

  it("red-check: un <meta httpEquiv=\"Content-Security-Policy\"> en una copia de Panel.tsx → CSP fuera de csp.mjs", () => {
    const mut = panel.replace(
      "{hoja && <span className=\"cmp-asa\" aria-hidden=\"true\" />}",
      "{hoja && <span className=\"cmp-asa\" aria-hidden=\"true\" />}\n        <meta httpEquiv=\"Content-Security-Policy\" content=\"default-src 'self'\" />",
    );
    redcheck(PANEL, panel, mut, "el compañero declara una CSP fuera de src/lib/csp.mjs: /src/ui/companion/Panel.tsx");
  });
});
