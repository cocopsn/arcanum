import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isApi,
  isAtlasHashed,
  isAtlasManifest,
  isAtlasVideos,
  isFigureRequest,
  isForgeBook,
  isNavigation,
  isPyodide,
  isWebManifest,
  type MatchArgs,
} from "@/app/sw-rules";

// Matchers of the service worker (design poblar §6.2). Red-check in redchecks-offline-motor.md: widening the book
// regex to any .md → «un .md sin sha10 entró a la caché inmutable de libros».

const ORIGIN = "https://arcanum.test";
const arg = (href: string, req: Partial<Request> = {}): MatchArgs => {
  const url = new URL(href, ORIGIN);
  return { url, request: { mode: "cors", destination: "", ...req } as Request, sameOrigin: url.origin === ORIGIN };
};

describe("sw-rules · matchers", () => {
  it("libros de Forge: sólo <código>.<sha10>.md bajo /forge/books/v1/ del mismo origen", () => {
    expect(isForgeBook(arg("/forge/books/v1/p2-06.0123456789.md"))).toBe(true);
    expect(isForgeBook(arg("/forge/books/v1/a1-01.02cf15ecce.md"))).toBe(true);
    for (const bad of ["/forge/books/v1/p2-06.md", "/forge/books/v1/notas.md", "/forge/books/v1/p2-06.012345678.md", "/forge/books/v1/P2-06.0123456789.md", "/forge/books/v1/sub/p2-06.0123456789.md", "/forge/books/v2/p2-06.0123456789.md"]) {
      expect(isForgeBook(arg(bad)), "un .md sin sha10 entró a la caché inmutable de libros").toBe(false);
    }
    expect(isForgeBook(arg("https://otro.test/forge/books/v1/p2-06.0123456789.md")), "un libro de otro origen entró a la caché de libros").toBe(false);
  });

  it("Atlas: particiones e índices con sha10 (CacheFirst), manifiesto y videos aparte", () => {
    expect(isAtlasHashed(arg("/atlas/v1/docs/en/foundry/data-integration.0123456789.json"))).toBe(true);
    expect(isAtlasHashed(arg("/atlas/v1/index/en.0.a2eee5ecfe.json"))).toBe(true);
    expect(isAtlasHashed(arg("/atlas/v1/alias.edd1e15427.json"))).toBe(true);
    expect(isAtlasHashed(arg("/atlas/v1/manifest.json"))).toBe(false);
    expect(isAtlasHashed(arg("/atlas/v1/videos/oembed.json"))).toBe(false);
    expect(isAtlasHashed(arg("https://otro.test/atlas/v1/alias.edd1e15427.json"))).toBe(false);
    expect(isAtlasManifest(arg("/atlas/v1/manifest.json"))).toBe(true);
    expect(isAtlasManifest(arg("/atlas/v1/manifest.json.bak"))).toBe(false);
    expect(isAtlasVideos(arg("/atlas/v1/videos/oembed.json"))).toBe(true);
    expect(isAtlasVideos(arg("/atlas/v1/videos/canales.json"))).toBe(true);
    expect(isAtlasVideos(arg("/atlas/v1/videos/otro.json"))).toBe(false);
  });

  it("figuras: imagen de palantir.com/docs/resources sin consulta o con exactamente ?arcanum_fig=<nonce>", () => {
    const fig = "https://www.palantir.com/docs/resources/foundry/ontology/3-Ontology.svg";
    const img = { destination: "image" as RequestDestination };
    expect(isFigureRequest(arg(fig, img))).toBe(true);
    expect(isFigureRequest(arg(fig + "?arcanum_fig=k3", img))).toBe(true);
    expect(isFigureRequest(arg(fig + "?arcanum_fig=k3&x=1", img))).toBe(false);
    expect(isFigureRequest(arg(fig + "?v=1", img))).toBe(false);
    expect(isFigureRequest(arg(fig + "?arcanum_fig=", img))).toBe(false);
    expect(isFigureRequest(arg(fig + "?arcanum_fig=K3", img))).toBe(false);
    expect(isFigureRequest(arg(fig)), "un fetch (destino vacío) de una figura entró a la regla de figuras").toBe(false);
    expect(isFigureRequest(arg("https://www.palantir.com/docs/foundry/ontology/", img))).toBe(false);
    expect(isFigureRequest(arg("https://build.palantir.com/docs/resources/x.png", img))).toBe(false);
  });

  it("API, Pyodide, manifiesto de la app y navegaciones", () => {
    expect(isApi(arg("/api/session"))).toBe(true);
    expect(isApi(arg("https://otro.test/api/session"))).toBe(false);
    expect(isPyodide(arg("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.asm.wasm"))).toBe(true);
    expect(isPyodide(arg("https://cdn.jsdelivr.net/npm/otra"))).toBe(false);
    expect(isWebManifest(arg("/manifest.webmanifest"))).toBe(true);
    expect(isWebManifest(arg("https://otro.test/manifest.webmanifest"))).toBe(false);
    expect(isNavigation(arg("/", { mode: "navigate" }))).toBe(true);
    expect(isNavigation(arg("/"))).toBe(false);
  });
});

describe("sw.ts · orden y estrategias de runtimeCaching", () => {
  const src = readFileSync(path.join(process.cwd(), "src/app/sw.ts"), "utf8");
  const order = [...src.matchAll(/matcher: (\w+)/g)].map((m) => m[1]);

  it("las nueve reglas propias van en el orden de §6.2 y antes de defaultCache", () => {
    expect(order).toEqual(["isApi", "isPyodide", "isForgeBook", "isAtlasHashed", "isAtlasManifest", "isAtlasVideos", "isFigureRequest", "isWebManifest", "isNavigation"]);
    expect(src.indexOf("...defaultCache")).toBeGreaterThan(src.indexOf("matcher: isNavigation"));
  });
  it("Pyodide va en NetworkOnly (el worker es el único que escribe en arcanum-pyodide)", () => {
    expect(src, "el SW volvió a guardar Pyodide: dos escritores en arcanum-pyodide").toContain("{ matcher: isPyodide, handler: new NetworkOnly() }");
  });
  it("/manifest.webmanifest sale de arcanum-shell, calentado al instalar", () => {
    expect(src).toMatch(/matcher: isWebManifest, handler: new NetworkFirst\(\{ cacheName: SHELL_CACHE/);
    expect(src).toContain("for (const url of [SHELL_URL, WEB_MANIFEST_URL])");
  });
  it("libros y particiones con sha10 en CacheFirst que sólo guarda 200", () => {
    expect(src).toContain("{ matcher: isForgeBook, handler: new CacheFirst({ cacheName: BOOKS_CACHE, plugins: only200() }) }");
    expect(src).toContain("{ matcher: isAtlasHashed, handler: new CacheFirst({ cacheName: ATLAS_CACHE, plugins: only200() }) }");
  });
});
