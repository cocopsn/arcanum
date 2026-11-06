import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

// Design §6.2: ensureForgeBook materializes or refreshes a cell's book by the index (code → file + sha10), never
// clobbers an import, reads the old row offline, and only answers «formato» when there is nothing readable.
const IDX = vi.hoisted(() => ({ value: {} as Record<string, { file: string; sha10: string; bytes: number; minutes: number; title: string }> }));
vi.mock("@/forge/data/book-index.json", () => ({
  get default() {
    return IDX.value;
  },
}));

import { ensureForgeBook, loadForgeBookMd } from "@/forge/loaders";
import { getBookForModule, saveBook } from "@/lib/book-store";
import { forgeCellId } from "@/forge/ids";
import type { ReadModel } from "@/core/read-model";

const RM = { evidence: [] } as unknown as ReadModel;
const sha10 = (s: string) => createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex").slice(0, 10);
const book = (code: string, body: string) =>
  [
    "---",
    `module_id: forge-${code.toLowerCase()}`,
    "spine: Engineering Forge",
    `title: Libro ${code}`,
    "---",
    "> la pregunta raíz",
    "",
    "## Núcleo",
    body,
    "",
    "## Fuentes",
    "- https://www.palantir.com/docs/foundry/",
  ].join("\n");

function index(code: string, md: string) {
  const s = sha10(md);
  // the loader memoizes the index object, so the fixture mutates that same object
  IDX.value[code] = { file: `${code.toLowerCase()}.${s}.md`, sha10: s, bytes: md.length, minutes: 1, title: `Libro ${code}` };
}
function serve(map: Record<string, string>) {
  const f = vi.fn(async (url: string) => {
    const name = String(url).split("/").pop() ?? "";
    return name in map ? new Response(map[name], { status: 200 }) : new Response("no", { status: 404 });
  });
  vi.stubGlobal("fetch", f);
  return f;
}
afterEach(() => vi.unstubAllGlobals());

describe("ensureForgeBook (books-loader, §6.2)", () => {
  it("a seed row with an old md is replaced and answers refreshed: true", async () => {
    await saveBook(book("P2-01", "versión vieja"), "seed");
    const md = book("P2-01", "versión nueva del despliegue");
    index("P2-01", md);
    serve({ [`p2-01.${sha10(md)}.md`]: md });
    expect(await ensureForgeBook("P2-01", RM), "un libro ya materializado no se refrescó tras un despliegue").toEqual({ ok: true, refreshed: true });
    expect((await getBookForModule(forgeCellId("P2-01")))?.md).toBe(md);
  });

  it("an import row is never touched", async () => {
    const mine = book("P2-02", "mi edición");
    await saveBook(mine, "import");
    const md = book("P2-02", "la del despliegue");
    index("P2-02", md);
    const f = serve({ [`p2-02.${sha10(md)}.md`]: md });
    expect(await ensureForgeBook("P2-02", RM)).toEqual({ ok: true, refreshed: false });
    expect(f).not.toHaveBeenCalled();
    expect((await getBookForModule(forgeCellId("P2-02")))?.md).toBe(mine);
  });

  it("a row equal to the index makes no fetch", async () => {
    const md = book("P2-03", "igual al índice");
    await saveBook(md, "seed");
    index("P2-03", md);
    const f = serve({});
    expect(await ensureForgeBook("P2-03", RM)).toEqual({ ok: true, refreshed: false });
    expect(f).not.toHaveBeenCalled();
  });

  it("offline and no row → no-descargado", async () => {
    index("P2-04", book("P2-04", "x"));
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    expect(await ensureForgeBook("P2-04", RM)).toEqual({ ok: false, reason: "no-descargado" });
  });

  it("no row and a file whose sha10 differs → formato", async () => {
    const md = book("P2-05", "la del índice");
    index("P2-05", md);
    serve({ [`p2-05.${sha10(md)}.md`]: book("P2-05", "otra cosa") });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await ensureForgeBook("P2-05", RM)).toEqual({ ok: false, reason: "formato" });
    err.mockRestore();
  });

  it("an old row and a file whose sha10 differs → reads the old row, which stays the same", async () => {
    const old = book("P2-07", "la vieja, legible");
    await saveBook(old, "seed");
    const md = book("P2-07", "la del índice");
    index("P2-07", md);
    serve({ [`p2-07.${sha10(md)}.md`]: book("P2-07", "dañada") });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      await ensureForgeBook("P2-07", RM),
      "un libro legible quedó inaccesible porque el archivo nuevo no coincidió con el índice",
    ).toEqual({ ok: true, refreshed: false });
    err.mockRestore();
    expect((await getBookForModule(forgeCellId("P2-07")))?.md).toBe(old);
  });

  it("an unknown code is desconocido and never builds a URL from free text", async () => {
    const f = serve({});
    expect(await ensureForgeBook("../etc", RM)).toEqual({ ok: false, reason: "desconocido" });
    expect(await loadForgeBookMd("ZZ-99")).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});
