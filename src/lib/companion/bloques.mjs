// Corte único de un banco de ejercicios en bloques `##` (design §8.4, §8.5). La posición de un bloque es el ancla de
// su documento en el índice; la usan el generador (scripts/companion/build-index.mjs) y pasajes.ts, y nadie más corta
// bancos. Replica las reglas de explainExercisesMd (src/lib/exercises-md.ts:494-525) que fijan los bloques; la
// paridad la prueba generador.test.ts. Puro: no importa nada.

/** Líneas propias de cada tipo de Forge, además de type:, tiempo:, id: y rol: (= FORGE_SCHEMAS[t].lines). */
export const LINEAS_FORGE = {
  prediccion: ["escala"],
  desvanecido: ["lang"],
  historial: ["modo", "objetivo", "chequeo"],
  mutantes: ["minimo"],
  contraejemplo: [],
  senal: ["semilla"],
  entrevista: ["fases"],
  expediente: [],
  retencion: ["dias", "variante_de", "forma"],
  giro: [],
  sql: ["orden"],
  ontologia: [],
  forense: ["corte"],
  permisos: [],
  recuperacion: ["corte"],
  gameday: [],
};

/** Tipos de opción múltiple y sus sinónimos (CHOICE_TYPES de exercises-md.ts). */
export const TIPOS_OPCION = new Set(["multiple_choice", "choice", "complexity", "complejidad", "trace", "trazar"]);

/** ITEM_ID_RE de src/forge/bank/types/_shared.ts. */
const ITEM_ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
const FM_RE = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const CERCA_RE = /^\s*(```|~~~)/;
const LINEA_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/;

/** @param {string} s */
const sinAcentos = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
/** norm de exercises-md.ts. @param {string} s */
const norm = (s) => sinAcentos(s.toLowerCase()).trim();
/** norm de Forge (_shared.ts): además colapsa espacios. @param {string} s */
const normForge = (s) => norm(s).replace(/\s+/g, " ");

/**
 * @param {string} t
 * @returns {t is keyof typeof LINEAS_FORGE}
 */
export function esTipoForge(t) {
  return Object.prototype.hasOwnProperty.call(LINEAS_FORGE, t);
}

/**
 * Corte sensible a cercas por nivel de encabezado (splitByHeading de exercises-md.ts:57-77).
 * @param {string[]} lineas
 * @param {2 | 3} nivel
 * @returns {{ preambulo: string[], secciones: { titulo: string, cuerpo: string[] }[] }}
 */
function cortar(lineas, nivel) {
  const re = new RegExp(`^#{${nivel}}\\s+(.*)$`);
  /** @type {{ titulo: string, cuerpo: string[] }[]} */
  const secciones = [];
  /** @type {string[]} */
  const preambulo = [];
  /** @type {{ titulo: string, cuerpo: string[] } | null} */
  let cur = null;
  let cerca = false;
  for (const l of lineas) {
    if (CERCA_RE.test(l)) cerca = !cerca;
    const m = !cerca ? l.match(re) : null;
    if (m) {
      if (cur) secciones.push(cur);
      cur = { titulo: (m[1] ?? "").trim(), cuerpo: [] };
    } else if (cur) cur.cuerpo.push(l);
    else preambulo.push(l);
  }
  if (cur) secciones.push(cur);
  return { preambulo, secciones };
}

/**
 * Frontmatter plano (key: value), con comillas quitadas.
 * @param {string} fm
 * @returns {Record<string, string>}
 */
export function frontmatter(fm) {
  /** @type {Record<string, string>} */
  const get = {};
  for (const l of fm.split(/\r?\n/)) {
    const m = l.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!m) continue;
    let v = (m[2] ?? "").trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    get[m[1] ?? ""] = v;
  }
  return get;
}

/**
 * @param {string} titulo
 * @param {string[]} raices
 */
const coincide = (titulo, raices) => {
  const h = norm(titulo);
  return raices.some((r) => h === r || h.startsWith(r));
};

/**
 * Cercas de código de un cuerpo → [{ lang, code }] en orden (extractFences de exercises-md.ts).
 * @param {string[]} lineas
 */
function cercas(lineas) {
  /** @type {{ lang: string, code: string[] }[]} */
  const out = [];
  /** @type {{ lang: string, code: string[] } | null} */
  let cur = null;
  for (const l of lineas) {
    const m = l.match(/^\s*(?:```|~~~)\s*([A-Za-z0-9_+-]*)\s*$/);
    if (m) {
      if (cur) {
        out.push(cur);
        cur = null;
      } else cur = { lang: (m[1] ?? "").toLowerCase(), code: [] };
    } else if (cur) cur.code.push(l);
  }
  return out.map((f) => ({ lang: f.lang, code: f.code.join("\n") }));
}

/**
 * @param {string} tag
 * @returns {"js" | "python" | null}
 */
function lenguaje(tag) {
  const t = norm(tag);
  if (t === "js" || t === "javascript" || t === "node") return "js";
  if (t === "py" || t === "python") return "python";
  return null;
}

/**
 * Enunciado de un bloque: el preámbulo `###` sin las líneas type:, tiempo:, id: y rol: (exercises-md.ts:317) ni, en
 * los 16 tipos de Forge, las líneas propias del tipo.
 * @param {string[]} pre
 * @param {string | null} tipo
 */
function enunciadoDe(pre, tipo) {
  if (tipo !== null && esTipoForge(tipo)) {
    const conocidas = new Set(["type", "tiempo", "id", "rol", ...LINEAS_FORGE[tipo]]);
    return pre
      .filter((l) => {
        const m = l.match(LINEA_RE);
        return !(m && conocidas.has(normForge(m[1] ?? "")));
      })
      .join("\n")
      .trim();
  }
  const quitar = [/^\s*type\s*:/i, /^\s*tiempo\s*:/i, /^\s*id\s*:/i, /^\s*rol\s*:/i].map((re) => pre.find((l) => re.test(l)));
  return pre
    .filter((l) => !quitar.includes(l))
    .join("\n")
    .trim();
}

/**
 * @typedef {{ indice: number, titulo: string, tipo: string | null, enunciado: string,
 *   firma?: { lang: "js" | "python", code: string }[], opciones?: string[],
 *   secciones: { titulo: string, cuerpo: string[] }[], cuerpo: string[] }} Bloque
 */

/**
 * Corta un banco en sus bloques `##`, todos (también giro, retencion y los que no traen type:). El ancla de un
 * ejercicio es `indice`, su posición 0-based. `secciones` y `cuerpo` son las `###` y las líneas del bloque, para que
 * el generador saque las fuentes reservadas sin volver a cortar.
 * @param {string} md
 * @returns {Bloque[]}
 */
export function bloquesBanco(md) {
  const fm = md.match(FM_RE);
  const cuerpo = fm ? (fm[2] ?? "") : md;
  const { secciones } = cortar(cuerpo.split(/\r?\n/), 2);
  return secciones.map((sec, indice) => {
    const titulo = sec.titulo.replace(/^ejercicio\s*:\s*/i, "").trim();
    const { preambulo, secciones: subs } = cortar(sec.cuerpo, 3);
    const lineaTipo = preambulo.find((l) => /^\s*type\s*:/i.test(l));
    const tipo = lineaTipo ? norm(lineaTipo.replace(/^\s*type\s*:/i, "")) : null;
    /** @type {Bloque} */
    const b = { indice, titulo, tipo, enunciado: enunciadoDe(preambulo, tipo), secciones: subs, cuerpo: sec.cuerpo };
    if (tipo === "code") {
      const base = subs.filter((s) => !coincide(s.titulo, ["casos generados"]));
      const f = base.find((s) => coincide(s.titulo, ["firma", "signature"]));
      if (f) {
        /** @type {Map<"js" | "python", string>} */
        const porLang = new Map();
        for (const c of cercas(f.cuerpo)) {
          const l = lenguaje(c.lang);
          if (l && !porLang.has(l)) porLang.set(l, c.code);
        }
        b.firma = [...porLang].map(([lang, code]) => ({ lang, code }));
      }
    } else if (tipo !== null && TIPOS_OPCION.has(tipo)) {
      const o = subs.find((s) => coincide(s.titulo, ["opciones", "options"]));
      if (o) {
        b.opciones = o.cuerpo
          .map((l) => l.trim())
          .filter((l) => /^[-*+]\s+/.test(l))
          .map((l) => l.replace(/^[-*+]\s+/, "").trim())
          .filter(Boolean)
          .map((l) => {
            const m = l.match(/^\[\s*[xX]\s*\]\s*(.*)$/);
            return m ? (m[1] ?? "").trim() : l;
          });
      }
    }
    return b;
  });
}

/**
 * Reglas estructurales de explainExercisesMd (:494-525) que deciden si la app carga el banco: frontmatter,
 * kind: exercises, title, cercas pares, al menos un `##`, type: en cada bloque, id: con ITEM_ID_RE (obligatorio en
 * los tipos de Forge) y sin repetir. Las reglas por tipo no se replican: las cubre la paridad de generador.test.ts.
 * @param {string} md
 * @returns {{ ok: true } | { ok: false, motivo: string }}
 */
export function bancoValido(md) {
  /** @param {string} motivo @returns {{ ok: false, motivo: string }} */
  const no = (motivo) => ({ ok: false, motivo });
  const fm = md.match(FM_RE);
  if (!fm) return no("falta el frontmatter --- … ---");
  const meta = frontmatter(fm[1] ?? "");
  if (norm(meta.kind ?? "") !== "exercises") return no("el frontmatter no dice kind: exercises");
  if (!(meta.title ?? "").trim()) return no("el frontmatter no trae title");
  const lineas = (fm[2] ?? "").split(/\r?\n/);
  if (lineas.filter((l) => CERCA_RE.test(l)).length % 2 !== 0) return no("hay una cerca ``` sin cerrar");
  const { secciones } = cortar(lineas, 2);
  if (secciones.length === 0) return no("el banco no trae ningún ejercicio");
  const vistos = new Set();
  for (const sec of secciones) {
    const titulo = sec.titulo.replace(/^ejercicio\s*:\s*/i, "").trim();
    const { preambulo } = cortar(sec.cuerpo, 3);
    const lineaTipo = preambulo.find((l) => /^\s*type\s*:/i.test(l));
    if (!lineaTipo) return no(`«${titulo}»: falta la línea type:`);
    const tipo = norm(lineaTipo.replace(/^\s*type\s*:/i, ""));
    /** @type {string | undefined} */
    let id;
    if (esTipoForge(tipo)) {
      for (const l of preambulo) {
        const m = l.match(LINEA_RE);
        if (m && normForge(m[1] ?? "") === "id") id = (m[2] ?? "").trim();
      }
      if (id === undefined) return no(`«${titulo}»: falta la línea id: (obligatoria en los tipos de Forge)`);
    } else {
      const l = preambulo.find((x) => /^\s*id\s*:/i.test(x));
      if (l !== undefined) id = l.replace(/^\s*id\s*:/i, "").trim();
    }
    if (id === undefined) continue;
    if (!ITEM_ID_RE.test(id)) return no(`«${titulo}»: id: «${id}» no cumple ^[a-z0-9][a-z0-9-]{1,63}$`);
    if (vistos.has(id)) return no(`«${titulo}»: id: «${id}» repetido en el banco`);
    vistos.add(id);
  }
  return { ok: true };
}
