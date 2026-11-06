#!/usr/bin/env node
// bank-check — runs the REFERENCES of a Forge bank (content/forge/exercises/<code>.md) on this machine and writes
// the registered run content/forge/verification/<code>.json (design §5.7; same pattern as scripts/oa-bank-check.mjs).
// The app's seed trust rule (§9.2) leans on this file: at seed time the app never runs Python or SQL again.
//
// Usage: node scripts/forge/bank-check.mjs <CODE> [<CODE>…] | --all
//
// What it runs:
//   - `code` items: the JS reference with node:vm (fresh context per item, no require/process, timeout 3000 ms,
//     the same limit as runJs) and the Python reference with the local CPython, over `### Casos` and, when present,
//     `### Generador` + `### Casos generados` with `### Comprobador` (check(args, salida, esperado)).
//   - Items of the other executing types (sql, forense, historial, mutantes, contraejemplo) and of any type that has
//     a harness: the per-type harness scripts/forge/bank-check/<tipo>.py, owned by the type's branch. Without a
//     harness, an item with python/sql/javascript fences is recorded «sin-verificar» (never «paso»).
//
// Harness contract (frozen, phase 0): stdin = one JSON
//   { v: 1, code, id, tipo, titulo, enunciado, secciones: [{ titulo, cuerpo, cercas: [{ lenguaje, codigo }] }] }
// stdout, last line = { "resultados": [{ "lenguaje": "python"|"sql"|"javascript", "ok": bool, "detalle"?: str }] }.
// A non-zero exit or unreadable output is a «fallo» with the first 300 chars of stderr.
//
// verification/<code>.json (frozen, phase 0):
//   { v: 1, code, sha10 (sha256[:10] of the .md bytes), versiones: { python, sqlite, node },
//     items: [{ id, tipo, lenguaje, resultado: "paso"|"fallo"|"sin-verificar", ms, detalle? }],
//     resumen: { ejecutables, cubiertos, fallidos, sin_verificar } }
// One entry per (item, language). ejecutables = entries; cubiertos = «paso». Exit 1 if any «fallo» or bad bank.
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const EXEC_TYPES = new Set(["code", "sql", "forense", "historial", "mutantes", "contraejemplo"]);
const JS_TIMEOUT = 3000;

export const sha10 = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 10);
const nm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const slug = (s) => nm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function splitBlocks(lines, level) {
  const re = new RegExp(`^#{${level}}\\s+(.*)$`);
  const out = [];
  const pre = [];
  let cur = null;
  let fence = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const m = !fence ? line.match(re) : null;
    if (m) {
      if (cur) out.push(cur);
      cur = { heading: m[1].trim(), body: [] };
    } else if (cur) cur.body.push(line);
    else pre.push(line);
  }
  if (cur) out.push(cur);
  return { pre, out };
}

export function fences(lines) {
  const res = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^\s*(?:```|~~~)\s*([A-Za-z0-9_+-]*)\s*$/);
    if (m) {
      if (cur) {
        res.push({ lenguaje: cur.lang, codigo: cur.code.join("\n") });
        cur = null;
      } else cur = { lang: (m[1] || "").toLowerCase(), code: [] };
    } else if (cur) cur.code.push(line);
  }
  return res;
}

const LANG = { js: "javascript", javascript: "javascript", py: "python", python: "python", sql: "sql" };

/** Parse a bank into items (pure). Throws with a message on a bad bank. */
export function parseBank(md) {
  if (md.charCodeAt(0) === 0xfeff) throw new Error("el banco empieza con BOM");
  const fm = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fm) throw new Error("sin frontmatter");
  const meta = Object.fromEntries(
    fm[1].split(/\r?\n/).map((l) => l.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, "")]),
  );
  if (meta.kind !== "exercises") throw new Error("kind debe ser exercises");
  if (!meta.module_id) throw new Error("sin module_id");
  const body = fm[2].split(/\r?\n/);
  if (body.filter((l) => /^\s*(```|~~~)/.test(l)).length % 2) throw new Error("cercas desbalanceadas");
  const { out: blocks } = splitBlocks(body, 2);
  if (!blocks.length) throw new Error("cero ejercicios");
  const seen = new Set();
  return blocks.map((b) => {
    const { pre, out: subs } = splitBlocks(b.body, 3);
    const typeLine = pre.find((l) => /^\s*type\s*:/i.test(l));
    const idLine = pre.find((l) => /^\s*id\s*:/i.test(l));
    const tipo = typeLine ? typeLine.replace(/^\s*type\s*:/i, "").trim().toLowerCase() : "";
    let id = idLine ? idLine.replace(/^\s*id\s*:/i, "").trim() : slug(b.heading);
    for (let n = 2; seen.has(id); n++) id = `${id}-${n}`;
    seen.add(id);
    const enunciado = pre.filter((l) => !/^\s*(type|id|rol|tiempo)\s*:/i.test(l)).join("\n").trim();
    const secciones = subs.map((s) => ({ titulo: s.heading, cuerpo: s.body.join("\n").trim(), cercas: fences(s.body) }));
    return { id, tipo, titulo: b.heading, enunciado, secciones };
  });
}

const section = (item, names) => item.secciones.find((s) => names.some((n) => nm(s.titulo) === n || nm(s.titulo).startsWith(n)));
const fenceOf = (sec, lang) => sec?.cercas.find((c) => LANG[c.lenguaje] === lang);
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function jsonFence(sec) {
  const f = sec?.cercas.find((c) => c.lenguaje === "json") ?? sec?.cercas[0];
  return f ? JSON.parse(f.codigo) : null;
}

/** JS reference of a `code` item under node:vm. Returns { ok, detalle? }. */
export function runJsCode({ solution, cases, generator, checker, generated }) {
  const ctx = vm.createContext({});
  try {
    vm.runInContext(solution, ctx, { timeout: JS_TIMEOUT });
    if (generator) vm.runInContext(generator, ctx, { timeout: JS_TIMEOUT });
    if (checker) vm.runInContext(checker, ctx, { timeout: JS_TIMEOUT });
  } catch (e) {
    return { ok: false, detalle: `JS no parsea o no ejecuta: ${e.message}` };
  }
  const fnName = (solution.match(/function\s+([A-Za-z_$][\w$]*)\s*\(/) || solution.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/) || [])[1];
  const fn = fnName ? ctx[fnName] ?? vm.runInContext(`typeof ${fnName} === "function" ? ${fnName} : undefined`, ctx) : undefined;
  if (typeof fn !== "function") return { ok: false, detalle: `JS: función ${fnName ?? "?"} no definida` };
  const check = checker ? vm.runInContext("typeof check === 'function' ? check : undefined", ctx) : undefined;
  const same = (args, out, exp) => (check ? Boolean(vm.runInContext("__c(__a, __o, __e)", Object.assign(ctx, { __c: check, __a: args, __o: out, __e: exp }), { timeout: JS_TIMEOUT })) : deepEq(out, exp));
  try {
    for (const [i, c] of cases.entries()) {
      const out = vm.runInContext("__fn(...__args)", Object.assign(ctx, { __fn: fn, __args: c.input }), { timeout: JS_TIMEOUT });
      if (!same(c.input, out, c.expected)) return { ok: false, detalle: `JS caso ${i}: esperado ${JSON.stringify(c.expected)} obtuvo ${JSON.stringify(out)}`.slice(0, 300) };
    }
    if (generated?.length) {
      const gen = vm.runInContext("typeof generate === 'function' ? generate : undefined", ctx);
      if (typeof gen !== "function") return { ok: false, detalle: "JS: hay casos generados sin generate(seed)" };
      for (const [i, g] of generated.entries()) {
        const args = vm.runInContext("__g(__s)", Object.assign(ctx, { __g: gen, __s: g.semilla }), { timeout: JS_TIMEOUT });
        const out = vm.runInContext("__fn(...__args)", Object.assign(ctx, { __fn: fn, __args: args }), { timeout: JS_TIMEOUT });
        if (!same(args, out, g.esperado)) return { ok: false, detalle: `JS caso generado ${i} (semilla ${g.semilla}) no coincide` };
      }
    }
  } catch (e) {
    return { ok: false, detalle: `JS lanzó: ${e.message}`.slice(0, 300) };
  }
  return { ok: true };
}

let PY = undefined;
/** The local CPython: `python`, else `py -3`. Returns { cmd, args, python, sqlite } or null. */
export function findPython() {
  if (PY !== undefined) return PY;
  PY = null;
  for (const [cmd, args] of [["python", []], ["py", ["-3"]]]) {
    try {
      const out = execFileSync(cmd, [...args, "-c", "import sys,sqlite3,json;print(json.dumps([sys.version.split()[0], sqlite3.sqlite_version]))"], { encoding: "utf8", timeout: 20000 });
      const [python, sqlite] = JSON.parse(out.trim().split(/\r?\n/).pop());
      PY = { cmd, args, python, sqlite };
      break;
    } catch {
      /* try the next one */
    }
  }
  return PY;
}

const PY_CODE_HARNESS = `
import json, sys
spec = json.loads(sys.stdin.read())
ns = {}
exec(spec["solution"], ns)
if spec.get("generator"): exec(spec["generator"], ns)
if spec.get("checker"): exec(spec["checker"], ns)
fn = ns.get(spec["fn"])
if not callable(fn):
    print(json.dumps({"ok": False, "detalle": "PY: funcion " + spec["fn"] + " no definida"})); sys.exit(0)
chk = ns.get("check") if spec.get("checker") else None
def same(a, o, e):
    return bool(chk(a, o, e)) if chk else o == e
for i, c in enumerate(spec["cases"]):
    out = fn(*c["input"])
    if not same(c["input"], out, c["expected"]):
        print(json.dumps({"ok": False, "detalle": "PY caso %d: esperado %s obtuvo %s" % (i, json.dumps(c["expected"]), json.dumps(out, default=str))})); sys.exit(0)
for i, g in enumerate(spec.get("generated") or []):
    gen = ns.get("generate")
    if not callable(gen):
        print(json.dumps({"ok": False, "detalle": "PY: hay casos generados sin generate(seed)"})); sys.exit(0)
    args = gen(g["semilla"])
    out = fn(*args)
    if not same(args, out, g["esperado"]):
        print(json.dumps({"ok": False, "detalle": "PY caso generado %d no coincide" % i})); sys.exit(0)
print(json.dumps({"ok": True}))
`;

function runPython(scriptPath, stdinObj, timeout) {
  const py = findPython();
  if (!py) return { ok: false, detalle: "no hay CPython local (python o py -3)" };
  const r = spawnSync(py.cmd, [...py.args, scriptPath], { input: JSON.stringify(stdinObj), encoding: "utf8", timeout, env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
  if (r.error) return { ok: false, detalle: `PY no corrió: ${r.error.message}`.slice(0, 300) };
  if (r.status !== 0) return { ok: false, detalle: `PY salió con ${r.status}: ${(r.stderr || "").slice(0, 300)}` };
  try {
    return { ok: true, out: JSON.parse(r.stdout.trim().split(/\r?\n/).pop()) };
  } catch {
    return { ok: false, detalle: `salida ilegible: ${(r.stdout || "").slice(0, 200)}` };
  }
}

function timed(f) {
  const t0 = performance.now();
  const r = f();
  return { ...r, ms: Math.round(performance.now() - t0) };
}

/** Verify one parsed item. Returns the verification entries for it (possibly none). */
export function verifyItem(code, item, { harnessDir, tmp }) {
  const entries = [];
  const push = (lenguaje, r) => entries.push({ id: item.id, tipo: item.tipo, lenguaje, resultado: r.resultado, ms: r.ms ?? 0, ...(r.detalle ? { detalle: r.detalle } : {}) });
  if (item.tipo === "code") {
    const sol = section(item, ["solucion", "solution", "referencia"]);
    let cases;
    let generated = null;
    try {
      cases = jsonFence(section(item, ["casos", "cases", "test cases"])) ?? [];
      const g = section(item, ["casos generados"]);
      generated = g ? jsonFence(g) : null;
    } catch {
      push("json", { resultado: "fallo", detalle: "Casos no es JSON válido" });
      return entries;
    }
    cases = (Array.isArray(cases) ? cases : []).filter((c) => !c.hint);
    const gen = section(item, ["generador"]);
    const chk = section(item, ["comprobador"]);
    const langs = [...new Set((sol?.cercas ?? []).map((c) => LANG[c.lenguaje]).filter((l) => l === "javascript" || l === "python"))];
    if (!sol || langs.length === 0) {
      push("desconocido", { resultado: "fallo", detalle: "code sin solución de referencia en JavaScript o Python" });
      return entries;
    }
    for (const lang of langs) {
      const spec = { solution: fenceOf(sol, lang).codigo, cases, generator: fenceOf(gen, lang)?.codigo, checker: fenceOf(chk, lang)?.codigo, generated };
      if (lang === "javascript") {
        const r = timed(() => runJsCode(spec));
        push(lang, { resultado: r.ok ? "paso" : "fallo", ms: r.ms, detalle: r.detalle });
      } else {
        const fn = (spec.solution.match(/def\s+([A-Za-z_]\w*)\s*\(/) || [])[1];
        const hp = path.join(tmp, "code_harness.py");
        if (!existsSync(hp)) writeFileSync(hp, PY_CODE_HARNESS, "utf8");
        const r = timed(() => {
          if (!fn) return { ok: false, detalle: "PY: no se pudo derivar el nombre de la función" };
          const x = runPython(hp, { ...spec, fn }, 60000);
          return x.ok ? { ok: x.out.ok === true, detalle: x.out.detalle } : x;
        });
        push(lang, { resultado: r.ok ? "paso" : "fallo", ms: r.ms, detalle: r.detalle });
      }
    }
    return entries;
  }
  const harness = path.join(harnessDir, `${item.tipo}.py`);
  const langs = [...new Set(item.secciones.flatMap((s) => s.cercas.map((c) => LANG[c.lenguaje])).filter(Boolean))];
  const hasHarness = item.tipo && existsSync(harness);
  if (!hasHarness && !EXEC_TYPES.has(item.tipo)) return entries;
  if (!hasHarness) {
    for (const l of langs) push(l, { resultado: "sin-verificar", detalle: `sin arnés scripts/forge/bank-check/${item.tipo}.py` });
    return entries;
  }
  const t0 = performance.now();
  const x = runPython(harness, { v: 1, code, id: item.id, tipo: item.tipo, titulo: item.titulo, enunciado: item.enunciado, secciones: item.secciones }, 60000);
  const ms = Math.round(performance.now() - t0);
  if (!x.ok) {
    push(langs[0] ?? "python", { resultado: "fallo", ms, detalle: x.detalle });
    return entries;
  }
  const res = Array.isArray(x.out?.resultados) ? x.out.resultados : null;
  if (!res) push(langs[0] ?? "python", { resultado: "fallo", ms, detalle: "el arnés no devolvió resultados" });
  else for (const r of res) push(r.lenguaje ?? "python", { resultado: r.ok === true ? "paso" : "fallo", ms, detalle: r.detalle });
  return entries;
}

export function checkBank(root, code) {
  const base = code.toLowerCase();
  const file = path.join(root, "content/forge/exercises", `${base}.md`);
  if (!existsSync(file)) return { ok: false, error: `no existe content/forge/exercises/${base}.md` };
  const buf = readFileSync(file);
  let items;
  try {
    items = parseBank(buf.toString("utf8"));
  } catch (e) {
    return { ok: false, error: `${base}.md: ${e.message}` };
  }
  const tmp = mkdtempSync(path.join(tmpdir(), "forge-bank-"));
  try {
    const entries = items.flatMap((it) => verifyItem(code.toUpperCase(), it, { harnessDir: path.join(root, "scripts/forge/bank-check"), tmp }));
    const py = findPython();
    const ver = {
      v: 1,
      code: code.toUpperCase(),
      sha10: sha10(buf),
      versiones: { python: py?.python ?? null, sqlite: py?.sqlite ?? null, node: process.version },
      items: entries,
      resumen: {
        ejecutables: entries.length,
        cubiertos: entries.filter((e) => e.resultado === "paso").length,
        fallidos: entries.filter((e) => e.resultado === "fallo").length,
        sin_verificar: entries.filter((e) => e.resultado === "sin-verificar").length,
      },
    };
    const outDir = path.join(root, "content/forge/verification");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, `${base}.json`), JSON.stringify(ver, null, 1) + "\n");
    return { ok: ver.resumen.fallidos === 0, ver };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const ri = argv.indexOf("--root");
  const root = ri >= 0 ? path.resolve(argv[ri + 1]) : ROOT;
  const args = ri >= 0 ? argv.filter((_, i) => i !== ri && i !== ri + 1) : argv;
  let codes = args.filter((a) => !a.startsWith("--"));
  if (args.includes("--all")) {
    const dir = path.join(root, "content/forge/exercises");
    codes = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md")).sort().map((f) => f.replace(/\.md$/, "").toUpperCase()) : [];
  }
  if (!codes.length && !args.includes("--all")) {
    console.error("uso: node scripts/forge/bank-check.mjs <CÓDIGO> [...] | --all");
    process.exit(2);
  }
  let bad = false;
  for (const c of codes) {
    const r = checkBank(root, c);
    if (r.error) {
      bad = true;
      console.error(`✕ ${c}: ${r.error}`);
      continue;
    }
    const s = r.ver.resumen;
    const line = `${c} · ${s.ejecutables} ejecutables · ${s.cubiertos} pasan · ${s.fallidos} fallan · ${s.sin_verificar} sin verificar`;
    if (!r.ok) {
      bad = true;
      console.error(`✕ ${line}`);
      for (const e of r.ver.items.filter((x) => x.resultado === "fallo")) console.error(`   - ${e.id} (${e.lenguaje}): ${e.detalle ?? "falló"}`);
    } else console.log(`✓ ${line}`);
  }
  console.log(`[bank-check] ${codes.length} bancos`);
  process.exit(bad ? 1 : 0);
}
