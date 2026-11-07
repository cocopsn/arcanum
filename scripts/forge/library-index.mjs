#!/usr/bin/env node
// library-index: índice de Lecturas → src/forge/data/library-index.json (design poblar §5.2). GENERADO (en .gitignore).
// Corre después de books-publish.mjs, antes de dev, build, test y typecheck (package.json), y solo como
// `pnpm forge:library-index`.
//
// Lee las rutas (src/forge/data/routes/*.json), book-index.json, los libros y bancos de content/forge, los archivos de
// verificación y el fuente de los chequeos (src/forge/bank/check/*.ts). Sin caché: cada corrida reescribe el índice
// entero, así que ningún cambio de libro, banco, ficha o chequeo deja un índice viejo. Determinista (orden por código,
// sin fechas). Falla con código 1 si un banco no parsea con parseBank. Sólo títulos, minutos, conteos, estados y
// generated_by: ninguna línea de prosa de un libro ni el enunciado de un ítem.
//
// Las reglas de autoría son las de src/forge/model/authoring.ts, en el mismo orden; la paridad la comprueba
// src/forge/__tests__/library-index.test.ts contra authoringState() y contra la ingesta real (validateBank).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBank } from "./bank-check.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const EXEC_LANG = new Set(["js", "javascript", "mjs", "py", "python", "python3", "sql", "sqlite"]);
const CODIGO_TYPES = new Set(["code", "choice", "production"]);
const sha10 = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 10);

/** Quita un par de comillas exteriores y los espacios, como parseBook y parseExercisesMd. */
export function unquote(s) {
  const t = String(s ?? "").trim();
  if (t.length >= 2 && ((t[0] === '"' && t[t.length - 1] === '"') || (t[0] === "'" && t[t.length - 1] === "'"))) return t.slice(1, -1).trim();
  return t;
}

/** Frontmatter `clave: valor` de un .md, con los valores sin comillas exteriores. */
export function frontmatter(md) {
  const m = String(md).match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/);
  const out = {};
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (kv) out[kv[1]] = unquote(kv[2]);
  }
  return out;
}

/** Igual que fichaComplete de authoring.ts. */
export function fichaComplete(cell) {
  const f = cell.ficha;
  if (!f || !String(f.mision ?? "").trim() || !String(f.defensa ?? "").trim()) return false;
  if (cell.cls === "ruta") return Array.isArray(f.fuentes) && f.fuentes.length > 0 && !!(String(f.foco ?? "").trim() || String(f.resultado ?? "").trim());
  return true;
}

/** Tipos cuyo módulo de chequeo es todavía el stub de la Fase 0 (nombra stubCheck). */
function stubTypes(root) {
  const dir = path.join(root, "src/forge/bank/check");
  const out = new Set();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!/^[a-z]+\.ts$/.test(f)) continue;
    if (readFileSync(path.join(dir, f), "utf8").includes("stubCheck")) out.add(f.replace(/\.ts$/, ""));
  }
  return out;
}

/** Pendientes de un banco (regla de §9.2): tipos cuyo chequeo es todavía el stub. Ids pelados. */
export function bankPendientes(items, stubs) {
  return items.filter((it) => stubs.has(it.tipo)).map((it) => it.id);
}

/** Ítems con algún paso JavaScript, Python o SQL (executableItems de authoring.ts). */
export function executableIds(items) {
  return items.filter((it) => it.secciones.some((s) => s.cercas.some((c) => EXEC_LANG.has(String(c.lenguaje).trim().toLowerCase())))).map((it) => it.id);
}

/** unverifiedItems de authoring.ts. */
export function unverifiedIds(exec, bankSha10, verification) {
  if (!verification || verification.sha10 !== bankSha10) return exec;
  return exec.filter((id) => {
    const entries = (verification.items ?? []).filter((e) => e.id === id);
    return entries.length === 0 || entries.some((e) => e.resultado !== "paso");
  });
}

function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

/** Construye el índice (sin escribirlo). Lanza con un mensaje que nombra el banco si uno no parsea. */
export function buildLibraryIndex(root = ROOT) {
  const routesDir = path.join(root, "src/forge/data/routes");
  const bookIndexPath = path.join(root, "src/forge/data/book-index.json");
  const bookIndex = existsSync(bookIndexPath) ? readJson(bookIndexPath) : {};
  const stubs = stubTypes(root);
  const celdas = {};
  const files = readdirSync(routesDir).filter((f) => f.endsWith(".json")).sort();
  const cells = [];
  for (const f of files) {
    const route = readJson(path.join(routesDir, f));
    for (const cell of route.cells ?? []) if (cell.cls === "ruta" || cell.cls === "expediente") cells.push({ route, cell });
  }
  cells.sort((a, b) => a.cell.code.localeCompare(b.cell.code));
  for (const { route, cell } of cells) {
    const code = cell.code;
    const low = code.toLowerCase();
    const entry = bookIndex[code] ?? null;
    let libro = null;
    if (entry) {
      const src = path.join(root, "content/forge/books", `${low}.md`);
      const fm = existsSync(src) ? frontmatter(readFileSync(src, "utf8")) : {};
      libro = {
        file: entry.file,
        sha10: entry.sha10,
        bytes: entry.bytes,
        minutes: Number.isFinite(entry.minutes) ? entry.minutes : null,
        title: entry.title,
        generated_by: fm.generated_by ?? "",
        estado_declarado: fm.estado ?? "",
      };
    }
    let banco = null;
    let items = [];
    const bankPath = path.join(root, "content/forge/exercises", `${low}.md`);
    if (existsSync(bankPath)) {
      const buf = readFileSync(bankPath);
      const md = buf.toString("utf8");
      try {
        items = parseBank(md);
      } catch (e) {
        throw new Error(`${code}: el banco no parsea con parseBank (${e instanceof Error ? e.message : String(e)})`);
      }
      const fm = frontmatter(md);
      banco = {
        sha10: sha10(buf),
        title: fm.title ?? "",
        generated_by: fm.generated_by ?? "",
        items: items.length,
        pendientes: bankPendientes(items, stubs),
        codigo: items.some((it) => CODIGO_TYPES.has(it.tipo)),
      };
    }
    const verPath = path.join(root, "content/forge/verification", `${low}.json`);
    const verification = existsSync(verPath) ? readJson(verPath) : null;
    const exec = banco ? executableIds(items) : [];
    const sinVerificar = banco ? unverifiedIds(exec, banco.sha10, verification) : [];
    let estado = null;
    if (fichaComplete(cell)) {
      if (cell.cls === "ruta") {
        if (!(libro && banco)) estado = "especificado";
        else estado = banco.pendientes.length === 0 && exec.length > 0 && sinVerificar.length === 0 ? "verificado" : "autorado";
      } else {
        estado = libro && cell.sd && String(cell.sd.decision ?? "").trim() && String(cell.sd.entregable ?? "").trim() ? "autorado" : "especificado";
      }
    }
    celdas[code] = {
      ruta: route.slug,
      cls: cell.cls,
      libro,
      banco,
      autoria: { estado, ejecutables: exec.length, sin_verificar: sinVerificar.length },
    };
  }
  return { v: 1, celdas };
}

/** Escribe src/forge/data/library-index.json bajo `root`. */
export function writeLibraryIndex(root = ROOT) {
  const index = buildLibraryIndex(root);
  const dataDir = path.join(root, "src/forge/data");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(path.join(dataDir, "library-index.json"), JSON.stringify(index) + "\n");
  const vals = Object.values(index.celdas);
  return {
    ok: true,
    celdas: vals.length,
    libros: vals.filter((c) => c.libro).length,
    bancos: vals.filter((c) => c.banco).length,
    porEstado: vals.reduce((o, c) => ((o[c.autoria.estado ?? "incompleta"] = (o[c.autoria.estado ?? "incompleta"] ?? 0) + 1), o), {}),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = writeLibraryIndex();
    console.log(`[library-index] ${r.celdas} celdas · ${r.libros} libros · ${r.bancos} bancos · ${JSON.stringify(r.porEstado)}`);
  } catch (e) {
    console.error(`[library-index] ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
