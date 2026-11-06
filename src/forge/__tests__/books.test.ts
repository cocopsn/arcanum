import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseBook } from "@/lib/book";
import { CELL_SLUG_TO_ID } from "@/lib/cell-slugs";
import {
  allowedLinkSet,
  checkBookFigures,
  checkBookLinks,
  checkBookStructure,
  checkBookVideos,
  checkLibroLinks,
  figureParagraphs,
  isDocsUrl,
  leakedHiddenFacts,
  videoParagraphs,
  youtubeIdOf,
} from "@/forge/content/book-rules";

// CONTENT TEST of the Forge books (design §6.2, §13.1, §18.2; CA-24 to CA-27). Runs over whatever exists in
// content/forge/books/ — ZERO books is green. The allowed-link list comes from data other branches own
// (maestro-urls.json and catalog.json of c0-nucleo; atlas-docs-urls.json and videos.json of c0-atlas): while a
// source is missing, its rule is REPORTED as «pendiente de Atlas» / «pendiente de fichas» and does not fail.

const ROOT = process.cwd();
const BOOKS_DIR = join(ROOT, "content", "forge", "books");
const DATA = join(ROOT, "src", "forge", "data");
const CODE_RE = /^([a-z]+\d*)-(\d{2})$|^([a-z]+\d*)$/;

const readJson = (p: string): unknown => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, "")) : undefined);

function walkStrings(v: unknown, out: { values: string[]; ids: string[] }, key = ""): void {
  if (typeof v === "string") {
    out.values.push(v);
    if (/^(id|videoId|youtubeId|youtube_id)$/.test(key) && /^[A-Za-z0-9_-]{11}$/.test(v)) out.ids.push(v);
  } else if (Array.isArray(v)) v.forEach((x) => walkStrings(x, out, key));
  else if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (o.disponible === false || (typeof o.estado === "string" && /no disponible/i.test(o.estado))) return; // unavailable ids leave the list
    for (const [k, x] of Object.entries(o)) {
      if (/^[A-Za-z0-9_-]{11}$/.test(k) && x && typeof x === "object") out.ids.push(k);
      walkStrings(x, out, k);
    }
  }
}

function allowedSources() {
  const pending: string[] = [];
  const urls: string[] = [];
  const videoIds: string[] = [];
  const sources: [string, string][] = [
    ["maestro-urls.json", "pendiente de fichas"],
    ["catalog.json", "pendiente de fichas"],
    ["atlas-docs-urls.json", "pendiente de Atlas"],
    ["videos.json", "pendiente de Atlas"],
  ];
  for (const [file, label] of sources) {
    const json = readJson(join(DATA, file));
    if (json === undefined) {
      pending.push(`${file}: ${label}`);
      continue;
    }
    const acc = { values: [] as string[], ids: [] as string[] };
    walkStrings(json, acc);
    urls.push(...acc.values.filter((s) => /^https:\/\//.test(s)));
    videoIds.push(...acc.ids, ...acc.values.map(youtubeIdOf).filter((x): x is string => x !== null));
  }
  return { pending, urls, videoIds, haveVideos: existsSync(join(DATA, "videos.json")), haveAll: pending.length === 0 };
}

function bookHandles(): Set<string> {
  const out = new Set<string>(Object.keys(CELL_SLUG_TO_ID));
  for (const dir of [join(ROOT, "content", "books"), BOOKS_DIR]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".md"))) {
      const b = parseBook(readFileSync(join(dir, f), "utf8"));
      if (b?.meta.moduleId) out.add(b.meta.moduleId);
    }
  }
  return out;
}

const files = existsSync(BOOKS_DIR) ? readdirSync(BOOKS_DIR).filter((f) => f.endsWith(".md")).sort() : [];

describe("books · rules over fixtures of each form (§13.1, §18.2)", () => {
  it("video: watch and youtu.be with an 11-char id are recognized; extra params, other hosts and Vimeo are not", () => {
    expect(youtubeIdOf("https://www.youtube.com/watch?v=TOsgyjJuQVc")).toBe("TOsgyjJuQVc");
    expect(youtubeIdOf("https://youtu.be/vSJ5H00V7Es")).toBe("vSJ5H00V7Es");
    expect(youtubeIdOf("https://www.youtube.com/watch?v=TOsgyjJuQVc&t=10")).toBeNull();
    expect(youtubeIdOf("https://www.youtube.com/watch?v=TOsgyjJuQV")).toBeNull();
    expect(youtubeIdOf("https://vimeo.com/123456789")).toBeNull();
    const md = `Texto.\n\n[Logic Tools](https://www.youtube.com/watch?v=TOsgyjJuQVc "video")\n\n[OSDK](https://youtu.be/vSJ5H00V7Es "video")\n\n[Fuera](https://youtu.be/AAAAAAAAAAA "video")\n\n[Vimeo](https://vimeo.com/1 "video")\n\nUn [enlace](https://youtu.be/vSJ5H00V7Es "video") dentro de prosa no es video.`;
    expect(videoParagraphs(md)).toHaveLength(4);
    const errors = checkBookVideos(md, new Set(["TOsgyjJuQVc", "vSJ5H00V7Es"]));
    expect(errors).toHaveLength(2);
    expect(errors.join(" ")).toMatch(/AAAAAAAAAAA/);
    expect(errors.join(" ")).toMatch(/Vimeo/);
  });

  it("figure: only a docs page, an Atlas image of that page and an alt of ≤ 30 words", () => {
    const page = "https://www.palantir.com/docs/foundry/dev-toolchain/overview";
    const src = "https://www.palantir.com/docs/resources/foundry/dev-toolchain/3-Ontology.svg";
    const md = `![Diagrama del toolchain](${src} "figura ${page}")\n\n![Otra](https://evil.example/x.png "figura https://evil.example/docs/x")`;
    expect(figureParagraphs(md)).toHaveLength(2);
    expect(isDocsUrl(page)).toBe(true);
    expect(isDocsUrl("https://www.palantir.com.evil.example/docs/x")).toBe(false);
    const errors = checkBookFigures(md, (p) => (p === page ? [src] : null));
    expect(errors).toHaveLength(2);
    expect(checkBookFigures(`![${"palabra ".repeat(31).trim()}](${src} "figura ${page}")`, () => [src])).toHaveLength(1);
  });

  it("links: an explanation section without an allowed link fails; #libro: must resolve", () => {
    const book = parseBook(
      `---\ntitle: T\nmodule_id: forge-p2-06\n---\n\n## Qué es el cupo\nTexto sin enlaces sobre Foundry.\n\n## Ejemplo trabajado\nx\n\n## Contraejemplo\nx\n\n## Diagrama\n~~~text\nA -> B\n~~~\n\n## Conexiones\n[el libro de ITC](#libro:no-existe)\n\n## Preguntas\n- ¿?\n\n## Fuentes\n- [Docs](https://www.palantir.com/docs/foundry/ontology/overview)`,
    )!;
    expect(checkBookStructure(book)).toEqual([]);
    const allowed = allowedLinkSet({ urls: ["https://www.palantir.com/docs/foundry/ontology/overview"] });
    expect(checkBookLinks(book, allowed).join(" ")).toMatch(/Qué es el cupo/);
    expect(checkLibroLinks(book.sections.map((s) => s.markdown).join("\n"), new Set(["itc-c1"]))).toHaveLength(1);
  });

  it("structure: missing marker sections and a Diagrama without a text fence are reported", () => {
    const book = parseBook(`---\ntitle: T\n---\n\n## Diagrama\nsin cerca\n`)!;
    const errors = checkBookStructure(book).join(" | ");
    expect(errors).toMatch(/ejemplo trabajado/);
    expect(errors).toMatch(/cerca text/);
    expect(errors).toMatch(/explicación/);
  });

  it("hidden facts of an interview never appear in the book (RF-L7)", () => {
    expect(leakedHiddenFacts("El turno nocturno no registra paros.", ["El turno nocturno no registra paros."])).toHaveLength(1);
    expect(leakedHiddenFacts("Nada que ver.", ["El turno nocturno no registra paros."])).toHaveLength(0);
  });
});

describe("books · content/forge/books (zero books is green)", () => {
  const src = allowedSources();
  const handles = bookHandles();

  it(`there are ${files.length} Forge books; missing data sources are reported, not failed`, () => {
    // the figure-image membership needs the Atlas partitions (c0-atlas, §11.2): reported until the integration wires it
    console.info(`[books.test] ${[...src.pending, "imágenes de figura contra el Atlas: pendiente de Atlas"].join("; ")}`);
    expect(Array.isArray(files)).toBe(true);
  });

  it.each(files.map((f) => [f]))("%s satisfies the book contract", (f) => {
    const raw = readFileSync(join(BOOKS_DIR, f));
    expect(raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf, `${f} empieza con BOM`).toBe(false);
    const md = raw.toString("utf8");
    const book = parseBook(md);
    expect(book, `${f} no pasa parseBook`).not.toBeNull();
    const code = f.replace(/\.md$/, "");
    expect(CODE_RE.test(code), `${f}: el nombre debe ser el código en minúsculas`).toBe(true);
    expect(book!.meta.moduleId, `${f}: module_id debe ser forge-${code}`).toBe(`forge-${code}`);
    expect(book!.meta.estado, `${f}: estado nunca es «verificado» sin la corrida de bank-check`).not.toMatch(/^verificado$/i);
    const problems = [...checkBookStructure(book!), ...checkLibroLinks(md, handles)];
    if (src.haveAll) problems.push(...checkBookLinks(book!, allowedLinkSet({ urls: src.urls, videoIds: src.videoIds })));
    if (src.haveVideos) problems.push(...checkBookVideos(md, new Set(src.videoIds)));
    for (const fig of figureParagraphs(md)) {
      if (!isDocsUrl(fig.page)) problems.push(`la figura «${fig.text}» no apunta a una página de palantir.com/docs`);
    }
    if (code === "f1-03") {
      const bank = join(ROOT, "content", "forge", "exercises", "f1-03.md");
      if (existsSync(bank)) {
        const hidden = [...readFileSync(bank, "utf8").matchAll(/"texto"\s*:\s*"([^"]+)"\s*,\s*"oculto"\s*:\s*true/g)].map((m) => m[1]!);
        for (const leak of leakedHiddenFacts(md, hidden)) problems.push(`el libro de F1-03 contiene el hecho oculto «${leak.slice(0, 40)}…»`);
      }
    }
    expect(problems, `${f}:\n- ${problems.join("\n- ")}`).toEqual([]);
  });
});
