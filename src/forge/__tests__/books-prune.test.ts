import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { project } from "@/core/projector";
import { BOOKS_CACHE } from "@/app/sw-rules";
import { ensureForgeBook, forgeBookIndex } from "@/forge/loaders";

// Books are immutable by URL (design poblar §6.9): refreshing a code leaves ONE file of it in arcanum-forge-books-v1.
// Red-check in redchecks-offline-motor.md: no pruneBookVersions → «quedaron dos versiones de P2-06 en la caché».

function fakeCaches(urls: string[]) {
  const keys = urls.map((url) => ({ url }) as Request);
  const cache = {
    keys: async () => [...keys],
    match: async (r: Request) => (keys.some((k) => k.url === r.url) ? new Response("x".repeat(7)) : undefined),
    delete: async (r: Request) => {
      const i = keys.findIndex((k) => k.url === r.url);
      if (i >= 0) keys.splice(i, 1);
      return i >= 0;
    },
  };
  return { api: { has: async (n: string) => n === BOOKS_CACHE, open: async () => cache }, left: () => keys.map((k) => k.url) };
}
afterEach(() => vi.unstubAllGlobals());

describe("ensureForgeBook · una versión por código", () => {
  it("tras refrescar P2-06 queda un solo archivo de ese código (y los de otros códigos siguen)", async () => {
    const entry = (await forgeBookIndex())["P2-06"]!;
    const md = readFileSync(path.join(process.cwd(), "public/forge/books/v1", entry.file), "utf8");
    const base = "https://arcanum.test/forge/books/v1/";
    const c = fakeCaches([base + "p2-06.aaaaaaaaaa.md", base + entry.file, base + "p2-05.bbbbbbbbbb.md", base + "p2-061.cccccccccc.md"]);
    vi.stubGlobal("caches", c.api);
    vi.stubGlobal("fetch", async () => new Response(md));
    expect(await ensureForgeBook("P2-06", project([]))).toEqual({ ok: true, refreshed: true });
    const p206 = c.left().filter((u) => /\/p2-06\.[0-9a-f]{10}\.md$/.test(u));
    expect(p206, "quedaron dos versiones de P2-06 en la caché").toEqual([base + entry.file]);
    expect(c.left()).toContain(base + "p2-05.bbbbbbbbbb.md");
    expect(c.left()).toContain(base + "p2-061.cccccccccc.md");
  });
});
