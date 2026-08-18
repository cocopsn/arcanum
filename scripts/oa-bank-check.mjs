#!/usr/bin/env node
// STANDALONE checker for OA exercise banks (content/exercises/oa-*.md) — the fast red/green loop for
// bank AUTHORS (humans or agents). It re-implements just enough of the contract to catch the killers
// early: frontmatter shape, fence balance, per-type required sections, exactly-one-[x] choices, the
// MANDATORY `tiempo:` line (OA banks are timed drills), and — the heart — EXECUTES every code
// exercise's reference solution against its own JSON cases in BOTH languages (JS via node:vm, Python
// via the local `py -3`). The final authority stays the real parser + vitest round-trip
// (src/lib/oa-banks.test.ts); this script exists so a broken reference never even reaches it.
// Usage: node scripts/oa-bank-check.mjs content/exercises/oa-4.md [more.md…]
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import vm from "node:vm";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("uso: node scripts/oa-bank-check.mjs <banco.md> [...]");
  process.exit(2);
}

const fail = (msg) => ({ ok: false, msg });
const okey = () => ({ ok: true });

function splitBlocks(lines, level) {
  const re = new RegExp(`^#{${level}}\\s+(.*)$`);
  const out = [];
  let cur = null;
  let inFence = false;
  const pre = [];
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const m = !inFence ? line.match(re) : null;
    if (m) {
      if (cur) out.push(cur);
      cur = { heading: m[1].trim(), body: [] };
    } else if (cur) cur.body.push(line);
    else pre.push(line);
  }
  if (cur) out.push(cur);
  return { pre, out };
}
function fences(lines) {
  const res = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^\s*(?:```|~~~)\s*([A-Za-z0-9_+-]*)\s*$/);
    if (m) {
      if (cur) {
        res.push(cur);
        cur = null;
      } else cur = { lang: (m[1] || "").toLowerCase(), code: [] };
    } else if (cur) cur.code.push(line);
  }
  return res.map((f) => ({ lang: f.lang, code: f.code.join("\n") }));
}
const section = (secs, names) => {
  const nm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const found = secs.find((s) => names.some((n) => nm(s.heading) === n || nm(s.heading).startsWith(n)));
  return found ? found.body : null;
};
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function runJsCases(solution, fnName, cases) {
  const ctx = vm.createContext({});
  try {
    vm.runInContext(solution, ctx, { timeout: 3000 });
  } catch (e) {
    return [fail(`JS no parsea/ejecuta: ${e.message}`)];
  }
  const fn = ctx[fnName];
  if (typeof fn !== "function") return [fail(`JS: función ${fnName} no definida tras evaluar la solución`)];
  return cases.map((c, i) => {
    try {
      const out = vm.runInContext("__fn(...__args)", Object.assign(ctx, { __fn: fn, __args: c.input }), { timeout: 3000 });
      return deepEq(out, c.expected) ? okey() : fail(`JS caso ${i}: input=${JSON.stringify(c.input)} esperado=${JSON.stringify(c.expected)} obtuvo=${JSON.stringify(out)}`);
    } catch (e) {
      return fail(`JS caso ${i} lanzó: ${e.message}`);
    }
  });
}

function runPyCases(solution, fnName, cases, tmp) {
  const py = join(tmp, `chk-${Math.random().toString(36).slice(2)}.py`);
  const harness = `${solution}\n\nimport json, sys\ncases = json.loads(sys.argv[1])\nbad = []\nfor i, c in enumerate(cases):\n    try:\n        out = ${fnName}(*c["input"])\n    except Exception as e:\n        bad.append(f"PY caso {i} lanzo: {e}")\n        continue\n    if not (out == c["expected"]):\n        bad.append(f"PY caso {i}: input={json.dumps(c['input'])} esperado={json.dumps(c['expected'])} obtuvo={json.dumps(out, default=str)}")\nprint(json.dumps(bad))\n`;
  writeFileSync(py, harness, "utf8");
  try {
    const out = execFileSync("py", ["-3", py, JSON.stringify(cases)], { timeout: 30000, encoding: "utf8" });
    const bad = JSON.parse(out.trim().split("\n").pop());
    return bad.length ? bad.map((b) => fail(b)) : [okey()];
  } catch (e) {
    return [fail(`PY no corrió: ${(e.stderr || e.message || "").toString().slice(0, 300)}`)];
  }
}

let anyFail = false;
const tmp = mkdtempSync(join(tmpdir(), "oa-bank-"));
for (const file of files) {
  const raw = readFileSync(file, "utf8");
  const errors = [];
  const fm = raw.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fm) {
    console.error(`✗ ${file}: sin frontmatter`);
    anyFail = true;
    continue;
  }
  const meta = Object.fromEntries(
    fm[1]
      .split(/\r?\n/)
      .map((l) => l.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, "")]),
  );
  if (meta.kind !== "exercises") errors.push("kind debe ser exercises");
  if (!/^ce000000-/.test(meta.module_id || "")) errors.push(`module_id debe ser el UUID ce… de la celda (vino: ${meta.module_id})`);
  const bodyLines = fm[2].split(/\r?\n/);
  const fenceCount = bodyLines.filter((l) => /^\s*(```|~~~)/.test(l)).length;
  if (fenceCount % 2 !== 0) errors.push(`fences desbalanceados (${fenceCount} marcadores — debe ser par)`);

  const { out: blocks } = splitBlocks(bodyLines, 2);
  if (blocks.length === 0) errors.push("cero ejercicios");
  let nCode = 0, nChoice = 0, nProd = 0;
  for (const b of blocks) {
    const { pre, out: subs } = splitBlocks(b.body, 3);
    const typeLine = pre.find((l) => /^\s*type\s*:/i.test(l));
    const type = typeLine ? typeLine.replace(/^\s*type\s*:/i, "").trim().toLowerCase() : null;
    const tiempo = pre.find((l) => /^\s*tiempo\s*:\s*\d+/.test(l));
    if (!type) errors.push(`«${b.heading}»: sin type:`);
    if (!tiempo) errors.push(`«${b.heading}»: sin tiempo: N (obligatorio en bancos OA — drill cronometrado)`);
    const prompt = pre.filter((l) => l !== typeLine && l !== tiempo).join("\n").trim();
    if (!prompt) errors.push(`«${b.heading}»: enunciado vacío`);

    if (type === "code") {
      nCode++;
      const firma = section(subs, ["firma", "signature"]);
      const casos = section(subs, ["casos", "cases", "test cases"]);
      const sol = section(subs, ["solucion", "solution", "referencia"]);
      if (!firma || !casos || !sol) {
        errors.push(`«${b.heading}»: code requiere Firma+Casos+Solución`);
        continue;
      }
      const caseFence = fences(casos).find((f) => f.lang === "json") ?? fences(casos)[0];
      let cases;
      try {
        cases = JSON.parse(caseFence?.code ?? "");
      } catch {
        errors.push(`«${b.heading}»: Casos no es JSON válido`);
        continue;
      }
      if (!Array.isArray(cases) || cases.length < 6) errors.push(`«${b.heading}»: se exigen ≥6 casos (tiene ${Array.isArray(cases) ? cases.length : 0}) — incluye edge cases`);
      const sols = fences(sol);
      const sigs = fences(firma);
      for (const lang of ["javascript", "python"]) {
        const key = lang === "javascript" ? ["javascript", "js"] : ["python", "py"];
        const s = sols.find((f) => key.includes(f.lang));
        const g = sigs.find((f) => key.includes(f.lang));
        if (!s || !g) {
          errors.push(`«${b.heading}»: falta firma o solución ${lang} (los bancos OA llevan AMBOS lenguajes)`);
          continue;
        }
        const fnName =
          lang === "python"
            ? (s.code.match(/def\s+([A-Za-z_]\w*)\s*\(/) || [])[1]
            : (s.code.match(/function\s+([A-Za-z_$][\w$]*)\s*\(/) || [])[1];
        if (!fnName) {
          errors.push(`«${b.heading}» (${lang}): no se pudo derivar el nombre de función`);
          continue;
        }
        const real = cases.filter((c) => !c.hint);
        const results = lang === "javascript" ? runJsCases(s.code, fnName, real) : runPyCases(s.code, fnName, real, tmp);
        for (const r of results) if (!r.ok) errors.push(`«${b.heading}»: ${r.msg}`);
      }
    } else if (["multiple_choice", "choice", "complexity", "complejidad", "trace", "trazar"].includes(type)) {
      nChoice++;
      const ops = (section(subs, ["opciones", "options"]) ?? []).map((l) => l.trim()).filter((l) => /^[-*+]\s+/.test(l));
      const marked = ops.filter((o) => /^[-*+]\s+\[\s*[xX]\s*\]/.test(o));
      if (ops.length < 3) errors.push(`«${b.heading}»: se exigen ≥3 opciones (tiene ${ops.length})`);
      if (marked.length !== 1) errors.push(`«${b.heading}»: exactamente UNA opción [x] (tiene ${marked.length})`);
      if (marked[0] && !marked[0].replace(/^[-*+]\s+\[\s*[xX]\s*\]\s*/, "").trim()) errors.push(`«${b.heading}»: la opción [x] está vacía`);
      const just = (section(subs, ["justificacion", "justification", "por que"]) ?? []).join("\n").trim();
      if (just.length < 120) errors.push(`«${b.heading}»: justificación floja (<120 chars) — debe explicar la correcta Y por qué fallan las otras`);
    } else if (["production", "produccion", "producir"].includes(type)) {
      nProd++;
      for (const [names, label] of [[["modelo", "model"], "Modelo"], [["regla", "rule"], "Regla"], [["rubrica", "autoevaluacion", "criterios"], "Rúbrica"]]) {
        const s = section(subs, names);
        if (!s || !s.join("\n").trim()) errors.push(`«${b.heading}»: production sin ${label}`);
      }
    } else if (type) {
      errors.push(`«${b.heading}»: type desconocido «${type}»`);
    }
  }

  const label = `${file} → ${blocks.length} ejercicios (${nCode} code · ${nChoice} choice · ${nProd} production)`;
  if (errors.length) {
    anyFail = true;
    console.error(`✗ ${label}`);
    for (const e of errors) console.error(`   - ${e}`);
  } else {
    console.log(`✓ ${label}`);
  }
}
rmSync(tmp, { recursive: true, force: true });
process.exit(anyFail ? 1 : 0);
