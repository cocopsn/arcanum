#!/usr/bin/env node
// build-index — índice BM25 del compañero, generado en cada dev/build/typecheck/test (design §8.1-§8.5).
// Lee content/books, content/exercises, content/forge/books, content/forge/exercises, src/forge/data/routes y
// src/forge/data/pilots.json; escribe idx-<partición>.json, reservado.json y particiones.ts en
// src/lib/companion/generated/ (no versionado). Determinista: archivos por ruta, sin fechas, llaves en orden fijo.
// Ningún texto reservado (D12) se escribe en claro: reservado.json sólo trae hashes de 48 bits.
//
// Uso: node scripts/companion/build-index.mjs [--root <repo>] [--out <dir>]
// Sale con 1 sólo ante un error interno; los techos los hace cumplir scripts/companion/budget.mjs (§8.6).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tokenizar } from "../../src/lib/companion/tokenizar.mjs";
import { aBase64, codificarHashes, gramas5, hash48, palabras } from "../../src/lib/companion/gramas.mjs";
import { TIPOS_OPCION, bancoValido, bloquesBanco, esTipoForge, frontmatter } from "../../src/lib/companion/bloques.mjs";

export const FORMATO = "arcanum-companion-index/1";
export const FORMATO_RESERVADO = "arcanum-companion-reservado/1";
export const SPINE_FORGE = "Engineering Forge";
const KiB = 1024;
/** Una partición de más de esto se parte en -1, -2… (§8.5). */
export const PARTIR_SOBRE = 192 * KiB;

const FM_RE = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const CERCA_RE = /^\s*(```|~~~)/;

/** @param {string} s */
export const sha10 = (s) => createHash("sha256").update(s).digest("hex").slice(0, 10);

/** @param {string} s */
const sinAcentos = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
/** @param {string} s */
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
/** slugify de src/lib/book.ts (FNV-1a de respaldo). @param {string} s */
export function slugify(s) {
  const base = sinAcentos(s.toLowerCase()).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return base || "s-" + hashStr(s);
}

/**
 * Ruta de Forge de un código de celda, con la regla de slugForCode (src/forge/ai.ts:18): D1-D8 → diagnostico,
 * X01-X24 → retos, SD-01-SD-12 → expedientes; si no, el prefijo antes del guion en minúsculas.
 * @param {string} codigo
 */
export function rutaForge(codigo) {
  const c = codigo.toUpperCase();
  if (/^D[1-8]$/.test(c)) return "diagnostico";
  if (/^X\d{2}$/.test(c)) return "retos";
  if (/^SD-\d{2}$/.test(c)) return "expedientes";
  return (c.split("-")[0] ?? c).toLowerCase();
}

/** @param {string[]} lineas */
function sinCercas(lineas) {
  const out = [];
  let f = false;
  for (const l of lineas) {
    if (CERCA_RE.test(l)) {
      f = !f;
      continue;
    }
    if (!f) out.push(l);
  }
  return out.join("\n");
}

/** @param {string[]} t */
const triple = (t) => [...t, ...t, ...t];

/**
 * Un libro → su meta y sus documentos: la entrada (ancla "", si lead o pregunta raíz no están vacíos) y uno por
 * sección `##`, con los ids de parseBook. null si parseBook lo rechaza (sin frontmatter o sin título).
 * @param {string} md
 * @returns {{ titulo: string, spine: string, moduleId: string | null,
 *   docs: { ancla: string, etiqueta: string, tokens: string[], texto: string }[] } | null}
 */
export function seccionesLibro(md) {
  const fm = md.match(FM_RE);
  if (!fm) return null;
  const meta = frontmatter(fm[1] ?? "");
  const titulo = meta.title ?? "";
  if (!titulo.trim()) return null;
  const lineas = (fm[2] ?? "").split(/\r?\n/);
  /** @type {string[]} */
  const pre = [];
  /** @type {{ titulo: string, buf: string[] }[]} */
  const secs = [];
  /** @type {{ titulo: string, buf: string[] } | null} */
  let cur = null;
  let cerca = false;
  for (const l of lineas) {
    if (CERCA_RE.test(l)) cerca = !cerca;
    const h2 = !cerca ? l.match(/^##\s+(.*)$/) : null;
    if (h2) {
      if (cur) secs.push(cur);
      cur = { titulo: (h2[1] ?? "").trim(), buf: [] };
    } else if (cur) cur.buf.push(l);
    else pre.push(l);
  }
  if (cur) secs.push(cur);
  const tLibro = tokenizar(titulo);
  const docs = [];
  const raizPregunta = pre.filter((l) => l.trim().startsWith(">")).map((l) => l.replace(/^\s*>\s?/, "")).join(" ").trim();
  const lead = pre.filter((l) => !l.trim().startsWith(">")).join("\n").trim();
  if (raizPregunta || lead) {
    const texto = [raizPregunta, lead].filter(Boolean).join("\n");
    docs.push({ ancla: "", etiqueta: "Introducción", tokens: [...tLibro, ...tokenizar(texto)], texto });
  }
  const vistos = new Set();
  for (const s of secs) {
    let id = slugify(s.titulo);
    for (let n = 2; vistos.has(id); n++) id = `${slugify(s.titulo)}-${n}`;
    vistos.add(id);
    const cuerpo = s.buf.join("\n");
    docs.push({ ancla: id, etiqueta: s.titulo, tokens: [...triple(tokenizar(s.titulo)), ...tLibro, ...tokenizar(cuerpo)], texto: `${s.titulo}\n${cuerpo}` });
  }
  return { titulo, spine: meta.spine ?? "", moduleId: (meta.module_id ?? "").trim() || null, docs };
}

/**
 * Un banco → sus documentos indexables (§8.2) con el ancla = posición del bloque en bloquesBanco(md). giro y
 * retencion no entran; de entrevista entran título y enunciado. `incluirReservados` existe sólo para el red-check
 * (§23.2 (e)(i)): mete al índice la prosa del giro y la ### Hechos de la entrevista (retencion sigue fuera, DC-18).
 * @param {string} md
 * @param {{ incluirReservados?: boolean }} [opciones]
 * @returns {{ docs: { ancla: string, etiqueta: string, tipo: string | null, tokens: string[], texto: string }[],
 *   excluidos: { ancla: string, motivo: string }[] }}
 */
export function ejerciciosBanco(md, { incluirReservados = false } = {}) {
  const docs = [];
  const excluidos = [];
  for (const b of bloquesBanco(md)) {
    const ancla = String(b.indice);
    if (b.tipo === "retencion" || (b.tipo === "giro" && !incluirReservados)) {
      excluidos.push({ ancla, motivo: b.tipo });
      continue;
    }
    const partes = [b.titulo, b.enunciado];
    let tokens = [...triple(tokenizar(b.titulo)), ...tokenizar(b.enunciado)];
    const extra = [];
    if (b.tipo !== null && !esTipoForge(b.tipo)) {
      if (b.tipo === "code" && b.firma) extra.push(...b.firma.map((f) => f.code));
      else if (TIPOS_OPCION.has(b.tipo) && b.opciones) extra.push(b.opciones.join("\n"));
    }
    if (incluirReservados && b.tipo === "giro") extra.push(sinCercas(b.cuerpo));
    if (incluirReservados && b.tipo === "entrevista") {
      const h = b.secciones.find((s) => sinAcentos(s.titulo.toLowerCase()).trim().startsWith("hechos"));
      if (h) extra.push(sinCercas(h.cuerpo));
    }
    for (const e of extra) {
      tokens = tokens.concat(tokenizar(e));
      partes.push(e);
    }
    docs.push({ ancla, etiqueta: b.titulo, tipo: b.tipo, tokens, texto: partes.join("\n") });
  }
  return { docs, excluidos };
}

/**
 * Las celdas de una ruta de Forge → un documento por celda con la lista blanca de §8.2 (lo que pinta
 * ForgeCellPanel más la pregunta y la rúbrica de la compuerta). Ancla = código.
 * @param {{ cells?: any[] }} ruta
 * @returns {{ ancla: string, etiqueta: string, tokens: string[], texto: string }[]}
 */
export function docsFicha(ruta) {
  return (ruta.cells ?? []).map((c) => {
    const f = c.ficha ?? {};
    const campos = [
      f.foco,
      f.resultado,
      f.mision,
      f.defensa,
      f.transferencia,
      ...(c.capacidades ?? []),
      ...(c.criticas ?? []).map((/** @type {{ texto?: string }} */ k) => k.texto),
      ...(f.fuentes ?? []).map((/** @type {{ etiqueta?: string }} */ s) => s.etiqueta),
      c.gate?.pregunta,
      ...(c.gate?.rubrica ?? []),
    ].filter((x) => typeof x === "string" && x.trim() !== "");
    const texto = campos.join("\n");
    return { ancla: String(c.code), etiqueta: String(c.title ?? c.code), tokens: [...triple(tokenizar(String(c.title ?? ""))), ...tokenizar(texto)], texto: `${c.title ?? ""}\n${texto}` };
  });
}

/**
 * Codifica una partición en el formato de §8.4.
 * @param {string} nombre
 * @param {string[][]} fuentes [archivo, handle, título, sha10]
 * @param {{ fuente: number, ancla: string, etiqueta: string, tokens: string[] }[]} docs
 * @param {{ spine?: string, ruta?: string | null }} [meta]
 * @returns {{ texto: string, bytes: number, docs: number, terminos: number }}
 */
export function codificar(nombre, fuentes, docs, { spine = "", ruta = null } = {}) {
  /** @type {Map<string, [number, number][]>} */
  const post = new Map();
  let total = 0;
  docs.forEach((d, i) => {
    total += d.tokens.length;
    /** @type {Map<string, number>} */
    const tf = new Map();
    for (const t of d.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const [t, n] of tf) {
      let l = post.get(t);
      if (!l) post.set(t, (l = []));
      l.push([i, n]);
    }
  });
  const vocab = [...post.keys()].sort();
  const q = vocab.map((t) => {
    let prev = 0;
    return (post.get(t) ?? [])
      .map(([d, n]) => {
        const s = (d - prev).toString(36) + (n > 1 ? ":" + n.toString(36) : "");
        prev = d;
        return s;
      })
      .join(",");
  });
  const N = docs.length;
  const obj = {
    f: FORMATO,
    p: nombre,
    spine,
    ruta,
    N,
    avgdl: N ? Math.round((total / N) * 10) / 10 : 0,
    s: fuentes,
    d: docs.map((d) => [d.fuente, d.ancla, d.etiqueta, d.tokens.length]),
    v: vocab.join(" "),
    q: q.join(";"),
  };
  const texto = JSON.stringify(obj);
  return { texto, bytes: Buffer.byteLength(texto), docs: N, terminos: vocab.length };
}

/**
 * Fuentes reservadas de D12 (§8.5): la prosa sin cercas de cada ítem giro, la ### Hechos de cada entrevista y de
 * pilots.json F1-03 «Sesión» y «Variación» y P2-06 «Secuencia», paso 7.
 * @param {{ pilotos: any, bancos: { archivo: string, md: string }[] }} entrada
 * @returns {{ nombre: string, texto: string }[]}
 */
export function textosReservados({ pilotos, bancos }) {
  const out = [];
  for (const { archivo, md } of bancos) {
    for (const b of bloquesBanco(md)) {
      if (b.tipo === "giro") out.push({ nombre: `giro ${archivo}#${b.indice}`, texto: sinCercas(b.cuerpo) });
      else if (b.tipo === "entrevista") {
        const h = b.secciones.find((s) => sinAcentos(s.titulo.toLowerCase()).trim().startsWith("hechos"));
        if (h) out.push({ nombre: `hechos ${archivo}#${b.indice}`, texto: sinCercas(h.cuerpo) });
      }
    }
  }
  const lista = Array.isArray(pilotos?.pilotos) ? pilotos.pilotos : [];
  /** @param {string} code @param {string} pref */
  const campo = (code, pref) => lista.find((/** @type {any} */ p) => p.code === code)?.campos?.find((/** @type {any} */ c) => String(c.etiqueta).startsWith(pref));
  const ses = campo("F1-03", "Sesión");
  if (typeof ses?.texto === "string") out.push({ nombre: "pilots.json F1-03 Sesión", texto: ses.texto });
  const vari = campo("F1-03", "Variación");
  if (typeof vari?.texto === "string") out.push({ nombre: "pilots.json F1-03 Variación", texto: vari.texto });
  const sec = campo("P2-06", "Secuencia");
  if (typeof sec?.items?.[6] === "string") out.push({ nombre: "pilots.json P2-06 Secuencia paso 7", texto: sec.items[6] });
  return out;
}

/** @param {string} dir */
const mdDe = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md")).sort() : []);

/**
 * Construye todo el índice. Con `escribir`, deja los archivos en `outDir` (y borra los idx-*.json viejos).
 * `validarBanco` e `incluirReservados` existen sólo para los red-checks; el CLI no los expone.
 * @param {{ root: string, outDir?: string, escribir?: boolean,
 *   validarBanco?: (md: string) => { ok: true } | { ok: false, motivo: string }, incluirReservados?: boolean }} o
 */
export function construir({ root, outDir, escribir = false, validarBanco = bancoValido, incluirReservados = false }) {
  /** @type {string[]} */
  const avisos = [];
  /** @type {{ archivo: string, ancla: string | null, motivo: string }[]} */
  const excluidos = [];
  /** @type {Map<string, { tipo: string, spine: string, ruta: string | null, fuentes: { fuente: string[], docs: any[] }[] }>} */
  const grupos = new Map();
  /** @type {{ particion: string, archivo: string, ancla: string, etiqueta: string, texto: string }[]} */
  const publicos = [];
  /**
   * @param {string} nombre @param {string} tipo @param {string} spine @param {string | null} ruta
   * @param {string[]} fuente @param {{ ancla: string, etiqueta: string, tokens: string[], texto: string }[]} docs
   */
  const agregar = (nombre, tipo, spine, ruta, fuente, docs) => {
    let g = grupos.get(nombre);
    if (!g) grupos.set(nombre, (g = { tipo, spine, ruta, fuentes: [] }));
    g.fuentes.push({ fuente, docs });
    for (const d of docs) publicos.push({ particion: nombre, archivo: fuente[0] ?? "", ancla: d.ancla, etiqueta: d.etiqueta, texto: d.texto });
  };
  const leer = (/** @type {string} */ rel) => readFileSync(path.join(root, rel), "utf8");

  for (const f of mdDe(path.join(root, "content/books"))) {
    const rel = `content/books/${f}`;
    const md = leer(rel);
    const l = seccionesLibro(md);
    if (!l) {
      avisos.push(`libro saltado (sin frontmatter o sin título): ${rel}`);
      excluidos.push({ archivo: rel, ancla: null, motivo: "libro inválido" });
      continue;
    }
    agregar(`libros-${slugify(l.spine || "suelto")}`, "libros", l.spine, null, [rel, l.moduleId ?? "", l.titulo, sha10(md)], l.docs);
  }
  for (const f of mdDe(path.join(root, "content/forge/books"))) {
    const rel = `content/forge/books/${f}`;
    const md = leer(rel);
    const l = seccionesLibro(md);
    const codigo = f.replace(/\.md$/, "").toUpperCase();
    if (!l) {
      avisos.push(`libro saltado (sin frontmatter o sin título): ${rel}`);
      excluidos.push({ archivo: rel, ancla: null, motivo: "libro inválido" });
      continue;
    }
    const ruta = rutaForge(codigo);
    agregar(`forge-libros-${ruta}`, "libros", SPINE_FORGE, ruta, [rel, codigo, l.titulo, sha10(md)], l.docs);
  }
  /** @type {{ archivo: string, md: string }[]} */
  const bancosForge = [];
  for (const [dir, forge] of /** @type {[string, boolean][]} */ ([["content/exercises", false], ["content/forge/exercises", true]])) {
    for (const f of mdDe(path.join(root, dir))) {
      const rel = `${dir}/${f}`;
      const md = leer(rel);
      if (forge) bancosForge.push({ archivo: rel, md });
      const v = validarBanco(md);
      if (!v.ok) {
        avisos.push(`banco saltado entero (la app no lo carga): ${rel} (${v.motivo})`);
        excluidos.push({ archivo: rel, ancla: null, motivo: `banco inválido: ${v.motivo}` });
        continue;
      }
      const fm = frontmatter((md.match(FM_RE) ?? [])[1] ?? "");
      const e = ejerciciosBanco(md, { incluirReservados });
      for (const x of e.excluidos) excluidos.push({ archivo: rel, ancla: x.ancla, motivo: x.motivo });
      if (forge) {
        const codigo = f.replace(/\.md$/, "").toUpperCase();
        const ruta = rutaForge(codigo);
        agregar(`forge-bancos-${ruta}`, "bancos", SPINE_FORGE, ruta, [rel, codigo, fm.title ?? "", sha10(md)], e.docs);
      } else {
        const spine = fm.spine ?? "";
        agregar(`bancos-${slugify(spine || "suelto")}`, "bancos", spine, null, [rel, fm.module_id ?? "", fm.title ?? "", sha10(md)], e.docs);
      }
    }
  }
  const rutasDir = path.join(root, "src/forge/data/routes");
  for (const f of existsSync(rutasDir) ? readdirSync(rutasDir).filter((x) => x.endsWith(".json")).sort() : []) {
    const rel = `src/forge/data/routes/${f}`;
    const txt = leer(rel);
    const r = JSON.parse(txt);
    agregar("forge-fichas", "fichas", SPINE_FORGE, null, [rel, String(r.slug ?? f.replace(/\.json$/, "")), String(r.name ?? ""), sha10(txt)], docsFicha(r));
  }

  // particiones: grupos contiguos de fuentes ordenadas; las de más de PARTIR_SOBRE se parten en -1, -2…
  /** @type {{ nombre: string, tipo: string, spine: string, ruta: string | null, docs: number, bytes: number, sha10: string, texto: string }[]} */
  const particiones = [];
  /**
   * @param {string} nombre
   * @param {{ spine: string, ruta: string | null }} g
   * @param {{ fuente: string[], docs: any[] }[]} fs
   */
  const cod = (nombre, g, fs) => {
    /** @type {{ fuente: number, ancla: string, etiqueta: string, tokens: string[] }[]} */
    const docs = [];
    fs.forEach((x, i) => {
      for (const d of x.docs) docs.push({ fuente: i, ancla: d.ancla, etiqueta: d.etiqueta, tokens: d.tokens });
    });
    return codificar(nombre, fs.map((x) => x.fuente), docs, { spine: g.spine, ruta: g.ruta });
  };
  for (const nombre of [...grupos.keys()].sort()) {
    const g = /** @type {NonNullable<ReturnType<typeof grupos.get>>} */ (grupos.get(nombre));
    const todo = cod(nombre, g, g.fuentes);
    /** @type {{ fuente: string[], docs: any[] }[][]} */
    let trozos = [g.fuentes];
    if (todo.bytes > PARTIR_SOBRE && g.fuentes.length > 1) {
      trozos = [];
      /** @type {{ fuente: string[], docs: any[] }[]} */
      let cur = [];
      for (const x of g.fuentes) {
        if (cur.length && cod(nombre, g, [...cur, x]).bytes > PARTIR_SOBRE) {
          trozos.push(cur);
          cur = [];
        }
        cur.push(x);
      }
      if (cur.length) trozos.push(cur);
      avisos.push(`partición ${nombre} de ${todo.bytes} B partida en ${trozos.length}`);
    }
    trozos.forEach((fs, k) => {
      const n = trozos.length > 1 ? `${nombre}-${k + 1}` : nombre;
      const c = trozos.length > 1 ? cod(n, g, fs) : todo;
      particiones.push({ nombre: n, tipo: g.tipo, spine: g.spine, ruta: g.ruta, docs: c.docs, bytes: c.bytes, sha10: sha10(c.texto), texto: c.texto });
    });
  }

  // reservado (§8.5): 5-gramas de las fuentes reservadas que no aparecen en ningún documento público indexable
  const pilotosRel = "src/forge/data/pilots.json";
  const pilotos = existsSync(path.join(root, pilotosRel)) ? JSON.parse(leer(pilotosRel)) : { pilotos: [] };
  const textos = textosReservados({ pilotos, bancos: bancosForge });
  /** @type {Map<string, string>} 5-grama → primera fuente reservada que lo trae */
  const R5 = new Map();
  for (const t of textos) for (const { g } of gramas5(palabras(t.texto))) if (!R5.has(g)) R5.set(g, t.nombre);
  const G5 = new Set();
  /** @type {{ particion: string, archivo: string, ancla: string, etiqueta: string, fuente: string, seguidos: number }[]} */
  const coincidencias = [];
  for (const d of publicos) {
    const w = palabras(d.texto);
    let racha = 0;
    let mejor = 0;
    let fuenteMejor = "";
    let fuenteRacha = "";
    for (let i = 0; i + 5 <= w.length; i++) {
      const k = w.slice(i, i + 5).join(" ");
      G5.add(k);
      const r = R5.get(k);
      if (r !== undefined) {
        if (racha === 0) fuenteRacha = r;
        racha++;
        if (racha > mejor) {
          mejor = racha;
          fuenteMejor = fuenteRacha;
        }
      } else racha = 0;
    }
    if (mejor >= 3) coincidencias.push({ particion: d.particion, archivo: d.archivo, ancla: d.ancla, etiqueta: d.etiqueta, fuente: fuenteMejor, seguidos: mejor });
  }
  const enviados = [...R5.keys()].filter((g) => !G5.has(g));
  const bytesR = codificarHashes(enviados.map(hash48));
  const n = bytesR.length / 6;
  const textoR = JSON.stringify({ f: FORMATO_RESERVADO, n, h: aBase64(bytesR) });
  const reservado = { n, gramasFuentes: R5.size, textos: textos.length, bytes: Buffer.byteLength(textoR), sha10: sha10(textoR), texto: textoR };

  const manifiesto = {
    particiones: particiones.map(({ nombre, tipo, spine, ruta, docs, bytes, sha10: s }) => ({ nombre, tipo, spine, ruta, docs, bytes, sha10: s })),
    total: particiones.reduce((a, p) => a + p.bytes, 0),
    reservado: { n, gramasFuentes: R5.size, textos: textos.length, bytes: reservado.bytes, sha10: reservado.sha10 },
    coincidencias,
  };

  if (escribir) {
    if (!outDir) throw new Error("construir: escribir sin outDir");
    mkdirSync(outDir, { recursive: true });
    const vivos = new Set(particiones.map((p) => `idx-${p.nombre}.json`));
    for (const f of readdirSync(outDir)) if (/^idx-.*\.json$/.test(f) && !vivos.has(f)) rmSync(path.join(outDir, f));
    for (const p of particiones) writeFileSync(path.join(outDir, `idx-${p.nombre}.json`), p.texto);
    writeFileSync(path.join(outDir, "reservado.json"), textoR);
    writeFileSync(path.join(outDir, "particiones.ts"), particionesTs(manifiesto.particiones));
  }
  return { manifiesto, particiones, reservado, excluidos, avisos };
}

/**
 * Texto de particiones.ts (§8.5): MANIFIESTO, CARGAR y CARGAR_RESERVADO, cada import() con su webpackChunkName.
 * @param {{ nombre: string, tipo: string, spine: string, ruta: string | null, docs: number, bytes: number, sha10: string }[]} ps
 */
export function particionesTs(ps) {
  const L = ["// GENERADO por scripts/companion/build-index.mjs. No editar.", "export const MANIFIESTO = ["];
  for (const p of ps) L.push(`  ${JSON.stringify(p)},`);
  L.push("] as const;", "", "export const CARGAR: Record<string, () => Promise<unknown>> = {");
  for (const p of ps) L.push(`  ${JSON.stringify(p.nombre)}: () => import(/* webpackChunkName: "companion-idx-${p.nombre}" */ "./idx-${p.nombre}.json"),`);
  L.push("};", "", 'export const CARGAR_RESERVADO = () => import(/* webpackChunkName: "companion-reservado" */ "./reservado.json");', "");
  return L.join("\n");
}

/** @param {string} name */
function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = path.resolve(arg("--root") ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."));
    const outDir = path.resolve(arg("--out") ?? path.join(root, "src/lib/companion/generated"));
    const r = construir({ root, outDir, escribir: true });
    for (const a of r.avisos) console.log(`[companion-index] aviso: ${a}`);
    const m = r.manifiesto;
    const mayor = m.particiones.reduce((a, p) => (p.bytes > a.bytes ? p : a), { nombre: "", bytes: 0 });
    console.log(
      `[companion-index] OK · ${m.particiones.length} particiones · ${m.total} B · mayor ${mayor.nombre} ${mayor.bytes} B · reservado ${m.reservado.n} 5-gramas ${m.reservado.bytes} B · coincidencias ${m.coincidencias.length}`,
    );
  } catch (e) {
    console.error(`[companion-index] error interno: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
