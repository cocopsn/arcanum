#!/usr/bin/env node
// budget — puerta de presupuesto del compañero sobre un build de producción (design §8.6, CA-16, DP-3). Corre después
// de `pnpm build`, como scripts/forge/budget-report.mjs. Falla (exit 1) con la lista de excesos y escribe el reporte.
//
// Uso: node scripts/companion/budget.mjs [--base <bytes>] [--esperar ui,idx,reservado,forge,diagrama,pdf,practica]
//        [--root <repo>] [--next <dir>] [--out <archivo.json>]
//   --base     suma del JS inicial de /page en el build de origin/main (o COMPANION_BASE_PAGINA). Sin base: aviso.
//   --esperar  familias de chunks que ya deben existir (por omisión, todas; «ninguno» para ninguna).
//   --out      por omisión budget-companion.json en la carpeta de la tarea si existe, si no en <next>/.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { precacheUrls } from "../forge/budget-report.mjs";

const KiB = 1024;
const MiB = 1024 * 1024;
export const TECHOS = {
  crecimientoPagina: 8 * KiB,
  perezoso: 320 * KiB,
  particion: 256 * KiB,
  indice: 2.5 * MiB,
};
/** Familias de chunks del compañero (§8.6, tabla) y su chunk; `idx` es uno por partición del MANIFIESTO. */
export const FAMILIAS = ["ui", "idx", "reservado", "forge", "diagrama", "pdf", "practica"];
const PEREZOSOS = { ui: "companion-ui", forge: "companion-forge", diagrama: "companion-diagrama", pdf: "companion-pdf", practica: "companion-practica" };
/** Literales que cada módulo perezoso usa en tiempo de ejecución; ninguno puede estar en el JS inicial de /page. */
export const CENTINELAS = ["cmp-ui-v1", "cmp-diagrama-v1", "cmp-pdf-v1", "cmp-practica-v1", "arcanum-companion-index/1", "arcanum-companion-reservado/1"];
/** Lo que sí debe estar en la página una vez montado el compañero (el id del contenedor). */
export const MONTAJE = "arcanum-companion";
const TAREA = "d:/projects/auctorum-systems/.agents/tasks/arcanum-companion";

/** @param {string} s */
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * MANIFIESTO de particiones.ts (cada entrada es una línea JSON). Pura.
 * @param {string} ts
 * @returns {{ nombre: string, bytes: number }[]}
 */
export function leerManifiesto(ts) {
  const ini = ts.indexOf("export const MANIFIESTO = [");
  const fin = ts.indexOf("] as const;", ini);
  if (ini < 0 || fin < 0) return [];
  return ts
    .slice(ini, fin)
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/,$/, ""))
    .filter((l) => l.startsWith("{"))
    .map((l) => JSON.parse(l));
}

/**
 * Evalúa los puntos 1-6 de §8.6 sobre un árbol .next. Devuelve el reporte con `ok` y `fallas`.
 * @param {{ root: string, nextDir: string, base?: number | null, esperar?: string[],
 *   techos?: Partial<typeof TECHOS>, manifiesto?: { nombre: string }[] | null }} o
 */
export function evaluar({ root, nextDir, base = null, esperar = FAMILIAS, techos = {}, manifiesto = null }) {
  const T = { ...TECHOS, ...techos };
  /** @type {string[]} */
  const fallas = [];
  /** @type {string[]} */
  const avisos = [];
  const espera = new Set(esperar);
  for (const e of espera) if (!FAMILIAS.includes(e)) fallas.push(`--esperar con una familia desconocida: ${e}`);
  const sizeOf = (/** @type {string} */ rel) => {
    const f = path.join(nextDir, rel);
    return existsSync(f) ? statSync(f).size : null;
  };

  // 1. JS inicial de /page: sin centinelas; con el montaje cuando se espera la UI
  const abm = path.join(nextDir, "app-build-manifest.json");
  /** @type {string[]} */
  let pagina = [];
  if (!existsSync(abm)) fallas.push("sin .next/app-build-manifest.json: no se puede medir la página");
  else pagina = JSON.parse(readFileSync(abm, "utf8")).pages?.["/page"] ?? [];
  if (existsSync(abm) && pagina.length === 0) fallas.push('el app-build-manifest no tiene pages["/page"]');
  let paginaBytes = 0;
  let conMontaje = false;
  for (const rel of pagina) {
    const n = sizeOf(rel);
    if (n === null) {
      fallas.push(`pages["/page"] lista ${rel}, que no existe en .next`);
      continue;
    }
    paginaBytes += n;
    const txt = readFileSync(path.join(nextDir, rel), "utf8");
    for (const c of CENTINELAS) if (txt.includes(c)) fallas.push(`un módulo del compañero entró al chunk de página: ${c}`);
    if (txt.includes(MONTAJE)) conMontaje = true;
  }
  if (espera.has("ui") && pagina.length && !conMontaje) fallas.push(`el JS inicial de /page no monta el compañero: falta ${MONTAJE}`);

  // 2. crecimiento de la página contra la base
  let crecimiento = null;
  if (base === null || !Number.isFinite(base)) avisos.push("sin base (--base o COMPANION_BASE_PAGINA): no se mide el crecimiento de la página");
  else {
    crecimiento = paginaBytes - base;
    if (crecimiento > T.crecimientoPagina) fallas.push(`el compañero agrega ${crecimiento} B al JS inicial de /page > ${T.crecimientoPagina} B (base ${base} B, hoy ${paginaBytes} B)`);
  }

  // 3. chunks esperados
  const dirChunks = path.join(nextDir, "static/chunks");
  const archivos = existsSync(dirChunks) ? readdirSync(dirChunks).filter((f) => f.endsWith(".js")) : [];
  /** @param {string} nombre @returns {{ archivo: string, bytes: number } | null} */
  const chunk = (nombre) => {
    const re = new RegExp(`^${escapar(nombre)}\\.[0-9a-f]+\\.js$`);
    const f = archivos.find((x) => re.test(x));
    return f ? { archivo: `static/chunks/${f}`, bytes: statSync(path.join(dirChunks, f)).size } : null;
  };
  /** @type {{ nombre: string, familia: string, archivo: string, bytes: number }[]} */
  const encontrados = [];
  for (const [fam, nombre] of Object.entries(PEREZOSOS)) {
    const c = chunk(nombre);
    if (c) encontrados.push({ nombre, familia: fam, ...c });
    else if (espera.has(fam)) fallas.push(`falta el chunk ${nombre}`);
  }
  const res = chunk("companion-reservado");
  if (res) encontrados.push({ nombre: "companion-reservado", familia: "reservado", ...res });
  else if (espera.has("reservado")) fallas.push("falta el chunk companion-reservado");
  let mani = manifiesto;
  if (mani === null) {
    const ts = path.join(root, "src/lib/companion/generated/particiones.ts");
    mani = existsSync(ts) ? leerManifiesto(readFileSync(ts, "utf8")) : [];
    if (!existsSync(ts)) avisos.push("sin src/lib/companion/generated/particiones.ts: corre scripts/companion/build-index.mjs");
  }
  if (espera.has("idx") && mani.length === 0) fallas.push("se esperan particiones companion-idx-* y el MANIFIESTO está vacío");
  for (const p of mani) {
    const nombre = `companion-idx-${p.nombre}`;
    const c = chunk(nombre);
    if (c) encontrados.push({ nombre, familia: "idx", ...c });
    else if (espera.has("idx")) fallas.push(`falta el chunk ${nombre}`);
  }

  // 4. tamaños
  const perezoso = encontrados.filter((c) => c.familia in PEREZOSOS);
  const perezosoBytes = perezoso.reduce((a, c) => a + c.bytes, 0);
  if (perezosoBytes > T.perezoso) fallas.push(`código perezoso del compañero ${perezosoBytes} B > ${T.perezoso} B: ${perezoso.map((c) => `${c.nombre} ${c.bytes} B`).join(", ")}`);
  const idx = encontrados.filter((c) => c.familia === "idx");
  for (const c of idx) if (c.bytes > T.particion) fallas.push(`partición ${c.nombre} ${c.bytes} B > ${T.particion} B`);
  const indiceBytes = idx.reduce((a, c) => a + c.bytes, 0) + (res?.bytes ?? 0);
  if (indiceBytes > T.indice) fallas.push(`índice más reservado ${indiceBytes} B > ${T.indice} B`);

  // 5. precache
  const swFile = path.join(root, "public/sw.js");
  let precache = null;
  if (!existsSync(swFile)) {
    if (encontrados.length) fallas.push("sin public/sw.js: no se puede comprobar el precache del compañero");
    else avisos.push("sin public/sw.js");
  } else {
    const urls = new Set(precacheUrls(readFileSync(swFile, "utf8")));
    const fuera = encontrados.filter((c) => !urls.has(`/_next/${c.archivo}`));
    for (const c of fuera) fallas.push(`un chunk del compañero quedó fuera del precache: ${c.nombre} (${c.archivo})`);
    precache = { entradas: urls.size, companero: encontrados.length, fuera: fuera.length };
  }

  // 6. atribución a Forge por grafo de módulos
  const mapa = path.join(nextDir, "forge-chunks.json");
  let uiForge = null;
  if (!existsSync(mapa)) avisos.push("sin .next/forge-chunks.json: no se comprobó la atribución a Forge");
  else {
    const chunks = JSON.parse(readFileSync(mapa, "utf8")).chunks ?? {};
    for (const c of encontrados) {
      const mods = (chunks[c.archivo]?.forge ?? []).filter((/** @type {string} */ m) => m.startsWith("src/forge/"));
      if (c.nombre !== "companion-forge" && mods.length) fallas.push(`un chunk del compañero arrastra módulos de Forge: ${c.nombre}: ${mods.slice(0, 3).join(", ")}`);
    }
    const cf = encontrados.find((c) => c.nombre === "companion-forge");
    uiForge = cf ? cf.bytes : 0;
  }

  return {
    v: 1,
    ok: fallas.length === 0,
    fallas,
    avisos,
    techos: T,
    esperar: [...espera],
    pagina: { archivos: pagina, bytes: paginaBytes, base, crecimiento, montaje: conMontaje },
    perezoso: { bytes: perezosoBytes, chunks: perezoso.map(({ nombre, bytes }) => ({ nombre, bytes })) },
    indice: { particiones: idx.length, manifiesto: mani.length, bytes: indiceBytes, mayor: idx.reduce((a, c) => (c.bytes > a.bytes ? { nombre: c.nombre, bytes: c.bytes } : a), { nombre: "", bytes: 0 }), reservado: res?.bytes ?? null },
    precache,
    ui_forge: uiForge,
  };
}

/** @param {string} name */
function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(arg("--root") ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."));
  const nextDir = path.resolve(arg("--next") ?? path.join(root, ".next"));
  const baseTxt = arg("--base") ?? process.env.COMPANION_BASE_PAGINA;
  const base = baseTxt === undefined || baseTxt === "" ? null : Number(baseTxt);
  const espTxt = arg("--esperar");
  const esperar = espTxt === undefined ? FAMILIAS : espTxt === "ninguno" ? [] : espTxt.split(",").map((s) => s.trim()).filter(Boolean);
  const out = arg("--out") ?? (existsSync(TAREA) ? path.join(TAREA, "budget-companion.json") : path.join(nextDir, "budget-companion.json"));
  const r = evaluar({ root, nextDir, base, esperar });
  writeFileSync(out, JSON.stringify(r, null, 1) + "\n");
  for (const a of r.avisos) console.log(`[companion-budget] aviso: ${a}`);
  if (!r.ok) {
    for (const f of r.fallas) console.error(`[companion-budget] ✕ ${f}`);
    console.error(`[companion-budget] FALLA (${r.fallas.length}) · reporte en ${out}`);
    process.exit(1);
  }
  console.log(
    `[companion-budget] OK · página ${r.pagina.bytes} B (crecimiento ${r.pagina.crecimiento ?? "sin base"}) · perezoso ${r.perezoso.bytes} B · índice ${r.indice.particiones} chunks ${r.indice.bytes} B · esperar ${r.esperar.join(",") || "ninguno"} · reporte en ${out}`,
  );
}
