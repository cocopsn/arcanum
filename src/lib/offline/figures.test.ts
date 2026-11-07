import { afterEach, describe, expect, it, vi } from "vitest";
import { FIGURES_CACHE } from "@/app/sw-rules";
import { isFigureCached, loadImage } from "@/lib/offline/figures";
import { realRunDeps } from "@/forge/offline/run";

// La carga de una figura distingue «no pintó» de «venció el plazo», y la página olvida la entrada canónica de una figura
// que no pintó (revisión de offline-motor, MEDIUM 1: el SW guarda opaca también una respuesta de error y la sirve
// primero, con o sin red).
const FIG = "https://www.palantir.com/docs/resources/foundry/x.png";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Un Image falso que dispara onload u onerror, o nada, cuando se le pone src. */
function stubImage(como: "ok" | "error" | "nada") {
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    referrerPolicy = "";
    set src(_v: string) {
      queueMicrotask(() => (como === "ok" ? this.onload?.() : como === "error" ? this.onerror?.() : undefined));
    }
  }
  vi.stubGlobal("Image", FakeImage);
}

describe("loadImage", () => {
  it("dice «ok», «error» (onerror inmediato) o «tiempo» (vencieron los ms)", async () => {
    stubImage("ok");
    expect(await loadImage(FIG, 50)).toBe("ok");
    stubImage("error");
    expect(await loadImage(FIG, 50), "un onerror inmediato se reportó como plazo vencido").toBe("error");
    vi.useFakeTimers();
    stubImage("nada");
    const p = loadImage(FIG, 10_000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await p).toBe("tiempo");
  });
});

describe("forgetFigure (dependencia real de runDownload)", () => {
  it("borra la entrada canónica de arcanum-forge-figuras-v1, así el estado vuelve a decir que falta", async () => {
    const store = new Map<string, Map<string, Response>>();
    const open = async (name: string) => {
      if (!store.has(name)) store.set(name, new Map());
      const m = store.get(name)!;
      return {
        match: async (k: string) => m.get(k),
        put: async (k: string, r: Response) => void m.set(k, r),
        delete: async (k: string) => m.delete(k),
      };
    };
    vi.stubGlobal("caches", { has: async (n: string) => store.has(n), open });
    await (await open(FIGURES_CACHE)).put(FIG, new Response("error opaco"));
    expect(await isFigureCached(FIG)).toBe(true);
    await realRunDeps().forgetFigure(FIG);
    expect(await isFigureCached(FIG), "la figura que no pintó siguió guardada: «Reintentar» no vuelve a la red").toBe(false);
  });
});
