import { describe, expect, it } from "vitest";
import { project } from "@/core/projector";
import type { OfflinePlan } from "@/forge/offline/plan";
import { FIGURE_ERROR, FIGURE_TIMEOUT, runDownload, spaceText, type RunDeps } from "@/forge/offline/run";
import type { OfflineRouteRow } from "@/lib/offline-store";
import { OPAQUE_PAD_BYTES } from "@/lib/offline/rules";
import type { ScopeStatus } from "@/lib/offline/types";

// The download of a route (design poblar §6.4 «Descarga»; anexo r2 [17]) with every dependency faked. Red-check in
// redchecks-offline-motor.md: asking for the canonical URL → «la descarga pidió la figura con la URL del libro: el
// navegador la sirve sin pasar por el SW».

const FIG = ["https://www.palantir.com/docs/resources/a.png", "https://www.palantir.com/docs/resources/b.svg"];
const plan: OfflinePlan = {
  key: "forge:p2",
  libros: [{ code: "P2-01", file: "p2-01.0123456789.md", bytes: 1000 }],
  bancos: ["P2-01"],
  python: true,
  sqlite: false,
  atlas: [{ file: "docs/en/foundry/a.0000000001.json", bytes: 300 }],
  figuras: FIG,
};
const rc = (n: number) => ({ listos: 0, total: n, faltan: [], bytes: 0 });
const estado = (o: Partial<ScopeStatus> = {}): ScopeStatus => ({
  libros: rc(1), bancos: rc(1), atlas: rc(2), python: rc(5), figuras: rc(2), app: { listos: 1, total: 1 }, completa: false, bytesPrevistos: 2_000_000, cuotaFiguras: 2 * OPAQUE_PAD_BYTES, ...o,
});

function fakes(over: Partial<RunDeps> = {}) {
  const log: string[] = [];
  const rows: OfflineRouteRow[] = [];
  const images: string[] = [];
  let n = 0;
  const deps: Partial<RunDeps> = {
    online: () => true,
    requestPersist: async () => (log.push("persist"), true),
    freeBytes: async () => 10_000_000_000,
    status: async () => estado(),
    saveRoute: async (r) => {
      log.push("saveRoute");
      rows.push(r);
    },
    listRoutes: async () => rows,
    ensureBook: async (c) => (log.push(`book ${c}`), { ok: true, refreshed: true }),
    ensureBank: async (c) => (log.push(`bank ${c}`), { ok: true, refreshed: true, pendientes: [] }),
    fetchOk: async (u) => (log.push(`fetch ${u}`), true),
    warmPython: async () => (log.push("python"), { ok: true }),
    writePermitted: async (u) => void log.push(`permit ${u.length}`),
    loadImage: async (src) => (images.push(src), "ok"),
    forgetFigure: async (u) => void log.push(`forget ${u}`),
    nonce: () => `n${++n}`,
    afterAtlas: async () => void log.push("pruneAtlas"),
    now: () => 1,
    ...over,
  };
  return { deps, log, rows, images };
}
const rm = project([]);

describe("runDownload", () => {
  it("en orden: persist, registro antes de bajar, libros, bancos, Atlas, Python, lista de figuras y figuras", async () => {
    const f = fakes();
    const r = await runDownload(plan, { readModel: rm }, f.deps);
    expect(r.ok).toBe(true);
    expect(f.log).toEqual(["persist", "saveRoute", "book P2-01", "bank P2-01", "fetch /atlas/v1/manifest.json", "fetch /atlas/v1/docs/en/foundry/a.0000000001.json", "pruneAtlas", "python", "permit 2"]);
    expect(f.rows[0]).toMatchObject({ key: "forge:p2", world: "forge", slug: "p2", recursos: { libros: ["P2-01"], atlas: ["docs/en/foundry/a.0000000001.json"], figuras: FIG } });
  });
  it("las figuras se piden con arcanum_fig y un nonce distinto en cada corrida", async () => {
    const f = fakes();
    await runDownload(plan, { readModel: rm }, f.deps);
    await runDownload(plan, { readModel: rm }, f.deps);
    for (const src of f.images) {
      expect(FIG.includes(src), "la descarga pidió la figura con la URL del libro: el navegador la sirve sin pasar por el SW").toBe(false);
    }
    expect(f.images).toEqual([FIG[0] + "?arcanum_fig=n1", FIG[1] + "?arcanum_fig=n1", FIG[0] + "?arcanum_fig=n2", FIG[1] + "?arcanum_fig=n2"]);
  });
  it("una figura que no pinta se olvida de la caché (si no, el SW sirve el error guardado para siempre) y su motivo distingue error de plazo", async () => {
    // review offline-motor, MEDIUM 1: the SW stores an opaque error like a figure; only the page sees onerror
    const f = fakes({ loadImage: async (src) => (src.startsWith(FIG[0]!) ? "error" : "tiempo") });
    const r = await runDownload(plan, { readModel: rm }, f.deps);
    if (!r.ok) throw new Error("se esperaba ok con fallidos");
    expect(f.log, "una figura que respondió con error quedó guardada: el SW la seguirá sirviendo rota y «Reintentar» no la reemplaza").toContain(`forget ${FIG[0]}`);
    expect(f.log).toContain(`forget ${FIG[1]}`);
    expect(r.fallidos[0]?.motivo, "un onerror inmediato se reportó como plazo vencido").toBe(FIGURE_ERROR);
    expect(r.fallidos[1]?.motivo, "un plazo vencido se reportó como error de la figura").toBe(FIGURE_TIMEOUT);
    expect(r.fallidos).toEqual([
      { tipo: "figuras", id: FIG[0], motivo: FIGURE_ERROR },
      { tipo: "figuras", id: FIG[1], motivo: FIGURE_TIMEOUT },
    ]);
    expect(FIGURE_ERROR, "un onerror inmediato se reportó como plazo vencido").not.toBe(FIGURE_TIMEOUT);
    const ok = fakes();
    await runDownload(plan, { readModel: rm }, ok.deps);
    expect(ok.log.some((x) => x.startsWith("forget")), "una figura que sí pintó se borró de la caché").toBe(false);
  });
  it("figuras: false no pide ninguna ni las registra", async () => {
    const f = fakes();
    const r = await runDownload(plan, { readModel: rm, figuras: false }, f.deps);
    expect(r.ok).toBe(true);
    expect(f.images).toEqual([]);
    expect(f.rows[0]!.recursos.figuras).toEqual([]);
    expect(f.log.some((x) => x.startsWith("permit"))).toBe(false);
  });
  it("sin red no hace nada", async () => {
    const f = fakes({ online: () => false });
    expect(await runDownload(plan, { readModel: rm }, f.deps)).toEqual({ ok: false, motivo: "sin-red", detalle: "La descarga necesita conexión" });
    expect(f.log).toEqual([]);
  });
  it("con espacio < 1.2 × lo previsto (figuras incluidas) avisa con las cifras; forzar lo salta y sin figuras se vuelve a evaluar", async () => {
    const libre = 15_000_000; // previsto con figuras = 2 MB + 14.7 MB de cuota
    const f = fakes({ freeBytes: async () => libre });
    const r = await runDownload(plan, { readModel: rm }, f.deps);
    expect(r).toEqual({
      ok: false,
      motivo: "sin-espacio",
      detalle: spaceText(libre, 2_000_000 + 2 * OPAQUE_PAD_BYTES, 2, 2 * OPAQUE_PAD_BYTES),
      espacio: { libreBytes: libre, previstoBytes: 2_000_000 + 2 * OPAQUE_PAD_BYTES, cuotaFigurasBytes: 2 * OPAQUE_PAD_BYTES, figuras: 2 },
    });
    expect(!r.ok && r.detalle).toBe("Espacio libre ≈ 15 MB; esta descarga ocupa ≈ 2 MB, y las 2 figuras de palantir.com cuentan ≈ 15 MB más de cuota en este navegador.");
    expect(f.rows).toEqual([]);
    expect((await runDownload(plan, { readModel: rm, figuras: false }, f.deps)).ok).toBe(true);
    expect((await runDownload(plan, { readModel: rm, forzar: true }, fakes({ freeBytes: async () => libre }).deps)).ok).toBe(true);
  });
  it("cancelar devuelve «cancelado» y conserva lo guardado y la fila de routes", async () => {
    const ac = new AbortController();
    const f = fakes({ ensureBook: async () => (ac.abort(), { ok: true, refreshed: true }) });
    const r = await runDownload(plan, { readModel: rm, signal: ac.signal }, f.deps);
    expect(r).toMatchObject({ ok: false, motivo: "cancelado" });
    expect(f.rows).toHaveLength(1);
    expect(f.log.some((x) => x.startsWith("bank"))).toBe(false);
  });
  it("lo que falla queda en fallidos con el estado real; una cuota llena detiene el resto", async () => {
    const f = fakes({
      ensureBook: async () => ({ ok: false, reason: "no-descargado" }),
      fetchOk: async () => {
        throw new DOMException("lleno", "QuotaExceededError");
      },
    });
    const r = await runDownload(plan, { readModel: rm }, f.deps);
    if (!r.ok) throw new Error("se esperaba ok con fallidos");
    expect(r.fallidos[0]).toEqual({ tipo: "libros", id: "P2-01", motivo: "no-descargado" });
    expect(r.fallidos.slice(1).length).toBeGreaterThan(0);
    for (const x of r.fallidos.slice(1)) expect(x).toMatchObject({ tipo: "atlas", motivo: "sin espacio" });
    expect(f.log.includes("python"), "con la cuota llena la descarga siguió con Python").toBe(false);
    expect(f.images).toEqual([]);
  });
});
