#!/usr/bin/env node
// ENGINEERING FORGE — faithful extraction of the master program (design §5.1, §5.2, §5.3).
//
//   node scripts/forge/extract-maestro.mjs --maestro <path>      (or ARCANUM_FORGE_MAESTRO=<path>)
//   node scripts/forge/extract-maestro.mjs --maestro <path> --check   (extract and compare, write nothing)
//
// Reads the master program (UTF-8) and writes, deterministically (sorted keys where order is not the
// curriculum order, no run dates, "\n" at the end of every file):
//   src/lib/spines-forge.ts            the light FORGE_SPINE (19 paths, 168 cells), FORGE_CELL_META, FORGE_FAMILIES
//   src/forge/data/routes/<slug>.json  one ForgeRouteData per path (src/forge/data/types.ts), with flujo + compuerta
//   src/forge/data/maestro-urls.json   only { code: [urls] } (CA-15)
// Every file carries maestro_sha10 (sha256[:10] of the input). Exit 1 with the cell code when a fiche lacks a
// field, a code repeats, the counts are not 124 / 8 / 24 / 12, or a cited key of §20 does not resolve.
// The repository never carries personal paths: the input path arrives by argument or environment.
// No dependencies (node: built-ins only).
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

// ── The FLUJO table of design §5.2 (frozen in Phase 0). The master program does not carry this field: this
// table is the only source and NOTHING is inferred from a fiche. Every code not listed here is "mision".
export const FLUJOS = {
  diagnostico: ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8"],
  entrevista: ["F1-02", "F1-03", "X22"],
  expediente: ["SD-01", "SD-02", "SD-03", "SD-04", "SD-05", "SD-06", "SD-07", "SD-08", "SD-09", "SD-10", "SD-11", "SD-12", "S2-08", "X21"],
  ontologia: ["P2-01", "P2-02", "P2-03", "P2-05", "P2-08"],
  gameday: ["P5-08", "F1-07"],
  proyecto: ["F2-01", "F2-02", "F2-03", "F2-04", "F2-05", "F2-06"],
};
export function flujoFor(code) {
  for (const [flujo, codes] of Object.entries(FLUJOS)) if (codes.includes(code)) return flujo;
  return "mision";
}
/** compuerta from flujo, with this rule and nothing more (§5.2). */
export function compuertaFor(flujo) {
  if (flujo === "mision" || flujo === "proyecto") return "mision";
  if (flujo === "diagnostico") return null;
  return flujo; // entrevista | expediente | ontologia | gameday
}

// ── Paths (RF-M2 order; ids are the literal table of §4.1, mirrored by src/forge/ids.ts).
const ROUTES = [
  ["f0", "F0", "000000000007", 8, "Fundamentos"],
  ["a1", "A1", "000000000008", 8, "Fundamentos"],
  ["a2", "A2", "000000000009", 8, "Fundamentos"],
  ["s1", "S1", "000000000010", 8, "Sistemas y diseño"],
  ["s2", "S2", "000000000011", 8, "Sistemas y diseño"],
  ["p1", "P1", "000000000012", 8, "Plataforma Foundry/AIP"],
  ["p2", "P2", "000000000013", 8, "Plataforma Foundry/AIP"],
  ["p3", "P3", "000000000014", 8, "Plataforma Foundry/AIP"],
  ["p4", "P4", "000000000015", 8, "Plataforma Foundry/AIP"],
  ["p5", "P5", "000000000016", 8, "Plataforma Foundry/AIP"],
  ["f1", "F1", "000000000017", 8, "Oficio FDE"],
  ["f2", "F2", "000000000018", 8, "Oficio FDE"],
  ["sw1", "SW1", "000000000019", 7, "Profundidad SWE"],
  ["sw2", "SW2", "000000000020", 7, "Profundidad SWE"],
  ["sw3", "SW3", "000000000021", 7, "Profundidad SWE"],
  ["sw4", "SW4", "000000000022", 7, "Profundidad SWE"],
  ["diagnostico", "D", "000000000023", 8, "Evaluación"],
  ["retos", "X", "000000000024", 24, "Evaluación"],
  ["expedientes", "SD", "000000000025", 12, "Evaluación"],
];
const EXTRA_PATHS = {
  D: { name: "Diagnóstico inicial", description: "Ocho tareas de diagnóstico: observaciones, sin puntaje global" },
  X: { name: "Banco de retos", description: "Veinticuatro retos de autoría curricular propia" },
  SD: { name: "Expedientes de system design", description: "Doce expedientes de system design en tres pasadas" },
};
export const FAMILIES = [
  { family: "Fundamentos", paths: ["f0", "a1", "a2"] },
  { family: "Sistemas y diseño", paths: ["s1", "s2"] },
  { family: "Plataforma Foundry/AIP", paths: ["p1", "p2", "p3", "p4", "p5"] },
  { family: "Oficio FDE", paths: ["f1", "f2"] },
  { family: "Profundidad SWE", paths: ["sw1", "sw2", "sw3", "sw4"] },
  { family: "Evaluación", paths: ["diagnostico", "retos", "expedientes"] },
];

// ── Nature (§5.3): a_mano by default; only these two cells are not. The phrase that justifies each one must be
// a literal substring of its source (A2-06: the fiche; F2-05: Proyecto 5 of §10).
const NATURE = {
  "A2-06": {
    valor: "mixto",
    rastro: "Localiza y corrige tres bugs sembrados con límites explícitos al asistente.",
    from: "fiche",
    parts: [
      { name: "Localizar con el asistente dentro de límites explícitos", nature: "delegable" },
      { name: "Corregir y defender el parche mínimo", nature: "a_mano" },
    ],
  },
  "F2-05": {
    valor: "mixto",
    rastro: "El uso de IA es permitido en construcción y se audita; la defensa posterior es independiente.",
    from: "proyecto5",
    parts: [
      { name: "Construcción de la vertical (IA permitida y auditada)", nature: "delegable" },
      { name: "Defensa posterior independiente", nature: "a_mano" },
    ],
  },
};
// ── Scope (§5.3): local + native verification in P1–P5, F0-08, F2-01..F2-04 and F2-06; local elsewhere.
function alcanceFor(code) {
  if (/^P[1-5]-/.test(code)) return "local+nativa";
  if (["F0-08", "F2-01", "F2-02", "F2-03", "F2-04", "F2-06"].includes(code)) return "local+nativa";
  return "local";
}
const REQUIRE_ENGLISH = new Set(["F1-06", "D8"]);

// ── Capabilities and critical conditions (RF-C2). The master program does not list them per cell, so the rule
// is explicit and literal: a capability (or condition) is declared when one of its stems appears in a field of the
// fiche, and its trace is the literal clause where it appears. The route's primary capability is always declared;
// when no stem names it, its trace is the mission itself. At most 3 capabilities and 2 conditions per cell; when no
// condition stem matches, "correctitud" is declared with the defence as trace.
const CAP_STEMS = [
  ["algoritmos", /algoritm|complejidad|recurrencia|grafo|amortiz|programación dinámica|búsqueda binaria|heap|intervalos?\b/i],
  ["abstraccion", /contrato|abstracci|interfaz|invariante|precondici|especificaci|modelo de objetos|ontolog/i],
  ["sistemas", /concurren|reintent|latencia|replica|réplica|consenso|almacenamiento|memoria|rendimiento|timeout|distribuid|caché|red\b|redes\b/i],
  ["datos", /\bdatos?\b|SQL|consulta|tabla|pipeline|linaje|dataset|índice|CSV|transformaci/i],
  ["ia", /\bIA\b|\bAIP\b|LLM|\bprompt|agente|\bRAG\b|recuperación aumentada|modelo de lenguaje/i],
  ["producto", /usuario|decisión operativa|cliente|discovery|prioriz|operador|flujo de trabajo|workflow/i],
  ["comunicacion", /explica|comunica|\bdemo\b|presenta|\bmemo\b|redacta|handoff|documenta|en inglés/i],
  ["responsabilidad", /incidente|postmortem|rollback|recupera|fall[ao]s?\b|reproduc|monitore|operación real/i],
];
const ROUTE_PRIMARY = {
  F0: "producto", A1: "algoritmos", A2: "algoritmos", S1: "datos", S2: "sistemas",
  P1: "datos", P2: "abstraccion", P3: "producto", P4: "ia", P5: "responsabilidad",
  F1: "producto", F2: "producto", SW1: "abstraccion", SW2: "sistemas", SW3: "sistemas", SW4: "sistemas",
  D: "algoritmos", X: "algoritmos", SD: "sistemas",
};
const CRIT_STEMS = [
  ["correctitud", "Correctitud", /correct|\bprueba|\btests?\b|verific|valida|bordes?\b|exact/i],
  ["identidad", "Identidad", /identidad|duplicad|deduplic|clave idempotente|\bconciliaci|\bIDs?\b/i],
  ["autorizacion", "Autorización", /permis|autoriz|acceso|marking|seguridad|privacidad/i],
  ["consistencia", "Consistencia", /consisten|concurren|idempot|transacci|aislamiento|carrera/i],
  ["trazabilidad", "Trazabilidad", /trazab|linaje|auditor|audita|registro|versión|reproducible|historial/i],
  ["recuperacion", "Recuperación", /recupera|reintent|rollback|compensaci|incidente|degrada|timeout|fallo parcial|reconcilia/i],
];

// ── Helpers ────────────────────────────────────────────────────────────────────────────────────────────────
class ExtractError extends Error {}
const fail = (code, msg) => {
  throw new ExtractError(`${code}: ${msg}`);
};
const pad2 = (n) => String(n).padStart(2, "0");
const CODE_RE = /^[A-Z0-9-]{1,6}$/;
export function codeHex(code) {
  if (!CODE_RE.test(code)) throw new ExtractError(`código inválido ${JSON.stringify(code)}`);
  let hex = "";
  for (let i = 0; i < code.length; i++) hex += code.charCodeAt(i).toString(16).padStart(2, "0");
  return hex.padStart(12, "0");
}
export const cellId = (code) => "cf000000-0000-4000-8000-" + codeHex(code);

/** Markdown links [label](url) with balanced parentheses inside the URL. */
export function links(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const lb = text.indexOf("[", i);
    if (lb < 0) break;
    let depth = 0;
    let j = lb;
    for (; j < text.length; j++) {
      if (text[j] === "[") depth++;
      else if (text[j] === "]") {
        depth--;
        if (depth === 0) break;
      }
    }
    if (j >= text.length || text[j + 1] !== "(") {
      i = lb + 1;
      continue;
    }
    let k = j + 2;
    let pd = 1;
    for (; k < text.length; k++) {
      if (text[k] === "(") pd++;
      else if (text[k] === ")") {
        pd--;
        if (pd === 0) break;
      }
    }
    const label = text.slice(lb + 1, j);
    const url = text.slice(j + 2, k).trim();
    if (/^https?:\/\//.test(url)) out.push({ label, url });
    i = k + 1;
  }
  return out;
}
/** Strip markdown links to their label. */
const unlink = (s) => {
  let out = s;
  for (const l of links(s)) out = out.replace(`[${l.label}](${l.url})`, l.label);
  return out;
};
const uniq = (xs) => [...new Set(xs)];

function tipoFor(url, clave) {
  const h = new URL(url).hostname;
  if (h === "www.palantir.com" && new URL(url).pathname.startsWith("/docs")) return "docs";
  if (h === "learn.palantir.com" || h === "certification.palantir.com" || /^C-\d{2}$/.test(clave)) return "curso";
  if (/youtube\.com$|youtu\.be$|vimeo\.com$/.test(h)) return "video";
  if (/blog\.palantir\.com$|medium\.com$|substack\.com$/.test(h)) return "blog";
  if (/arxiv\.org$|research\.google$|amazon\.science$|usenix\.org$|acm\.org$|\.pdf$/.test(h + new URL(url).pathname)) return "paper";
  if (/ocw\.mit\.edu$|cs61|datastructur\.es$|courses\.cs|csail\.mit\.edu$|\.edu$|cs144|github\.io$/.test(h)) return "curso";
  if (/reddit\.com$|stackoverflow\.com$|news\.ycombinator\.com$|community\./.test(h)) return "comunitario";
  return "otro";
}
function accesoFor(url) {
  const h = new URL(url).hostname;
  return h === "learn.palantir.com" || h === "certification.palantir.com" ? "cuenta" : "publico";
}
function sourceRef(l) {
  const m = l.label.match(/^([A-Z][A-Z0-9-]{0,11}) · (.+)$/s);
  const clave = m ? m[1] : "";
  const etiqueta = m ? m[2] : l.label;
  return { clave, etiqueta, url: l.url, tipo: tipoFor(l.url, clave), acceso: accesoFor(l.url) };
}
/** The literal clause of `text` that contains the regex match (split on . ; : followed by a space). */
function clauseOf(text, re) {
  const parts = text.split(/(?<=[.;:])\s+/);
  for (const p of parts) if (re.test(p)) return p.trim();
  return null;
}

// ── Parsing ───────────────────────────────────────────────────────────────────────────────────────────────
function sectionLines(lines, nn) {
  const start = lines.findIndex((l) => l.startsWith(`## ${nn}.`));
  if (start < 0) fail(`§${nn}`, "sección no encontrada");
  let end = lines.findIndex((l, i) => i > start && /^## \d\d\./.test(l));
  if (end < 0) end = lines.length;
  return lines.slice(start + 1, end);
}
const FIELD_RE = /^\*\*([^*]+?):\*\*\s*(.*)$/;

function parseRoutes(lines) {
  const sec = sectionLines(lines, "06");
  const routes = new Map();
  let route = null;
  let cell = null;
  const flushCell = () => {
    if (cell && route) route.cells.push(cell);
    cell = null;
  };
  for (const raw of sec) {
    const line = raw.replace(/\s+$/, "");
    let m;
    if ((m = line.match(/^### ([A-Z]{1,2}\d) · (.+)$/))) {
      flushCell();
      route = { code: m[1], heading: line.slice(4), title: m[2], fields: {}, cells: [] };
      if (routes.has(route.code)) fail(route.code, "ruta repetida");
      routes.set(route.code, route);
      continue;
    }
    if ((m = line.match(/^#### ([A-Z]{1,2}\d-\d{2}) · (.+)$/))) {
      flushCell();
      cell = { code: m[1], title: m[2], fields: {}, block: [line] };
      continue;
    }
    if (cell) {
      cell.block.push(line);
      if ((m = line.match(FIELD_RE))) cell.fields[m[1]] = m[2].trim();
      continue;
    }
    if (route && (m = line.match(FIELD_RE))) route.fields[m[1]] = m[2].trim();
  }
  flushCell();
  return routes;
}

function parseDiagnostics(lines) {
  const sec = sectionLines(lines, "13");
  const out = [];
  let cur = null;
  for (const raw of sec) {
    const line = raw.replace(/\s+$/, "");
    const m = line.match(/^### (D[1-8]) · (.+?) — (\d+) minutos$/);
    if (m) {
      if (cur) out.push(cur);
      cur = { code: m[1], title: m[2], minutos: Number(m[3]), body: [] };
      continue;
    }
    if (/^\*\*Salida del diagnóstico:\*\*/.test(line) || /^#{2,3} /.test(line)) {
      if (cur) out.push(cur);
      cur = null;
      continue;
    }
    if (cur) cur.body.push(line);
  }
  if (cur) out.push(cur);
  return out.map((d) => ({ ...d, enunciado: d.body.join("\n").trim() }));
}

function tableRows(sec, firstCellRe) {
  return sec
    .filter((l) => l.startsWith("|") && firstCellRe.test(l.split("|")[1]?.trim() ?? ""))
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
}

function parseRetos(lines) {
  const sec = sectionLines(lines, "09");
  return tableRows(sec, /^X\d{2}$/).map(([code, reto, entregable]) => ({ code, reto, entregable }));
}

function parseExpedientes(lines) {
  const sec = sectionLines(lines, "08");
  return tableRows(sec, /^SD-\d{2} · /).map(([caso, decision, fuentes, entregable]) => {
    const m = caso.match(/^(SD-\d{2}) · (.+)$/);
    return {
      code: m[1],
      title: m[2],
      decision,
      claves: fuentes.split(",").map((s) => s.trim()).filter(Boolean),
      entregable,
      inspiradoEnCatalogo: /Inspirado en/.test(decision),
    };
  });
}

function parseCatalog(lines) {
  const sec = sectionLines(lines, "20");
  const keys = new Map();
  const courses = new Map();
  for (const line of sec) {
    let m;
    if ((m = line.match(/^- \*\*\[([A-Z0-9-]+)\]\*\* (.+)$/))) {
      const l = links(m[2])[0];
      if (!l) fail(`[${m[1]}]`, "clave sin enlace");
      keys.set(m[1], { clave: m[1], etiqueta: l.label, url: l.url });
    } else if ((m = line.match(/^- \*\*(C-\d{2}):\*\* (.+)$/))) {
      const l = links(m[2])[0];
      if (!l) fail(m[1], "curso sin enlace");
      courses.set(m[1], { clave: m[1], etiqueta: l.label, url: l.url });
    }
  }
  return { keys, courses };
}

function proyecto5Text(lines) {
  const sec = sectionLines(lines, "10");
  const s = sec.findIndex((l) => l.startsWith("### Proyecto 5"));
  const e = sec.findIndex((l, i) => i > s && l.startsWith("### "));
  return sec.slice(s, e < 0 ? undefined : e).join("\n");
}

// ── Assembly ──────────────────────────────────────────────────────────────────────────────────────────────
function capabilitiesFor(routeCode, fieldsInOrder, mision) {
  const caps = [];
  const rastro = {};
  const primary = ROUTE_PRIMARY[routeCode];
  const find = (re) => {
    for (const t of fieldsInOrder) {
      if (!t) continue;
      const c = clauseOf(t, re);
      if (c) return c;
    }
    return null;
  };
  const primaryRe = CAP_STEMS.find(([k]) => k === primary)[1];
  caps.push(primary);
  rastro[primary] = find(primaryRe) ?? mision;
  for (const [cap, re] of CAP_STEMS) {
    if (caps.length >= 3) break;
    if (caps.includes(cap)) continue;
    const c = find(re);
    if (c) {
      caps.push(cap);
      rastro[cap] = c;
    }
  }
  return { caps, rastro };
}
function criticasFor(fieldsInOrder, defensa) {
  const out = [];
  for (const [id, texto, re] of CRIT_STEMS) {
    if (out.length >= 2) break;
    for (const t of fieldsInOrder) {
      if (!t) continue;
      const c = clauseOf(t, re);
      if (c) {
        out.push({ id, texto, rastro: c });
        break;
      }
    }
  }
  if (out.length === 0) out.push({ id: "correctitud", texto: "Correctitud", rastro: defensa });
  return out;
}
function etiquetasFor(code, fuentes) {
  const e = new Set();
  if (/^X\d{2}$/.test(code)) e.add("reto_propio");
  if (["SD-02", "SD-03", "SD-08"].includes(code)) e.add("inspirado_catalogo");
  if (["A2-08", "F2-07"].includes(code)) e.add("formato_practica");
  if (code === "F1-06") e.add("transcripcion_f106");
  for (const f of fuentes) {
    if (f.acceso === "cuenta") e.add("requiere_cuenta");
    if (/^C-\d{2}$/.test(f.clave)) e.add("seleccion_curso");
    if (f.clave === "ACCESS") e.add("acceso_comunidad");
    if (f.tipo === "video") e.add("video_no_revisado");
  }
  return [...e].sort();
}
const ENTRADA_CODE_RE = /\b(?:SW[1-4]|[FASP]\d)(?:-\d{2})?\b/g;

export function extract(maestroText) {
  const sha10 = createHash("sha256").update(maestroText, "utf8").digest("hex").slice(0, 10);
  const lines = maestroText.replace(/\r\n/g, "\n").split("\n");
  const routes = parseRoutes(lines);
  const diags = parseDiagnostics(lines);
  const retos = parseRetos(lines);
  const sds = parseExpedientes(lines);
  const catalog = parseCatalog(lines);
  const p5 = proyecto5Text(lines);

  // counts (§5.1): 124 route cells / 8 / 24 / 12
  const routeCells = [...routes.values()].reduce((n, r) => n + r.cells.length, 0);
  if (routeCells !== 124) fail("§06", `se esperaban 124 fichas, hay ${routeCells}`);
  if (diags.length !== 8) fail("§13", `se esperaban 8 tareas D, hay ${diags.length}`);
  if (retos.length !== 24) fail("§09", `se esperaban 24 retos, hay ${retos.length}`);
  if (sds.length !== 12) fail("§08", `se esperaban 12 expedientes, hay ${sds.length}`);
  // §20: the design counted 90 keys; the master program measured here has 91 distinct ones (all resolve).
  for (let i = 1; i <= 18; i++) if (!catalog.courses.has(`C-${pad2(i)}`)) fail("§20", `falta el curso C-${pad2(i)}`);

  const seen = new Set();
  const spinePaths = [];
  const spineCells = [];
  const meta = [];
  const routeData = {};
  const maestroUrls = {};

  for (const [slug, code, idTail, nCells, family] of ROUTES) {
    const pathId = "a1000000-0000-4000-8000-" + idTail;
    const cells = [];
    let name;
    let description;
    let header;
    if (code === "D" || code === "X" || code === "SD") {
      name = EXTRA_PATHS[code].name;
      description = EXTRA_PATHS[code].description;
      header = { entrada: "", entradaRecomendada: [], evidencia: "", apoyo: [] };
    } else {
      const r = routes.get(code);
      if (!r) fail(code, "ruta ausente en §06");
      if (r.cells.length !== nCells) fail(code, `se esperaban ${nCells} celdas, hay ${r.cells.length}`);
      name = r.heading;
      const entrada = r.fields["Entrada"];
      if (!entrada) fail(code, "falta «Entrada»");
      const evidencia = r.fields["Evidencia de esta ruta"] ?? "";
      const apoyoRaw = r.fields["Apoyo audiovisual/curso"] ?? r.fields["Cursos y recursos"];
      if (!apoyoRaw) fail(code, "falta «Apoyo audiovisual/curso» o «Cursos y recursos»");
      // description: «Evidencia de esta ruta»; SW routes have none, so theirs is «Cursos y recursos» as text.
      description = evidencia || `Cursos y recursos: ${unlink(apoyoRaw)}`;
      header = {
        entrada,
        entradaRecomendada: uniq(entrada.match(ENTRADA_CODE_RE) ?? []),
        evidencia,
        apoyo: links(apoyoRaw).map(sourceRef),
      };
      r.cells.forEach((c, i) => {
        const expect = `${code}-${pad2(i + 1)}`;
        if (c.code !== expect) fail(c.code, `orden inesperado (se esperaba ${expect})`);
      });
    }
    spinePaths.push({ id: pathId, slug, name, description });

    const pushCell = (code_, title, cls, extra) => {
      if (seen.has(code_)) fail(code_, "código repetido");
      seen.add(code_);
      cells.push({ code: code_, title, cls, ...extra });
    };
    if (code === "D") {
      for (const d of diags) {
        const urls = uniq(links(d.enunciado).map((l) => l.url));
        pushCell(d.code, `${d.code} · ${d.title}`, "diagnostico", {
          urls,
          fuentes: links(d.enunciado).map(sourceRef),
          ficha: { foco: d.title, fuentes: links(d.enunciado).map(sourceRef), mision: d.enunciado, defensa: d.enunciado },
          d: { minutos: d.minutos, enunciado: d.enunciado },
          authoredIn: urls.length ? undefined : "Programa integral §13, autoría propia",
        });
      }
    } else if (code === "X") {
      for (const x of retos) {
        pushCell(x.code, `${x.code} · ${x.reto}`, "reto", {
          urls: [],
          fuentes: [],
          ficha: { foco: x.reto, fuentes: [], mision: x.reto, defensa: x.entregable },
          x: { reto: x.reto, entregable: x.entregable },
          authoredIn: "Programa integral §09, autoría curricular propia",
        });
      }
    } else if (code === "SD") {
      for (const s of sds) {
        const fuentes = s.claves.map((k) => {
          const hit = catalog.keys.get(k);
          if (!hit) fail(s.code, `la clave [${k}] no resuelve en §20`);
          return sourceRef({ label: `${k} · ${hit.etiqueta}`, url: hit.url });
        });
        pushCell(s.code, `${s.code} · ${s.title}`, "expediente", {
          urls: uniq(fuentes.map((f) => f.url)),
          fuentes,
          ficha: { foco: s.title, fuentes, mision: s.decision, defensa: s.entregable },
          sd: { decision: s.decision, claves: s.claves, entregable: s.entregable, inspiradoEnCatalogo: s.inspiradoEnCatalogo },
        });
      }
    } else {
      const r = routes.get(code);
      for (const c of r.cells) {
        const f = c.fields;
        const foco = f["Foco de dominio"];
        const resultado = f["Resultado observable"];
        const lect = f["Lecturas y fuentes"] ?? f["Lecturas y trabajo publicado"];
        const mision = f["Misión"];
        const defensa = f["Defensa y transferencia"] ?? f["Defensa"];
        const variante = f["Variante propia"];
        if (!foco && !resultado) fail(c.code, "falta «Foco de dominio» o «Resultado observable»");
        if (!lect) fail(c.code, "falta «Lecturas y fuentes»");
        if (!mision) fail(c.code, "falta «Misión»");
        if (!defensa) fail(c.code, "falta «Defensa y transferencia» o «Defensa»");
        if (code.startsWith("SW") && !variante) fail(c.code, "falta «Variante propia»");
        const blockText = c.block.join("\n");
        const urls = uniq(links(blockText).map((l) => l.url));
        if (urls.length === 0) fail(c.code, "la ficha no cita ninguna URL");
        const ficha = {
          ...(foco ? { foco } : {}),
          ...(resultado ? { resultado } : {}),
          fuentes: links(lect).map(sourceRef),
          mision,
          defensa,
          ...(variante ? { variante } : {}),
        };
        pushCell(c.code, `${c.code} · ${c.title}`, "ruta", { urls, fuentes: ficha.fuentes, ficha });
      }
    }

    // finalize the cells of this path (spine + meta + route data)
    const outCells = [];
    for (const c of cells) {
      const nat = NATURE[c.code];
      if (nat) {
        const src = nat.from === "fiche" ? JSON.stringify(c.ficha) : p5;
        if (!src.includes(nat.rastro)) fail(c.code, "la frase de naturaleza no es literal de su fuente");
      }
      const id = cellId(c.code);
      const spineCell = {
        id,
        title: c.title,
        pathSlug: slug,
        ...(nat ? { nature: nat.valor, parts: nat.parts } : {}),
        sourceUrls: c.urls,
        ...(c.authoredIn ? { authoredIn: c.authoredIn } : {}),
      };
      spineCells.push(spineCell);
      meta.push({ code: c.code, cls: c.cls, alcance: alcanceFor(c.code) });
      maestroUrls[c.code] = c.urls;
      const flujo = flujoFor(c.code);
      const fieldsInOrder = [c.ficha.foco, c.ficha.resultado, c.ficha.mision, c.ficha.defensa, c.ficha.variante];
      const { caps, rastro } = capabilitiesFor(code, fieldsInOrder, c.ficha.mision);
      outCells.push({
        code: c.code,
        id,
        title: c.title,
        cls: c.cls,
        flujo,
        compuerta: compuertaFor(flujo),
        ficha: c.ficha,
        capacidades: caps,
        rastroCapacidades: rastro,
        criticas: criticasFor(fieldsInOrder, c.ficha.defensa),
        naturaleza: nat ? { valor: nat.valor, rastro: nat.rastro, parts: nat.parts } : { valor: "a_mano" },
        alcance: alcanceFor(c.code),
        ...(REQUIRE_ENGLISH.has(c.code) ? { requireEnglish: true } : {}),
        etiquetas: etiquetasFor(c.code, c.fuentes),
        ...(c.d ? { d: c.d } : {}),
        ...(c.x ? { x: c.x } : {}),
        ...(c.sd ? { sd: c.sd } : {}),
      });
    }
    if (outCells.length !== nCells) fail(code, `se esperaban ${nCells} celdas, hay ${outCells.length}`);
    routeData[slug] = { v: 1, slug, code, name, family, header, cells: outCells, maestro_sha10: sha10 };
  }
  if (seen.size !== 168) fail("total", `se esperaban 168 celdas, hay ${seen.size}`);
  return { sha10, spinePaths, spineCells, meta, routeData, maestroUrls, catalog };
}

// ── Writers ───────────────────────────────────────────────────────────────────────────────────────────────
const json = (v) => JSON.stringify(v, null, 2) + "\n";
function sortKeys(o) {
  return Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
}
export function renderSpinesForge(x) {
  const spine = {
    goalId: "a0000000-0000-4000-8000-000000000006",
    goalTitle: "Engineering Forge",
    color: "#ffffff",
    sigil: "forge",
    ownSeedBlock: true,
    paths: x.spinePaths,
    cells: x.spineCells,
  };
  return [
    "// GENERATED by scripts/forge/extract-maestro.mjs from the master program — do not edit by hand.",
    "// Regenerate: node scripts/forge/extract-maestro.mjs --maestro <path to the master program>",
    "// The LIGHT Forge spine (design §4.3): 19 paths and 168 cells with id, title, path, nature and the exact URLs of",
    "// each fiche. Missions, rubrics and the compuerta are lazy (src/forge/data/routes/*.json).",
    'import type { Spine } from "@/lib/spines";',
    "",
    `export const FORGE_MAESTRO_SHA10 = ${JSON.stringify(x.sha10)};`,
    "",
    "export interface ForgeCellMeta {",
    "  code: string;",
    '  cls: "ruta" | "diagnostico" | "reto" | "expediente";',
    '  alcance: "local" | "local+nativa";',
    "}",
    "",
    "/** code, class and scope of the 168 cells, in the order of FORGE_SPINE.cells */",
    `export const FORGE_CELL_META: readonly ForgeCellMeta[] = ${JSON.stringify(x.meta, null, 2)};`,
    "",
    "/** the six families of the route selector (RF-M12), with their path slugs */",
    `export const FORGE_FAMILIES: readonly { family: string; paths: string[] }[] = ${JSON.stringify(FAMILIES, null, 2)};`,
    "",
    `export const FORGE_SPINE: Spine = ${JSON.stringify(spine, null, 2)};`,
    "",
  ].join("\n");
}

function main(argv) {
  const ai = argv.indexOf("--maestro");
  const path = ai >= 0 ? argv[ai + 1] : process.env.ARCANUM_FORGE_MAESTRO;
  const check = argv.includes("--check");
  if (!path || !existsSync(path)) {
    console.error("uso: node scripts/forge/extract-maestro.mjs --maestro <ruta del programa maestro> [--check]");
    process.exit(2);
  }
  let x;
  try {
    x = extract(readFileSync(path, "utf8"));
  } catch (e) {
    if (e instanceof ExtractError) {
      console.error(`extract-maestro: ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
  const files = new Map();
  files.set(join(ROOT, "src", "lib", "spines-forge.ts"), renderSpinesForge(x));
  for (const [slug, data] of Object.entries(x.routeData)) files.set(join(ROOT, "src", "forge", "data", "routes", `${slug}.json`), json(data));
  files.set(join(ROOT, "src", "forge", "data", "maestro-urls.json"), json({ maestro_sha10: x.sha10, urls: sortKeys(x.maestroUrls) }));
  let diff = 0;
  for (const [file, content] of files) {
    const prev = existsSync(file) ? readFileSync(file, "utf8") : null;
    if (prev === content) continue;
    diff++;
    if (check) console.error(`difiere: ${file.slice(ROOT.length + 1)}`);
    else {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, content);
    }
  }
  const counts = Object.values(x.routeData).map((r) => `${r.slug}=${r.cells.length}`).join(" ");
  console.log(`extract-maestro: maestro_sha10=${x.sha10} celdas=${x.spineCells.length} rutas=${x.spinePaths.length} (${counts}); archivos ${check ? "distintos" : "escritos"}: ${diff}`);
  if (check && diff > 0) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
