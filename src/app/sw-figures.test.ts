import { describe, expect, it } from "vitest";
import { FIGURES_CACHE, FIGURES_PERMIT_KEY, figureKey, makeFigureHandler, permitResponse, readPermitted } from "@/app/sw-rules";

// The figure handler of the service worker (design poblar §6.5), with a fake Cache Storage. Red-checks in
// redchecks-offline-motor.md: no allowlist → «una figura vista en línea sin descargar se guardó»; storing under the
// request URL → «la figura calentada quedó guardada con arcanum_fig y el libro no la encuentra»; no try around put →
// «con la cuota llena la figura dejó de pintarse también con red».

const FIG = "https://www.palantir.com/docs/resources/foundry/ontology/3-Ontology.svg";
const OTRA = "https://www.palantir.com/docs/resources/foundry/otra.png";

type R = Response | { type: string; ok: boolean; status: number; clone(): unknown };
class FakeCache {
  store = new Map<string, unknown>();
  putFails = false;
  async match(k: string | Request) {
    return this.store.get(typeof k === "string" ? k : k.url) as Response | undefined;
  }
  async put(k: string | Request, v: unknown) {
    if (this.putFails) throw new DOMException("quota", "QuotaExceededError");
    this.store.set(typeof k === "string" ? k : k.url, v);
  }
}
function setup(o: { permitted?: string[]; permitRaw?: Response; online?: boolean } = {}) {
  const cache = new FakeCache();
  if (o.permitRaw) cache.store.set(FIGURES_PERMIT_KEY, o.permitRaw);
  else if (o.permitted) cache.store.set(FIGURES_PERMIT_KEY, permitResponse(o.permitted));
  const opened: string[] = [];
  const fetched: string[] = [];
  const opaque = (): R => ({ type: "opaque", ok: false, status: 0, clone: () => opaque() });
  const handler = makeFigureHandler({
    caches: { open: async (n: string) => (opened.push(n), cache) } as unknown as CacheStorage,
    fetch: async (r: Request) => {
      fetched.push(r.url);
      if (o.online === false) throw new TypeError("Failed to fetch");
      return opaque() as Response;
    },
  });
  const req = (url: string) => ({ url, destination: "image" }) as unknown as Request;
  return { cache, handler, req, opened, fetched };
}

describe("figureHandler", () => {
  it("una figura permitida se guarda opaca bajo su URL canónica, en arcanum-forge-figuras-v1", async () => {
    const s = setup({ permitted: [FIG] });
    const res = await s.handler({ request: s.req(FIG) });
    expect(res.type).toBe("opaque");
    expect(s.opened).toEqual([FIGURES_CACHE]);
    expect((s.cache.store.get(FIG) as R | undefined)?.type).toBe("opaque");
  });
  it("la petición de calentamiento con arcanum_fig queda bajo la URL del libro", async () => {
    const s = setup({ permitted: [FIG] });
    await s.handler({ request: s.req(FIG + "?arcanum_fig=k3") });
    expect(s.fetched).toEqual([FIG + "?arcanum_fig=k3"]);
    expect(s.cache.store.has(FIG), "la figura calentada quedó guardada con arcanum_fig y el libro no la encuentra").toBe(true);
    expect(s.cache.store.has(FIG + "?arcanum_fig=k3")).toBe(false);
    expect(figureKey(FIG + "?arcanum_fig=k3")).toBe(FIG);
  });
  it("una figura no permitida se pinta pero no se guarda (ver un libro en línea no guarda nada)", async () => {
    const s = setup({ permitted: [OTRA] });
    const res = await s.handler({ request: s.req(FIG) });
    expect(res.type).toBe("opaque");
    expect(s.cache.store.has(FIG), "una figura vista en línea sin descargar se guardó").toBe(false);
  });
  it("sin lista, o con una lista inválida, nada se guarda (falla cerrado)", async () => {
    for (const permitRaw of [undefined, new Response("{no es json"), new Response(JSON.stringify({ v: 2, urls: [FIG] })), new Response(JSON.stringify({ v: 1, urls: Array(501).fill(FIG) }))]) {
      const s = setup({ permitRaw });
      await s.handler({ request: s.req(FIG) });
      expect(s.cache.store.has(FIG), "una figura vista en línea sin descargar se guardó").toBe(false);
    }
  });
  it("la lista sólo admite URLs de palantir.com/docs/resources sin consulta", async () => {
    const c = new FakeCache();
    c.store.set(FIGURES_PERMIT_KEY, new Response(JSON.stringify({ v: 1, urls: [FIG, FIG + "?x=1", "https://evil.test/docs/resources/a.png", 7] })));
    expect([...(await readPermitted(c as unknown as Cache))]).toEqual([FIG]);
  });
  it("si put rechaza (cuota llena), devuelve la respuesta de red y la figura se pinta", async () => {
    const s = setup({ permitted: [FIG] });
    s.cache.putFails = true;
    const res = await s.handler({ request: s.req(FIG) }).catch(() => null);
    expect(res?.type, "con la cuota llena la figura dejó de pintarse también con red").toBe("opaque");
  });
  it("lo guardado se sirve sin red, también al pedirlo con arcanum_fig", async () => {
    const s = setup({ permitted: [FIG], online: false });
    const saved = { type: "opaque", ok: false, status: 0, clone: () => saved };
    s.cache.store.set(FIG, saved);
    expect(await s.handler({ request: s.req(FIG) })).toBe(saved);
    expect(await s.handler({ request: s.req(FIG + "?arcanum_fig=zz") })).toBe(saved);
    expect(s.fetched).toEqual([]);
    await expect(s.handler({ request: s.req(OTRA) })).rejects.toThrow();
  });
});
