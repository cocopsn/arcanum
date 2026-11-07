// JS verifiers for scripts/forge/bank-check.mjs (design §6.1, D2). The seed's trust rule leans on this file: at seed
// time the app never runs the author's JavaScript, so bank-check runs it here with node:vm and records the result.
// It applies the SAME rules as the app's js.check of contraejemplo (§5.1), mutantes (§5.2) and historial in mode
// fallas (§5.6); bank-check-js-parity.test.ts runs both over the fixtures and the real items and demands the same
// verdict. It reads the sections that parseBank produces (the item is { id, tipo, titulo, enunciado, secciones }).
import vm from "node:vm";

const JS_TIMEOUT = 3000;
const nm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const LANG = { js: "javascript", javascript: "javascript", mjs: "javascript", py: "python", python: "python", python3: "python", sql: "sql", sqlite: "sql" };

const section = (item, names) => item.secciones.find((s) => names.some((n) => nm(s.titulo) === n || nm(s.titulo).startsWith(n)));
const fenceJs = (sec) => sec?.cercas.find((c) => LANG[c.lenguaje] === "javascript")?.codigo ?? null;
const jsonOf = (sec) => {
  const f = sec?.cercas.find((c) => c.lenguaje === "json") ?? sec?.cercas[0];
  return f ? JSON.parse(f.codigo) : null;
};

/** Same rule as deriveFunctionName in src/forge/bank/types/_shared.ts (JavaScript only here). */
function fnNameOf(code) {
  if (!code) return null;
  return (code.match(/function\s+([A-Za-z_$][\w$]*)\s*\(/) || code.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/) || [])[1] ?? null;
}

/** Copy of deepEqual from src/lib/exercise.ts (same semantics: NaN equal to NaN, key order irrelevant, arrays). */
export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") return Number.isNaN(a) && Number.isNaN(b);
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

/** Run `code`, take `fnName` and call it with each input (cloned by JSON), timeout 3000 ms per call. Returns the
 *  shape of RunResult enough for killedBy / pass checks: { syntaxError } | { timedOut } | { cases }. */
export function vmRun(code, fnName, inputs) {
  const ctx = vm.createContext({});
  try {
    vm.runInContext(code, ctx, { timeout: JS_TIMEOUT });
  } catch (e) {
    return { syntaxError: String(e && e.message ? e.message : e), cases: [] };
  }
  const fn = fnName ? vm.runInContext(`typeof ${fnName} === "function" ? ${fnName} : undefined`, ctx) : undefined;
  if (typeof fn !== "function") return { syntaxError: `función ${fnName ?? "?"} no definida`, cases: [] };
  const cases = [];
  for (const input of inputs) {
    const args = JSON.parse(JSON.stringify(input));
    try {
      const out = vm.runInContext("__fn(...__a)", Object.assign(ctx, { __fn: fn, __a: args }), { timeout: JS_TIMEOUT });
      cases.push({ input, output: out });
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      if (/script execution timed out/i.test(msg)) return { syntaxError: null, cases: [], timedOut: true };
      cases.push({ input, error: msg });
    }
  }
  return { syntaxError: null, cases };
}

/** Does a run kill the mutant? A timeout kills it; otherwise it dies when some case's output differs from expected.
 *  `expecteds` is parallel to the run's cases. */
function killedBy(run, expecteds) {
  if (run.timedOut) return true;
  return run.cases.some((c, i) => c.error !== undefined || !deepEqual(c.output, expecteds[i]));
}

function verifyContraejemplo(item, run) {
  const firma = fenceJs(section(item, ["firma"]));
  const fn = fnNameOf(firma);
  const pre = fenceJs(section(item, ["precondicion"]));
  const casi = fenceJs(section(item, ["casi correcta"]));
  const referencia = fenceJs(section(item, ["referencia"]));
  const comparador = fenceJs(section(item, ["comparador"]));
  const invariante = fenceJs(section(item, ["invariante"]));
  let testigo;
  try {
    testigo = jsonOf(section(item, ["testigo"]));
  } catch {
    return [{ lenguaje: "javascript", ok: false, detalle: "### Testigo no es JSON válido" }];
  }
  if (!fn || !pre || !casi || !referencia || !Array.isArray(testigo)) return [{ lenguaje: "javascript", ok: false, detalle: "faltan secciones de contraejemplo" }];
  const one = (code, name, input, exp) => run(code, name, [input]).cases[0];
  // (1) precondition
  const pr = run(pre, "pre", [testigo]);
  if (pr.timedOut) return [{ lenguaje: "javascript", ok: false, detalle: "la precondición tardó demasiado con el testigo" }];
  if (pr.syntaxError || (pr.cases[0] && pr.cases[0].error !== undefined)) return [{ lenguaje: "javascript", ok: false, detalle: `la precondición falló: ${pr.syntaxError ?? pr.cases[0].error}` }];
  if (pr.cases[0]?.output !== true) return [{ lenguaje: "javascript", ok: false, detalle: "el testigo no muestra la diferencia (fuera-de-contrato)" }];
  // (2) almost-correct
  const cr = run(casi, fn, [testigo]);
  if (cr.syntaxError) return [{ lenguaje: "javascript", ok: false, detalle: `la casi correcta no compila: ${cr.syntaxError}` }];
  let casiOut, casiThrew = false;
  if (cr.timedOut) casiThrew = true;
  else if (cr.cases[0]?.error !== undefined) casiThrew = true;
  else casiOut = cr.cases[0].output;
  // (3) reference
  const rr = run(referencia, fn, [testigo]);
  if (rr.syntaxError || rr.timedOut || rr.cases[0]?.error !== undefined) return [{ lenguaje: "javascript", ok: false, detalle: "la referencia falló con el testigo (error-item)" }];
  const refOut = rr.cases[0].output;
  // (4) same?
  let same;
  if (casiThrew) same = false;
  else if (comparador) {
    const sc = run(comparador, "same", [[casiOut, refOut, testigo]]);
    if (sc.syntaxError || sc.timedOut || sc.cases[0]?.error !== undefined) return [{ lenguaje: "javascript", ok: false, detalle: "el comparador falló (error-item)" }];
    same = sc.cases[0].output === true;
  } else same = deepEqual(casiOut, refOut);
  if (same === false) return [{ lenguaje: "javascript", ok: true }];
  // (5) invariant
  if (invariante && !casiThrew) {
    const iv = run(invariante, "prop", [[testigo, casiOut], [testigo, refOut]]);
    if (iv.syntaxError || iv.timedOut || iv.cases.some((c) => c.error !== undefined)) return [{ lenguaje: "javascript", ok: false, detalle: "la invariante falló (error-item)" }];
    const prop = iv.cases[0].output === true;
    const propRef = iv.cases[1].output === true;
    if (prop === false && propRef === false) return [{ lenguaje: "javascript", ok: false, detalle: "la referencia viola su propia invariante con el testigo" }];
    if (prop === false && propRef === true) return [{ lenguaje: "javascript", ok: true }];
  }
  return [{ lenguaje: "javascript", ok: false, detalle: "el testigo no muestra la diferencia (coincide)" }];
}

function verifyMutantes(item, run) {
  const firma = fenceJs(section(item, ["firma"]));
  const referencia = fenceJs(section(item, ["referencia"]));
  const fn = fnNameOf(firma) ?? fnNameOf(referencia);
  let dorados;
  try {
    dorados = jsonOf(section(item, ["casos dorados"]));
  } catch {
    return [{ lenguaje: "javascript", ok: false, detalle: "### Casos dorados no es JSON válido" }];
  }
  const mutSec = section(item, ["mutantes"]);
  if (!firma || !referencia || !fn || !Array.isArray(dorados) || !mutSec) return [{ lenguaje: "javascript", ok: false, detalle: "faltan secciones de mutantes" }];
  // mutants: #### <id> [· crítico] then a javascript fence each
  const mutantes = [];
  const lines = (mutSec.cuerpo ?? "").split(/\r?\n/);
  let cur = null, inFence = false, fenceLang = "", buf = [];
  const flush = () => { if (cur) { cur.code = buf.join("\n"); mutantes.push(cur); } buf = []; };
  for (const l of lines) {
    const h = !inFence && l.match(/^####\s+(\S+?)(?:\s*·\s*(\S+))?\s*$/);
    const f = l.match(/^\s*(?:```|~~~)\s*([A-Za-z0-9_+-]*)\s*$/);
    if (h) { flush(); cur = { id: h[1], critico: h[2] !== undefined, code: "" }; continue; }
    if (f) { if (inFence) { inFence = false; } else { inFence = true; fenceLang = (f[1] || "").toLowerCase(); } continue; }
    if (inFence && cur && LANG[fenceLang] === "javascript") buf.push(l);
  }
  flush();
  if (mutantes.length === 0) return [{ lenguaje: "javascript", ok: false, detalle: "### Mutantes sin ningún #### <id>" }];
  const inputs = dorados.map((c) => c.input);
  const exps = dorados.map((c) => c.expected);
  const ref = run(referencia, fn, inputs);
  const refPasaDorados = ref.syntaxError === null && !ref.timedOut && ref.cases.every((c, i) => c.error === undefined && deepEqual(c.output, exps[i]));
  if (!refPasaDorados) return [{ lenguaje: "javascript", ok: false, detalle: "la referencia no pasa sus casos dorados" }];
  for (const m of mutantes) {
    const killedByGolden = killedBy(run(m.code, fn, inputs), exps);
    if (!killedByGolden) return [{ lenguaje: "javascript", ok: false, detalle: `el mutante «${m.id}» no falla ningún caso dorado` }];
  }
  return [{ lenguaje: "javascript", ok: true }];
}

function verifyHistorial(item, run) {
  const modo = /^\s*modo\s*:\s*["']?(\w+)["']?\s*$/im.exec(item.enunciado ?? "");
  const isFallas = modo ? modo[1].toLowerCase() === "fallas" : false;
  if (!isFallas) return null; // traza has no executable fences: follow today's path
  const fenceByLang = (sec, lang) => sec?.cercas.find((c) => LANG[c.lenguaje] === lang)?.codigo ?? null;
  const entries = [];
  const firma = section(item, ["firma"]);
  const arnes = section(item, ["arnes"]);
  const solucion = section(item, ["solucion", "solution"]);
  const ingenua = section(item, ["ingenua"]);
  let calendarios;
  try {
    calendarios = jsonOf(section(item, ["calendarios"]));
  } catch {
    return [{ lenguaje: "javascript", ok: false, detalle: "### Calendarios no es JSON válido" }];
  }
  const langsPresent = [...new Set((firma?.cercas ?? []).map((c) => LANG[c.lenguaje]).filter((l) => l === "javascript" || l === "python"))];
  for (const lang of langsPresent) {
    if (lang === "python") { entries.push({ lenguaje: "python", resultado: "sin-verificar", detalle: "sin arnés para fallas en Python" }); continue; }
    const arn = fenceByLang(arnes, "javascript");
    const sol = fenceByLang(solucion, "javascript");
    const ing = fenceByLang(ingenua, "javascript");
    const fn = fnNameOf(fenceByLang(firma, "javascript"));
    if (!arn || !sol || !ing || !Array.isArray(calendarios)) { entries.push({ lenguaje: "javascript", ok: false, detalle: "faltan secciones de fallas" }); continue; }
    const grade = (code) => {
      const program = `${code}\n;\n${arn}`;
      const r = run(program, "arnes", calendarios.map((c) => [c]));
      if (r.timedOut) return { fail: "(todos): tiempo" };
      if (r.syntaxError) return { fail: `(todos): ${r.syntaxError}` };
      for (let i = 0; i < calendarios.length; i++) {
        const c = r.cases[i];
        const espera = calendarios[i].espera;
        if (!c || c.error !== undefined) return { fail: `«${calendarios[i].nombre}»: ${c?.error ?? "sin resultado"}` };
        const o = c.output;
        const fallan = Object.keys(espera).filter((k) => !o || o[k] !== espera[k]);
        if (fallan.length) return { fail: `«${calendarios[i].nombre}»: ${fallan.join(", ")}` };
      }
      return { ok: true };
    };
    const sg = grade(sol);
    if (sg.fail) { entries.push({ lenguaje: "javascript", ok: false, detalle: `la solución falla el calendario ${sg.fail}` }); continue; }
    const ig = grade(ing);
    if (ig.ok) { entries.push({ lenguaje: "javascript", ok: false, detalle: "la ingenua pasa todos los calendarios: no hay nada que distinguir" }); continue; }
    entries.push({ lenguaje: "javascript", ok: true });
  }
  return entries;
}

export const JS_VERIFIERS = {
  contraejemplo: verifyContraejemplo,
  mutantes: verifyMutantes,
  historial: verifyHistorial,
};
