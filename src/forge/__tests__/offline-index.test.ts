import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FORGE_PATHS } from "@/forge/ids";
import { bookFigures, buildOfflineIndex, ROUTE_SLUGS, writeOfflineIndex } from "../../../scripts/forge/offline-index.mjs";

// The download index (design poblar §6.4). With fixtures: books, banks, python/sqlite, Atlas partitions by page and by
// alias, figures; the code→slug table is the one of ids.ts; a bank that changes to python changes the index on the
// next run (no cache). With the real data: no citation left unresolved in the 19 routes. Red-checks in
// redchecks-offline-motor.md.

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
function put(root: string, rel: string, text: string) {
  const p = path.join(root, rel);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, text);
}
const bank = (code: string, body: string) => `---\nkind: exercises\nmodule_id: forge-${code.toLowerCase()}\n---\n${body}`;
const JS_ITEM = "## Código\ntype: code\nid: c1\nEnunciado.\n### Solución\n```javascript\nfunction f(){ return 1 }\n```\n";
const PY_ITEM = "## Código\ntype: code\nid: c1\nEnunciado.\n### Solución\n```python\ndef f():\n    return 1\n```\n";
const SQL_ITEM = "## Consulta\ntype: sql\nid: q1\nEnunciado.\n### Solución\n```sql\nSELECT 1\n```\n";
const FIG_A = "https://www.palantir.com/docs/resources/foundry/a.png";
const FIG_B = "https://www.palantir.com/docs/resources/foundry/b.svg";
const PAGE_A = "https://www.palantir.com/docs/foundry/ontology/overview";
const PAGE_B = "https://www.palantir.com/docs/foundry/data-integration/pipelines";
const ALIAS_OF_B = "https://www.palantir.com/docs/foundry/viejo/pipelines";

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "offline-index-"));
  dirs.push(root);
  put(root, "src/forge/data/book-index.json", JSON.stringify({
    "S1-01": { file: "s1-01.0123456789.md", sha10: "0123456789", bytes: 40, minutes: 5, title: "S1-01" },
    "P2-01": { file: "p2-01.abcdefabcd.md", sha10: "abcdefabcd", bytes: 50, minutes: null, title: "P2-01" },
  }));
  put(root, "src/forge/data/bank-index.json", JSON.stringify({ "S1-01": { sha10: "1111111111" }, "P2-01": { sha10: "2222222222" } }));
  put(root, "content/forge/exercises/s1-01.md", bank("S1-01", JS_ITEM));
  put(root, "content/forge/exercises/p2-01.md", bank("P2-01", SQL_ITEM));
  put(root, "public/forge/books/v1/s1-01.0123456789.md", `# S1-01\n\n![una](${FIG_A} "figura ${PAGE_A}")\n\nTexto con ![inline](${FIG_B}) dentro.\n`);
  put(root, "public/forge/books/v1/p2-01.abcdefabcd.md", `# P2-01\n\n![una](${FIG_A} "figura ${PAGE_A}")\n![dos](${FIG_B})\n![otra](https://build.palantir.com/x.png)\n![q](${FIG_B}?v=1)\n`);
  put(root, "public/atlas/v1/docs/en/foundry/ontology.0000000001.json", JSON.stringify({ v: 1, pages: [{ u: PAGE_A }] }));
  put(root, "public/atlas/v1/docs/en/foundry/data-integration.0000000002.json", JSON.stringify({ v: 1, pages: [{ u: PAGE_B }, { u: PAGE_B + "-2" }] }));
  put(root, "public/atlas/v1/alias.0000000003.json", JSON.stringify({ v: 1, alias: [[ALIAS_OF_B, PAGE_B, "descubierta"]] }));
  put(root, "public/atlas/v1/celdas.0000000004.json", JSON.stringify({
    v: 1,
    celdas: [
      { codigo: "S1-01", ruta: "S1", directas: [PAGE_A + "/"], por_base: {} },
      { codigo: "P2-01", ruta: "P2", directas: [PAGE_A, PAGE_B + "#seccion"], por_base: {} },
      { codigo: "X9-01", ruta: "P1", directas: [ALIAS_OF_B], por_base: {} },
    ],
  }));
  put(root, "public/atlas/v1/manifest.json", JSON.stringify({
    v: 1,
    fuente_sha10: "f000000001",
    particiones: [
      { id: "en/foundry/ontology", files: ["docs/en/foundry/ontology.0000000001.json"] },
      { id: "en/foundry/data-integration", files: ["docs/en/foundry/data-integration.0000000002.json"] },
    ],
    alias: "alias.0000000003.json",
    capas: { celdas: { archivo: "celdas.0000000004.json" } },
  }));
  return root;
}

describe("offline-index · con fixtures", () => {
  it("libros, bancos, Python, SQLite, particiones y figuras por ruta", () => {
    const { index } = buildOfflineIndex(fixture());
    expect(index.atlas_fuente).toBe("f000000001");
    expect(Object.keys(index.rutas).sort()).toEqual(Object.values(ROUTE_SLUGS).sort());
    const s1 = index.rutas.s1!;
    expect(s1.libros).toEqual([{ code: "S1-01", file: "s1-01.0123456789.md", bytes: 40 }]);
    expect(s1.bancos).toEqual(["S1-01"]);
    expect(s1).toMatchObject({ python: false, sqlite: false });
    expect(s1.atlas.map((a: { file: string }) => a.file)).toEqual(["docs/en/foundry/ontology.0000000001.json"]);
    // only a figure paragraph on its own line counts; an inline image does not
    expect(s1.figuras).toEqual([FIG_A]);
    const p2 = index.rutas.p2!;
    expect(p2, "un ítem sql no pidió SQLite ni Python").toMatchObject({ python: true, sqlite: true });
    expect(p2.atlas.map((a: { file: string }) => a.file)).toEqual(["docs/en/foundry/data-integration.0000000002.json", "docs/en/foundry/ontology.0000000001.json"]);
    expect(p2.atlas[0]!.bytes).toBe(readFileSync(path.join(dirs[0]!, "public/atlas/v1/docs/en/foundry/data-integration.0000000002.json")).length);
    // palantir.com/docs/resources only, without query, without repeats
    expect(p2.figuras).toEqual([FIG_A, FIG_B]);
    for (const r of Object.values(index.rutas) as { sin_resolver: string[] }[]) if (r !== index.rutas.p1) expect(r.sin_resolver).toEqual([]);
  });

  it("una cita que sólo existe como alias se resuelve a su partición", () => {
    const { index } = buildOfflineIndex(fixture());
    expect(index.rutas.p1!.sin_resolver, "X9-01 cita una URL que sólo existe como alias y quedó sin resolver").toEqual([]);
    expect(index.rutas.p1!.atlas.map((a: { file: string }) => a.file)).toEqual(["docs/en/foundry/data-integration.0000000002.json"]);
  });

  it("una cita que ninguna partición tiene no rompe: se anota en sin_resolver y se avisa", () => {
    const root = fixture();
    const celdas = JSON.parse(readFileSync(path.join(root, "public/atlas/v1/celdas.0000000004.json"), "utf8"));
    celdas.celdas[0].directas.push("https://www.palantir.com/docs/foundry/no-existe");
    put(root, "public/atlas/v1/celdas.0000000004.json", JSON.stringify(celdas));
    const { index, avisos } = buildOfflineIndex(root);
    expect(index.rutas.s1!.sin_resolver).toEqual(["S1-01 https://www.palantir.com/docs/foundry/no-existe"]);
    expect(avisos.some((a: string) => a.includes("no-existe"))).toBe(true);
  });

  it("sin caché: un banco que pasa a python cambia el índice en la corrida siguiente", () => {
    const root = fixture();
    expect(writeOfflineIndex(root).index.rutas.s1!.python).toBe(false);
    put(root, "content/forge/exercises/s1-01.md", bank("S1-01", PY_ITEM));
    writeOfflineIndex(root);
    const written = JSON.parse(readFileSync(path.join(root, "src/forge/data/offline-index.json"), "utf8"));
    expect(written.rutas.s1.python, "la ruta S1 tiene ítems python y el índice cacheado no pide Python").toBe(true);
  });

  it("la tabla código de ruta → slug es la de FORGE_PATHS (ids.ts)", () => {
    expect(ROUTE_SLUGS).toEqual(Object.fromEntries(FORGE_PATHS.map((p) => [p.code, p.slug])));
  });

  it("bookFigures toma sólo párrafos de figura de palantir.com/docs/resources", () => {
    expect(bookFigures(`![a](${FIG_A} "figura x")\n  ![b](${FIG_B})  \n![c](https://evil.test/docs/resources/x.png)\nx ![d](${FIG_A})`)).toEqual([FIG_A, FIG_B]);
  });
});

describe("offline-index · con los datos reales", () => {
  const { index } = buildOfflineIndex(process.cwd());
  it("las 19 rutas no dejan ninguna cita sin resolver", () => {
    for (const [slug, r] of Object.entries(index.rutas) as [string, { sin_resolver: string[] }][]) {
      for (const s of r.sin_resolver) {
        const [code, url] = s.split(" ");
        expect.fail(`${code} cita ${url} y ninguna partición la tiene (ruta ${slug})`);
      }
    }
    expect(Object.keys(index.rutas)).toHaveLength(19);
  });
  it("S1 pide Python y SQLite; los 128 libros y bancos publicados están en alguna ruta", () => {
    expect(index.rutas.s1!.sqlite, "la ruta S1 tiene ítems sql y el índice no pide SQLite").toBe(true);
    expect(index.rutas.s1!.python).toBe(true);
    const all = Object.values(index.rutas) as { libros: unknown[]; bancos: unknown[] }[];
    expect(all.reduce((n, r) => n + r.libros.length, 0)).toBe(128);
    expect(all.reduce((n, r) => n + r.bancos.length, 0)).toBe(128);
  });
});
