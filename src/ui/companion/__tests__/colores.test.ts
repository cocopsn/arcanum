// Guarda de color y clases del compañero: D4 dentro del compañero (design §7, reglas 1-7). Sustituye a estilos.test.ts.
// Recorre todo archivo que no es de prueba de src/ui/companion/** y src/lib/companion/** (salvo generated/). Las reglas
// 1-4, 6 y 7 miran color; la 5 mira clases con el AST de `typescript`. Cada protección nueva lleva su red-check sobre una
// copia en memoria (ver abajo); la copia intacta pasa en verde antes de cada rojo. Las salidas van a redchecks.md.
//
// Alcance de FEAT-003: los archivos de color del compañero que ya existen son estilos.ts y Panel.tsx (iconos.tsx no
// pinta color propio). Las reglas se escriben completas (como pide §7); los red-checks de color van sobre estilos.ts y
// Panel.tsx, que es lo que hay. FEAT-004 repetirá (i)(viii)(ix)(x)(xv)(xvi) sobre Mensaje.tsx y añadirá (vi)(vii).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { chromaOf, COLOR_LITERAL, MAX_CHROMA, bodyBlock, COLORES_NOMBRE } from "./croma";

const ROOT = process.cwd();
const RAICES = [join(ROOT, "src", "ui", "companion"), join(ROOT, "src", "lib", "companion")];
const ESTILOS = join(ROOT, "src", "ui", "companion", "estilos.ts");
const SVG_TEXTO = join(ROOT, "src", "lib", "companion", "diagrama", "svg-texto.ts");
const COLOR_FUNC = /\b(hsla?|hwb|lab|lch|oklab|oklch|color)\(/;
const NOMBRES_OK = new Set(["white", "black", "transparent", "currentcolor", "inherit"]);
const PROPS_COLOR = [
  "color", "background", "backgroundColor", "borderColor", "borderTopColor", "borderRightColor", "borderBottomColor",
  "borderLeftColor", "outline", "outlineColor", "fill", "stroke", "boxShadow", "caretColor", "textDecorationColor",
  "stopColor", "floodColor", "lightingColor",
];

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
const lineaDe = (sf: ts.SourceFile, pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1;
const lineaEn = (texto: string, idx: number) => texto.slice(0, idx).split("\n").length;

/** Regla 1: nombres de variable que body[data-world="forge"] reasigna en globals.css. */
function varsReasignadas(globals: string): Set<string> {
  const b = bodyBlock(globals);
  if (b === null) throw new Error("no encontré body[data-world=\"forge\"] en globals.css");
  const nombres = [...b.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]!);
  if (nombres.length < 10) throw new Error("no encontré body[data-world=\"forge\"] en globals.css");
  return new Set(nombres);
}

/** Reemplaza el bloque cmp:otros-mundos por espacios (conservando saltos de línea) para que las reglas de croma no lo
 *  midan —es el único lugar con acento de mundo (§7, regla 3)— sin mover los números de línea de lo demás. */
function sinBloqueMundos(estilos: string): string {
  const abre = estilos.indexOf("/* cmp:otros-mundos */");
  const fin = estilos.indexOf("/* /cmp:otros-mundos */");
  if (abre < 0 || fin < 0) return estilos;
  const cierre = fin + "/* /cmp:otros-mundos */".length;
  const trozo = estilos.slice(abre, cierre).replace(/[^\n]/g, " ");
  return estilos.slice(0, abre) + trozo + estilos.slice(cierre);
}

/** Reglas 3 y 4 sobre un texto CSS/TS: croma, prefijo de var, notaciones funcionales, url( y nombres. `texto` ya trae el
 *  bloque de otros mundos en blanco (croma); `textoUrl` es el texto completo para la comprobación de url( (§7). */
function colorEnTexto(texto: string, textoUrl: string, archivo: string, permitidas: Set<string>, esEstilos: boolean): string[] {
  const bad: string[] = [];
  const pintar = (lit: string, idx: number, base = texto) => bad.push(`el compañero pinta color en Forge: ${lit} en ${rel(archivo)}:${lineaEn(base, idx)}`);
  // literales #hex y rgb()/rgba() con croma
  for (const m of texto.matchAll(COLOR_LITERAL)) {
    const k = chromaOf(m[0]);
    if (k !== null && k > MAX_CHROMA) pintar(m[0], m.index!);
  }
  // var(--x): prefijo cmp-/forge-/safe- o en la lista reasignada
  for (const m of texto.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) {
    const v = m[1]!;
    if (!/^--(cmp|forge|safe)-/.test(v) && !permitidas.has(v)) pintar(`var(${v})`, m.index!);
  }
  // notaciones funcionales y color-mix
  for (const m of texto.matchAll(new RegExp(`color-mix\\(|${COLOR_FUNC.source}`, "g"))) pintar(m[0].replace(/\($/, "("), m.index!);
  // url( en todo estilos.ts (incluye el bloque de otros mundos); el literal nombrado es url(data: o url(
  if (esEstilos) {
    for (const m of textoUrl.matchAll(/url\(\s*(['"]?)(data:)?/g)) pintar(m[2] ? "url(data:" : "url(", m.index!, textoUrl);
  }
  return bad;
}

/** Nombres de color (regla 3, quinto punto): sólo en valores de declaraciones CSS de estilos.ts y en cadenas de props
 *  de color en .tsx; nunca en prosa. */
function nombresEnTexto(texto: string, archivo: string, esEstilos: boolean): string[] {
  const bad: string[] = [];
  const mirar = (valor: string, idx: number) => {
    for (const m of valor.matchAll(new RegExp(`\\b(${Object.keys(COLORES_NOMBRE).join("|")})\\b`, "gi"))) {
      if (!NOMBRES_OK.has(m[0].toLowerCase())) bad.push(`el compañero pinta color en Forge: ${m[0]} en ${rel(archivo)}:${lineaEn(texto, idx + m.index!)}`);
    }
  };
  if (esEstilos) {
    for (const m of texto.matchAll(/:\s*([^;{}]+);/g)) mirar(m[1]!, m.index! + m[0].indexOf(m[1]!));
    return bad;
  }
  // en .ts/.tsx, las cadenas asignadas a una prop de color o a una llave de objeto de estilo
  const propRe = new RegExp(`\\b(${PROPS_COLOR.join("|")})\\s*[:=]\\s*(['"\`])([^'"\`]*)\\2`, "g");
  for (const m of texto.matchAll(propRe)) mirar(m[3]!, m.index! + m[0].lastIndexOf(m[3]!));
  // url( con color codificado en un objeto de estilo de un .tsx
  for (const m of texto.matchAll(/url\(\s*(['"]?)(data:)?/g)) bad.push(`el compañero pinta color en Forge: ${m[2] ? "url(data:" : "url("} en ${rel(archivo)}:${lineaEn(texto, m.index!)}`);
  return bad;
}

/** Regla 2: el bloque cmp:otros-mundos de estilos.ts. */
function reglaMundos(estilos: string): string[] {
  const bad: string[] = [];
  const abre = estilos.indexOf("/* cmp:otros-mundos */");
  const cierra = estilos.indexOf("/* /cmp:otros-mundos */");
  if (abre < 0 || cierra < 0 || cierra < abre) return ["falta exactamente un par de marcadores cmp:otros-mundos en estilos.ts"];
  if (estilos.indexOf("/* cmp:otros-mundos */", abre + 1) >= 0) bad.push("hay más de un marcador cmp:otros-mundos en estilos.ts");
  let cuerpo = estilos.slice(abre + "/* cmp:otros-mundos */".length, cierra);
  if (/@(media|supports|keyframes)/.test(cuerpo)) bad.push("el bloque cmp:otros-mundos trae una at-rule");
  cuerpo = cuerpo.replace(/\/\*[\s\S]*?\*\//g, ""); // quita comentarios antes de partir en reglas
  const PREFIJO = '#arcanum-companion [data-cmp-mundo]:not([data-cmp-mundo="forge"])';
  const BIEN = /^#arcanum-companion \[data-cmp-mundo\]:not\(\[data-cmp-mundo="forge"\]\)(\[data-cmp-mundo="(inicio|mundo)"\])?(\s|$)/;
  for (const m of cuerpo.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const sel of m[1]!.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (!sel.startsWith(PREFIJO)) {
        bad.push(`una regla de otros mundos aplica en Forge: ${sel}`);
        continue;
      }
      const resto = sel.slice(PREFIJO.length);
      if (!BIEN.test(sel) || /data-cmp-mundo/.test(resto.replace(/^\[data-cmp-mundo="(inicio|mundo)"\]/, ""))) {
        bad.push(`selector de mundo mal formado: ${sel}`);
      }
    }
  }
  return bad;
}

/** Reglas 6 y 7: estilos.ts, fuera del bloque de otros mundos, declara ::placeholder{color:…} y #arcanum-companion{accent-color:…}. */
function reglasHerencia(estilos: string): string[] {
  const bad: string[] = [];
  const abre = estilos.indexOf("/* cmp:otros-mundos */");
  const fuera = abre >= 0 ? estilos.slice(0, abre) + estilos.slice(estilos.indexOf("/* /cmp:otros-mundos */")) : estilos;
  const tieneRegla = (sel: string, prop: string) => {
    const re = new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "g");
    for (const m of fuera.matchAll(re)) if (new RegExp(`(^|[;{])\\s*${prop}\\s*:`).test(m[1]!)) return true;
    return false;
  };
  if (!tieneRegla("#arcanum-companion ::placeholder", "color")) bad.push("el compañero hereda el color de preflight: ::placeholder");
  if (!tieneRegla("#arcanum-companion", "accent-color")) bad.push("el compañero hereda el acento del navegador: accent-color");
  return bad;
}

/** Regla 5: clases por el AST. Devuelve hallazgos de «clase ajena» y «clase no verificable». */
function reglaClases(archivo: string, texto: string): string[] {
  const bad: string[] = [];
  const kind = archivo.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(archivo, texto, ts.ScriptTarget.Latest, true, kind);
  const noVerificable = (nodo: ts.Node) => bad.push(`clase no verificable en ${rel(archivo)}:${lineaDe(sf, nodo.getStart())}`);
  const ajena = (clase: string, nodo: ts.Node) => bad.push(`el compañero usa una clase ajena: ${clase} en ${rel(archivo)}:${lineaDe(sf, nodo.getStart())}`);

  // de react / react/jsx-runtime: qué identificadores son createElement/jsx/jsxs/jsxDEV y qué espacios de react
  const reactNs = new Set<string>();
  const creadores = new Set<string>(); // nombres locales de createElement/jsx/jsxs/jsxDEV
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    const mod = st.moduleSpecifier.text;
    const esReact = mod === "react";
    const esRuntime = mod === "react/jsx-runtime" || mod === "react/jsx-dev-runtime";
    const nb = st.importClause;
    if (!nb) continue;
    if (nb.name && esReact) reactNs.add(nb.name.text); // import React from "react"
    if (nb.namedBindings && ts.isNamespaceImport(nb.namedBindings) && esReact) reactNs.add(nb.namedBindings.name.text);
    if (nb.namedBindings && ts.isNamedImports(nb.namedBindings)) {
      for (const el of nb.namedBindings.elements) {
        const orig = (el.propertyName ?? el.name).text;
        if ((esReact || esRuntime) && ["createElement", "jsx", "jsxs", "jsxDEV"].includes(orig)) creadores.add(el.name.text);
      }
    }
  }

  const clasesDeExpr = (e: ts.Expression): string[] | null => {
    if (ts.isParenthesizedExpression(e)) return clasesDeExpr(e.expression);
    if (ts.isStringLiteralLike(e)) return [e.text];
    if (ts.isNoSubstitutionTemplateLiteral(e)) return [e.text];
    if (ts.isTemplateExpression(e)) {
      const partes: string[] = [e.head.text];
      for (const span of e.templateSpans) {
        const sub = clasesDeExpr(span.expression);
        if (sub === null) return null;
        partes.push(...sub, span.literal.text);
      }
      return partes;
    }
    if (ts.isConditionalExpression(e)) {
      const a = clasesDeExpr(e.whenTrue);
      const b = clasesDeExpr(e.whenFalse);
      return a === null || b === null ? null : [...a, ...b];
    }
    if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return clasesDeExpr(e.right);
    return null; // identificador, llamada, acceso, ||, ??: no verificable
  };

  const visitar = (nodo: ts.Node) => {
    // props de clase en JSX
    if (ts.isJsxAttribute(nodo) && ts.isIdentifier(nodo.name) && ["className", "textareaClassName", "preClassName"].includes(nodo.name.text)) {
      const ini = nodo.initializer;
      let expr: ts.Expression | undefined;
      if (ini && ts.isStringLiteral(ini)) expr = ini;
      else if (ini && ts.isJsxExpression(ini) && ini.expression) expr = ini.expression;
      if (expr) {
        const clases = clasesDeExpr(expr);
        if (clases === null) noVerificable(nodo);
        else for (const c of clases.join(" ").split(/\s+/).filter(Boolean)) if (!/^cmp-[a-z0-9-]+$/.test(c)) ajena(c, nodo);
      }
    }
    // spread en JSX
    if (ts.isJsxSpreadAttribute(nodo)) noVerificable(nodo);
    // .classList y .className =  y setAttribute("class", …)
    if (ts.isPropertyAccessExpression(nodo) && nodo.name.text === "classList") noVerificable(nodo);
    if (ts.isBinaryExpression(nodo) && nodo.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(nodo.left) && nodo.left.name.text === "className")
      noVerificable(nodo);
    if (
      ts.isCallExpression(nodo) &&
      ts.isPropertyAccessExpression(nodo.expression) &&
      nodo.expression.name.text === "setAttribute" &&
      nodo.arguments[0] &&
      ts.isStringLiteralLike(nodo.arguments[0]) &&
      nodo.arguments[0].text === "class"
    )
      noVerificable(nodo);
    // llave className/class en un objeto literal (PropertyAssignment o shorthand)
    if ((ts.isPropertyAssignment(nodo) || ts.isShorthandPropertyAssignment(nodo))) {
      const n = nodo.name;
      const nombre = ts.isIdentifier(n) ? n.text : ts.isStringLiteralLike(n) ? n.text : null;
      if (nombre === "className" || nombre === "class") noVerificable(nodo);
    }
    // createElement/jsx/jsxs/jsxDEV de React (document.createElement no entra)
    if (ts.isCallExpression(nodo)) {
      const ex = nodo.expression;
      if (ts.isIdentifier(ex) && creadores.has(ex.text)) noVerificable(nodo);
      else if (ts.isPropertyAccessExpression(ex) && ts.isIdentifier(ex.expression) && reactNs.has(ex.expression.text) && ["createElement", "jsx", "jsxs", "jsxDEV"].includes(ex.name.text))
        noVerificable(nodo);
    }
    ts.forEachChild(nodo, visitar);
  };
  visitar(sf);
  return bad;
}

/** Corre todas las reglas sobre un conjunto de archivos en disco, con sustituciones en memoria opcionales. */
function analizar(sustituciones: Record<string, string> = {}): string[] {
  const globals = sustituciones["globals"] ?? readFileSync(join(ROOT, "src", "app", "globals.css"), "utf8");
  const permitidas = varsReasignadas(globals);
  const archivos = RAICES.flatMap(caminar);
  const bad: string[] = [];
  for (const archivo of archivos) {
    const texto = sustituciones[archivo] ?? readFileSync(archivo, "utf8");
    const esEstilos = archivo === ESTILOS;
    const esSvg = archivo === SVG_TEXTO;
    if (esSvg) {
      for (const m of texto.matchAll(COLOR_LITERAL)) if (!["#ffffff", "#1e2124", "#494a4b"].includes(m[0].toLowerCase())) bad.push(`la exportación del diagrama usa un color fuera de la escala: ${m[0]}`);
    } else {
      const paraCroma = esEstilos ? sinBloqueMundos(texto) : texto;
      bad.push(...colorEnTexto(paraCroma, texto, archivo, permitidas, esEstilos));
      bad.push(...nombresEnTexto(paraCroma, archivo, esEstilos));
    }
    if (/\.tsx?$/.test(archivo)) bad.push(...reglaClases(archivo, texto));
  }
  const estilos = sustituciones[ESTILOS] ?? readFileSync(ESTILOS, "utf8");
  bad.push(...reglaMundos(estilos));
  bad.push(...reglasHerencia(estilos));
  return bad;
}

/** Un red-check en memoria: la copia intacta pasa, y con la mutación aparece el mensaje. */
function redcheck(archivo: string, intacto: string, mutado: string, mensaje: string) {
  expect(analizar({ [archivo]: intacto }), "la copia intacta debe pasar antes del red-check").toEqual([]);
  const bad = analizar({ [archivo]: mutado });
  expect(bad.some((h) => h.includes(mensaje)), `el red-check no dio «${mensaje}»; dio: ${bad.join(" | ") || "nada"}`).toBe(true);
}

describe("colores.test.ts (design §7, reglas 1-7)", () => {
  const estilos = readFileSync(ESTILOS, "utf8");
  const panel = readFileSync(join(ROOT, "src", "ui", "companion", "Panel.tsx"), "utf8");

  it("el compañero pasa las siete reglas (D4 adentro)", () => {
    const bad = analizar();
    expect(bad, bad.join("\n")).toEqual([]);
  });

  it("control: la lista del paso 1 tiene --rank y --text, y no --accent ni --line-soft", () => {
    const vars = varsReasignadas(readFileSync(join(ROOT, "src", "app", "globals.css"), "utf8"));
    expect(vars.has("--rank")).toBe(true);
    expect(vars.has("--text")).toBe(true);
    expect(vars.has("--accent")).toBe(false);
    expect(vars.has("--line-soft")).toBe(false);
  });

  it("positiva: un comentario entre dos reglas válidas del bloque de otros mundos no da hallazgo (regla 2)", () => {
    const con = estilos.replace(
      "/* /cmp:otros-mundos */",
      '#arcanum-companion [data-cmp-mundo]:not([data-cmp-mundo="forge"])[data-cmp-mundo="inicio"] .cmp-x { color: var(--rank); }\n/* inicio */\n/* /cmp:otros-mundos */',
    );
    expect(reglaMundos(con)).toEqual([]);
  });

  it("positiva: document.createElement(\"div\") con el.id no da hallazgo (regla 5)", () => {
    const src = 'const el = document.createElement("div");\nel.id = "arcanum-companion";\n';
    expect(reglaClases(join(ROOT, "src", "ui", "companion", "zz.ts"), src)).toEqual([]);
  });

  // ---- red-checks sobre estilos.ts: (ii)(iii)(iv)(v)(xi)(xii)(xiii)(xiv) ----
  it("(ii) var(--accent) en el bloque compartido → pinta color en Forge", () => {
    redcheck(ESTILOS, estilos, estilos.replace("accent-color: var(--text);", "accent-color: var(--accent);"), "el compañero pinta color en Forge: var(--accent)");
  });

  it("(iii) una regla de otros mundos sin el calificador aplica en Forge", () => {
    const mut = estilos.replace(
      "/* /cmp:otros-mundos */",
      "#arcanum-companion [data-cmp-mundo] .cmp-error { color: var(--amber); }\n/* /cmp:otros-mundos */",
    );
    redcheck(ESTILOS, estilos, mut, "una regla de otros mundos aplica en Forge: #arcanum-companion [data-cmp-mundo] .cmp-error");
  });

  it("(iv) var(--line-soft) en el bloque compartido → pinta color en Forge", () => {
    redcheck(ESTILOS, estilos, estilos.replace("accent-color: var(--text);", "accent-color: var(--line-soft);"), "el compañero pinta color en Forge: var(--line-soft)");
  });

  it("(v) hsl(270 80% 60%) en el bloque compartido → pinta color en Forge", () => {
    redcheck(ESTILOS, estilos, estilos.replace("accent-color: var(--text);", "accent-color: hsl(270 80% 60%);"), "el compañero pinta color en Forge: hsl(");
  });

  it("(xi) url(data:…%238b5cf6…) en el bloque compartido → pinta color en Forge: url(data:", () => {
    const mut = estilos.replace("accent-color: var(--text);", "accent-color: var(--text);\n  background: url(\"data:image/svg+xml,%3Csvg fill='%238b5cf6'/%3E\");");
    redcheck(ESTILOS, estilos, mut, "el compañero pinta color en Forge: url(data:");
  });

  it("(xii) una regla de inicio en forma descendiente → selector de mundo mal formado", () => {
    const mut = estilos.replace(
      "/* /cmp:otros-mundos */",
      '#arcanum-companion [data-cmp-mundo]:not([data-cmp-mundo="forge"]) [data-cmp-mundo="inicio"] .cmp-x { color: var(--rank); }\n/* /cmp:otros-mundos */',
    );
    redcheck(ESTILOS, estilos, mut, "selector de mundo mal formado");
  });

  it("(xiii) la regla ::placeholder quitada → hereda el color de preflight", () => {
    const mut = estilos.replace(/#arcanum-companion ::placeholder \{[^}]*\}/, "");
    redcheck(ESTILOS, estilos, mut, "el compañero hereda el color de preflight: ::placeholder");
  });

  it("(xiv) la declaración accent-color quitada → hereda el acento del navegador", () => {
    const mut = estilos.replace("accent-color: var(--text);\n", "");
    redcheck(ESTILOS, estilos, mut, "el compañero hereda el acento del navegador: accent-color");
  });

  // ---- red-checks sobre Panel.tsx: (i)(viii)(ix)(x)(xv)(xvi) ----
  const PANEL = join(ROOT, "src", "ui", "companion", "Panel.tsx");
  const conClase = (reemplazo: string) => panel.replace('className="cmp-aviso"', reemplazo);

  it("(i) #8b5cf6 en un objeto de estilo de Panel.tsx → pinta color en Forge", () => {
    const mut = conClase('className="cmp-aviso" style={{ color: "#8b5cf6" }}');
    redcheck(PANEL, panel, mut, "el compañero pinta color en Forge: #8b5cf6");
  });

  it("(viii) una clase ajena text-violet-500 en Panel.tsx", () => {
    const mut = conClase('className="cmp-aviso text-violet-500"');
    redcheck(PANEL, panel, mut, "el compañero usa una clase ajena: text-violet-500");
  });

  it("(ix) shadow-aura en una rama de ternario de className", () => {
    const mut = conClase('className={aviso ? "cmp-aviso" : "shadow-aura"}');
    redcheck(PANEL, panel, mut, "el compañero usa una clase ajena: shadow-aura");
  });

  it("(x) className={clases} → clase no verificable", () => {
    const mut = conClase("className={clases}");
    redcheck(PANEL, panel, mut, "clase no verificable");
  });

  it("(xv) createElement(\"span\", props) con import de react → clase no verificable", () => {
    const mut = panel
      .replace('import { useEffect, useRef, useState, type KeyboardEvent as KeyboardEventReact } from "react";', 'import { createElement, useEffect, useRef, useState, type KeyboardEvent as KeyboardEventReact } from "react";')
      .replace("const hoja = useHoja();", 'const hoja = useHoja();\n  const props: Record<string, unknown> = {};\n  void createElement("span", props);');
    redcheck(PANEL, panel, mut, "clase no verificable");
  });

  it("(xvi) Object.assign(el, { className }) → clase no verificable", () => {
    const mut = conClase('className="cmp-aviso" ref={(el) => el && Object.assign(el, { className: "text-violet-500" })}');
    redcheck(PANEL, panel, mut, "clase no verificable");
  });

  // ---- FEAT-004: (i)(viii)(ix)(x)(xv)(xvi) repetidos sobre Mensaje.tsx ----
  const MENSAJE = join(ROOT, "src", "ui", "companion", "Mensaje.tsx");
  const mensaje = readFileSync(MENSAJE, "utf8");
  const conClaseMensaje = (reemplazo: string) => mensaje.replace('className="cmp-fuentes"', reemplazo);

  it("(i) #8b5cf6 en un objeto de estilo de Mensaje.tsx → pinta color en Forge", () => {
    const mut = conClaseMensaje('className="cmp-fuentes" style={{ color: "#8b5cf6" }}');
    redcheck(MENSAJE, mensaje, mut, "el compañero pinta color en Forge: #8b5cf6");
  });

  it("(viii) una clase ajena text-violet-500 en Mensaje.tsx", () => {
    const mut = conClaseMensaje('className="cmp-fuentes text-violet-500"');
    redcheck(MENSAJE, mensaje, mut, "el compañero usa una clase ajena: text-violet-500 en /src/ui/companion/Mensaje.tsx");
  });

  it("(ix) shadow-aura en una rama de ternario de className en Mensaje.tsx", () => {
    const mut = conClaseMensaje('className={esAprendiz ? "cmp-fuentes" : "shadow-aura"}');
    redcheck(MENSAJE, mensaje, mut, "el compañero usa una clase ajena: shadow-aura");
  });

  it("(x) className={clases} → clase no verificable en Mensaje.tsx", () => {
    const mut = conClaseMensaje("className={clases}");
    redcheck(MENSAJE, mensaje, mut, "clase no verificable en /src/ui/companion/Mensaje.tsx");
  });

  it("(xv) createElement(\"span\", props) con import de react en Mensaje.tsx → clase no verificable", () => {
    const mut = mensaje
      .replace('import { Markdown } from "./Markdown";', 'import { createElement } from "react";\nimport { Markdown } from "./Markdown";')
      .replace("const esAprendiz = mensaje.rol === \"aprendiz\";", 'const esAprendiz = mensaje.rol === "aprendiz";\n  const props: Record<string, unknown> = {};\n  void createElement("span", props);');
    redcheck(MENSAJE, mensaje, mut, "clase no verificable en /src/ui/companion/Mensaje.tsx");
  });

  it("(xvi) Object.assign(el, { className }) en Mensaje.tsx → clase no verificable", () => {
    const mut = conClaseMensaje('className="cmp-fuentes" ref={(el: HTMLElement | null) => el && Object.assign(el, { className: "text-violet-500" })}');
    redcheck(MENSAJE, mensaje, mut, "clase no verificable en /src/ui/companion/Mensaje.tsx");
  });

  // ---- FEAT-005: (vi) sobre Diagrama.tsx y (vii) sobre svg-texto.ts ----
  const DIAGRAMA = join(ROOT, "src", "ui", "companion", "diagrama", "Diagrama.tsx");
  const diagrama = readFileSync(DIAGRAMA, "utf8");

  it("(vi) stroke=\"purple\" en Diagrama.tsx → pinta color en Forge", () => {
    const mut = diagrama.replace('stroke="currentColor" strokeDasharray="2 2"', 'stroke="purple" strokeDasharray="2 2"');
    redcheck(DIAGRAMA, diagrama, mut, "el compañero pinta color en Forge: purple");
  });

  it("(vii) #8b5cf6 en svg-texto.ts → color fuera de la escala del diagrama", () => {
    const svg = readFileSync(SVG_TEXTO, "utf8");
    const mut = svg.replace('const TRAZO = "#494a4b";', 'const TRAZO = "#8b5cf6";');
    redcheck(SVG_TEXTO, svg, mut, "la exportación del diagrama usa un color fuera de la escala: #8b5cf6");
  });
});
