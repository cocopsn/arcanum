// Generador del índice del compañero (design §8.1-§8.7; CA-13, CA-14, CA-15; §23.2 (e)(i), §23.3). Importa
// scripts/companion/build-index.mjs como books-publish.test.ts importa su script, y lo compara con los parsers de la
// app sobre todo el contenido del repo: 174 libros, 167 bancos y 168 celdas.
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseBook } from "@/lib/book";
import { explainExercisesMd, parseExercisesMd } from "@/lib/exercises-md";
import type { Exercise } from "@/lib/exercise";
import { FORGE_SCHEMAS, FORGE_TYPES } from "@/forge/bank/registry";
import { slugForCode } from "@/forge/ai";
import { LINEAS_FORGE, bancoValido, bloquesBanco } from "@/lib/companion/bloques.mjs";
import { tokenizar } from "@/lib/companion/tokenizar.mjs";
import { decodificarHashes, deBase64, contiene, gramas5, hash48, palabras } from "@/lib/companion/gramas.mjs";
import { construir, rutaForge, seccionesLibro } from "../../../../scripts/companion/build-index.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const leer = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const mds = (dir: string) =>
  readdirSync(path.join(ROOT, dir))
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => `${dir}/${f}`);
const LIBROS = [...mds("content/books"), ...mds("content/forge/books")];
const BANCOS = [...mds("content/exercises"), ...mds("content/forge/exercises")];

type Construido = ReturnType<typeof construir>;
type Particion = { f: string; p: string; spine: string; ruta: string | null; N: number; s: string[][]; d: [number, string, string, number][]; v: string; q: string };

/** Documentos de una partición con sus términos, decodificando v/q (§8.4). */
function docsDe(p: Particion): { archivo: string; ancla: string; etiqueta: string; terminos: Set<string> }[] {
  const out = p.d.map(([fi, ancla, etiqueta]) => ({ archivo: p.s[fi]?.[0] ?? "", ancla, etiqueta, terminos: new Set<string>() }));
  const vocab = p.v ? p.v.split(" ") : [];
  const listas = p.q ? p.q.split(";") : [];
  vocab.forEach((t, k) => {
    let doc = 0;
    for (const e of (listas[k] ?? "").split(",")) {
      doc += parseInt(e.split(":")[0] ?? "", 36);
      out[doc]?.terminos.add(t);
    }
  });
  return out;
}
const parsear = (r: Construido): Particion[] => r.particiones.map((p: { texto: string }) => JSON.parse(p.texto) as Particion);

/** Grupos de parseExercisesMd: uno por bloque `##`, por id sin el sufijo :js / :python (§8.7). */
function grupos(exs: Exercise[]): Exercise[][] {
  const out: Exercise[][] = [];
  let prev: string | null = null;
  for (const e of exs) {
    const base = e.id.replace(/:(js|python)$/, "");
    if (base === prev) out[out.length - 1]!.push(e);
    else out.push([e]);
    prev = base;
  }
  return out;
}

let repo: Construido;
let repoIdx: Particion[];
beforeAll(() => {
  repo = construir({ root: ROOT });
  repoIdx = parsear(repo);
});

describe("contenido del repo (lo que la paridad recorre)", () => {
  it("174 libros, 167 bancos y 168 celdas", () => {
    expect(LIBROS).toHaveLength(174);
    expect(BANCOS).toHaveLength(167);
    const codigos = readdirSync(path.join(ROOT, "src/forge/data/routes"))
      .filter((f) => f.endsWith(".json"))
      .flatMap((f) => (JSON.parse(leer(`src/forge/data/routes/${f}`)) as { cells: { code: string }[] }).cells.map((c) => c.code));
    expect(codigos).toHaveLength(168);
  });
});

describe("paridad con la app (§8.7, CA-14)", () => {
  it("libros: ids y títulos de sección de parseBook, y entrada si y sólo si hay lead o pregunta raíz", () => {
    const fallas: string[] = [];
    for (const rel of LIBROS) {
      const md = leer(rel);
      const app = parseBook(md);
      const gen = seccionesLibro(md);
      if (!app || !gen) {
        if (!app !== !gen) fallas.push(`el libro ${rel}: la app ${app ? "lo carga" : "lo rechaza"} y el generador no`);
        continue;
      }
      const secs = gen.docs.filter((d) => d.ancla !== "");
      const entrada = gen.docs.some((d) => d.ancla === "");
      if (entrada !== !!(app.lead || app.rootQuestion)) fallas.push(`el libro ${rel}: documento de entrada ${entrada} y la app ${!!(app.lead || app.rootQuestion)}`);
      if (secs.length !== app.sections.length) fallas.push(`el libro ${rel}: ${secs.length} secciones y la app ${app.sections.length}`);
      app.sections.forEach((s, i) => {
        const g = secs[i];
        if (!g || g.ancla !== s.id || g.etiqueta !== s.title) fallas.push(`el libro ${rel} no cuadra en la sección «${s.title}»: ${g?.ancla ?? "(nada)"} ≠ ${s.id}`);
      });
    }
    expect(fallas[0] ?? null, fallas.slice(0, 5).join("\n")).toBeNull();
  });

  it("bancos: un bloque por grupo de parseExercisesMd, con su título, su enunciado y los lenguajes de su firma", () => {
    const fallas: string[] = [];
    for (const rel of BANCOS) {
      const md = leer(rel);
      const app = parseExercisesMd(md);
      if (!app) {
        fallas.push(`la app no carga el banco ${rel}`);
        continue;
      }
      const gs = grupos(app.exercises);
      const bs = bloquesBanco(md);
      if (bs.length !== gs.length) {
        fallas.push(`el banco ${rel}: ${bs.length} bloques y ${gs.length} grupos en la app`);
        continue;
      }
      gs.forEach((g, i) => {
        const b = bs[i]!;
        const e = g[0]!;
        if (b.titulo !== e.title) fallas.push(`el bloque ${rel}#${i} no cuadra con la app: título «${b.titulo}» ≠ «${e.title}»`);
        if (b.enunciado !== e.statement) fallas.push(`el bloque ${rel}#${i} no cuadra con la app: enunciado`);
        if (e.kind === "code") {
          const langs = g.map((x) => (x.kind === "code" ? x.lang : "")).join(",");
          const firma = (b.firma ?? []).map((f) => f.lang).join(",");
          if (firma !== langs) fallas.push(`el bloque ${rel}#${i} no cuadra con la app: firma ${firma} ≠ ${langs}`);
        }
      });
    }
    expect(fallas[0] ?? null, fallas.slice(0, 5).join("\n")).toBeNull();
  });

  it("cada documento de banco del índice lleva la etiqueta del bloque de su ancla", () => {
    // La hidratación es la de pasajes.ts: bloquesBanco(md)[ancla]. Red-check: parseExercisesMd(md).exercises[ancla].
    const hidratar = (md: string, ancla: number) => bloquesBanco(md)[ancla]?.titulo ?? null;
    const cache = new Map<string, string>();
    let primera: string | null = null;
    let n = 0;
    for (const p of repoIdx.filter((x) => x.p.startsWith("bancos-") || x.p.startsWith("forge-bancos-"))) {
      for (const d of docsDe(p)) {
        if (!cache.has(d.archivo)) cache.set(d.archivo, leer(d.archivo));
        const obtenido = hidratar(cache.get(d.archivo)!, Number(d.ancla));
        n++;
        if (obtenido !== d.etiqueta && primera === null) primera = `el ancla ${d.archivo}#${d.ancla} apunta a otro ejercicio: ${d.etiqueta} ≠ ${obtenido}`;
      }
    }
    expect(n).toBeGreaterThan(1000);
    expect(primera).toBeNull();
  });

  it("las líneas propias de los 16 tipos de Forge son FORGE_SCHEMAS[t].lines", () => {
    expect(Object.keys(LINEAS_FORGE).sort()).toEqual([...FORGE_TYPES].sort());
    for (const t of FORGE_TYPES) expect([...LINEAS_FORGE[t]], `líneas de ${t}`).toEqual([...FORGE_SCHEMAS[t].lines]);
  });

  it("la ruta de cada uno de los 168 códigos es la de slugForCode", () => {
    const codigos = readdirSync(path.join(ROOT, "src/forge/data/routes"))
      .filter((f) => f.endsWith(".json"))
      .flatMap((f) => (JSON.parse(leer(`src/forge/data/routes/${f}`)) as { cells: { code: string }[] }).cells.map((c) => c.code));
    const malas = codigos.filter((c) => rutaForge(c) !== slugForCode(c)).map((c) => `${c}: ${rutaForge(c)} ≠ ${slugForCode(c)}`);
    expect(codigos).toHaveLength(168);
    expect(malas).toEqual([]);
  });
});

const FM = "---\nkind: exercises\ntitle: Sintético\nmodule_id: sintetico\nspine: ITC\n---\n\n";
const SINTETICOS: Record<string, string> = {
  "zz-sin-type.md": `${FM}## Ejercicio: Sin tipo\n\nEnunciado sin línea de tipo.\n\n### Modelo\n\nx\n`,
  "zz-id-repetido.md":
    `${FM}## Uno\n\ntype: production\nid: uno-dos\n\nEnunciado uno.\n\n### Modelo\n\nm\n\n### Regla\n\nr\n\n### Rúbrica\n\n- a\n\n` +
    `## Dos\n\ntype: production\nid: uno-dos\n\nEnunciado dos.\n\n### Modelo\n\nm\n\n### Regla\n\nr\n\n### Rúbrica\n\n- a\n`,
  "zz-cerca-abierta.md": `${FM}## Abierta\n\ntype: production\n\nEnunciado.\n\n\`\`\`js\nconst x = 1;\n\n### Modelo\n\nm\n\n### Regla\n\nr\n\n### Rúbrica\n\n- a\n`,
};

describe("bancos que la app no carga (§8.5, §8.7, r3 #11)", () => {
  let tmp: string;
  let conSinteticos: Construido;
  beforeAll(() => {
    tmp = mkdtempSync(path.join(tmpdir(), "companion-index-"));
    cpSync(path.join(ROOT, "content/exercises"), path.join(tmp, "content/exercises"), { recursive: true });
    cpSync(path.join(ROOT, "content/forge/exercises"), path.join(tmp, "content/forge/exercises"), { recursive: true });
    for (const [f, md] of Object.entries(SINTETICOS)) writeFileSync(path.join(tmp, "content/exercises", f), md);
    conSinteticos = construir({ root: tmp });
  });
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it("los tres bancos sintéticos los rechazan bancoValido y explainExercisesMd", () => {
    for (const [f, md] of Object.entries(SINTETICOS)) {
      expect(bancoValido(md).ok, `bancoValido aceptó ${f}`).toBe(false);
      expect(explainExercisesMd(md).ok, `explainExercisesMd aceptó ${f}`).toBe(false);
    }
  });

  it("ningún banco que explainExercisesMd rechaza tiene documentos en el índice", () => {
    const conDocs = new Set(parsear(conSinteticos).flatMap((p) => docsDe(p).map((d) => d.archivo)));
    const bancos = [...BANCOS.map((rel) => ({ rel, md: leer(rel) })), ...Object.entries(SINTETICOS).map(([f, md]) => ({ rel: `content/exercises/${f}`, md }))];
    let primera: string | null = null;
    for (const { rel, md } of bancos) {
      const r = explainExercisesMd(md);
      if (!r.ok && conDocs.has(rel) && primera === null) primera = `el índice apunta a un banco que la app no carga: ${rel} (${r.error})`;
    }
    expect(primera).toBeNull();
    expect(conSinteticos.excluidos.filter((e: { motivo: string }) => e.motivo.startsWith("banco inválido"))).toHaveLength(3);
  });
});

const SECCIONES_PUBLICAS = ["firma", "signature", "opciones", "options"];
const sinAcentos = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

describe("exclusiones (§8.2, CA-13, §23.2 (e)(i))", () => {
  it("un documento de banco sólo trae términos de su título, enunciado, firma u opciones", () => {
    let primera: string | null = null;
    const cache = new Map<string, { bloques: ReturnType<typeof bloquesBanco>; grupos: Exercise[][] }>();
    for (const p of repoIdx.filter((x) => x.p.startsWith("bancos-") || x.p.startsWith("forge-bancos-"))) {
      for (const d of docsDe(p)) {
        if (primera !== null) break;
        if (!cache.has(d.archivo)) {
          const md = leer(d.archivo);
          cache.set(d.archivo, { bloques: bloquesBanco(md), grupos: grupos(parseExercisesMd(md)?.exercises ?? []) });
        }
        const c = cache.get(d.archivo)!;
        const i = Number(d.ancla);
        const b = c.bloques[i];
        const g = c.grupos[i] ?? [];
        if (b?.tipo === "giro") {
          primera = `un texto reservado entró al índice: giro ${d.archivo}#${i}`;
          break;
        }
        if (b?.tipo === "retencion") {
          primera = `un ítem de retención entró al índice: ${d.archivo}#${i}`;
          break;
        }
        // lo permitido sale del modelo de la app (parseExercisesMd), no de bloques.mjs
        const permitido = new Set<string>();
        for (const e of g) {
          for (const t of tokenizar(e.title)) permitido.add(t);
          for (const t of tokenizar(e.statement)) permitido.add(t);
          if (e.kind === "code") for (const t of tokenizar(e.starter)) permitido.add(t);
          if (e.kind === "choice") for (const t of tokenizar(e.options.join("\n"))) permitido.add(t);
        }
        const extra = [...d.terminos].filter((t) => !permitido.has(t));
        if (extra.length === 0) continue;
        for (const s of b?.secciones ?? []) {
          if (SECCIONES_PUBLICAS.some((r) => sinAcentos(s.titulo).startsWith(r))) continue;
          const sec = new Set(tokenizar(s.cuerpo.join("\n")));
          const t = extra.find((x) => sec.has(x));
          if (t === undefined) continue;
          primera = sinAcentos(s.titulo).startsWith("hechos")
            ? `un texto reservado entró al índice: hechos ${d.archivo}#${i}`
            : `una solución entró al índice: ${d.archivo}#${i} (### ${s.titulo}: ${t})`;
          break;
        }
        if (primera === null) primera = `un documento de banco trae términos fuera de su enunciado: ${d.archivo}#${i} (${extra.slice(0, 3).join(", ")})`;
      }
    }
    expect(primera).toBeNull();
  });

  it("ninguna fuente del índice es pilots.json y los 145 giro y retencion quedan fuera", () => {
    const fuentes = repoIdx.flatMap((p) => p.s.map((s) => s[0] ?? ""));
    const piloto = fuentes.find((f) => f.includes("pilots.json"));
    expect(piloto ? `un texto reservado entró al índice: ${piloto}` : null).toBeNull();
    const motivos = repo.excluidos.map((e: { motivo: string }) => e.motivo);
    expect(motivos.filter((m: string) => m === "giro").length + motivos.filter((m: string) => m === "retencion").length).toBe(145);
  });

  it("reservado.json trae los 11 de 11 5-gramas de los tres hechos ocultos de F1-03 y ningún texto en claro", () => {
    const res = JSON.parse(repo.reservado.texto) as { f: string; n: number; h: string };
    expect(res.f).toBe("arcanum-companion-reservado/1");
    const bytes = deBase64(res.h);
    expect(bytes).not.toBeNull();
    const tabla = decodificarHashes(bytes!);
    expect(tabla?.length).toBe(res.n);
    // la extracción de cell-panel-reserved.test.tsx
    const pilotos = JSON.parse(leer("src/forge/data/pilots.json")) as { pilotos: { code: string; campos: { etiqueta: string; texto: string }[] }[] };
    const sesion = pilotos.pilotos.find((p) => p.code === "F1-03")?.campos.find((c) => c.etiqueta.startsWith("Sesión"))?.texto ?? "";
    const hechos = sesion.slice(sesion.indexOf(":") + 1).split(/,\s+| y el /).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 5);
    expect(hechos).toHaveLength(3);
    let total = 0;
    let vivos = 0;
    for (const h of hechos) {
      for (const { g } of gramas5(palabras(h))) {
        total++;
        if (contiene(tabla!, hash48(g))) vivos++;
      }
    }
    expect(`${vivos} de ${total}`).toBe("11 de 11");
    const todo = repo.particiones.map((p: { texto: string }) => p.texto).join("\n") + repo.reservado.texto;
    for (const h of hechos) expect(todo.includes(h), "un hecho oculto de F1-03 quedó en claro en el índice").toBe(false);
  });
});

describe("determinismo (§8.5, CA-15)", () => {
  it("dos corridas dan los mismos sha10, y sha10 es sha256(texto)[:10]", async () => {
    const otra = construir({ root: ROOT });
    const a = repo.manifiesto.particiones.map((p: { nombre: string; sha10: string }) => `${p.nombre}:${p.sha10}`);
    const b = otra.manifiesto.particiones.map((p: { nombre: string; sha10: string }) => `${p.nombre}:${p.sha10}`);
    expect(b).toEqual(a);
    expect(otra.reservado.sha10).toBe(repo.reservado.sha10);
    const { createHash } = await import("node:crypto");
    for (const p of repo.particiones) expect(p.sha10).toBe(createHash("sha256").update(p.texto).digest("hex").slice(0, 10));
  });

  it("los nombres de partición son libros-/bancos- + slug del spine y, en Forge, la ruta", () => {
    const nombres = repo.manifiesto.particiones.map((p: { nombre: string }) => p.nombre);
    expect(nombres).toContain("libros-fred");
    expect(nombres).toContain("bancos-oa-amazon");
    expect(nombres).toContain("forge-libros-p2");
    expect(nombres).toContain("forge-bancos-expedientes");
    expect(nombres).toContain("forge-fichas");
    for (const p of repoIdx) expect(p.f).toBe("arcanum-companion-index/1");
  });
});
