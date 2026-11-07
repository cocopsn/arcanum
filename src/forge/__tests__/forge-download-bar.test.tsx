import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DeleteResult, DownloadOptions, DownloadResult, ResourceCount, ScopeStatus } from "@/lib/offline/types";
import type { OfflineRouteRow } from "@/lib/offline-store";
import type { LibraryRow } from "@/lib/library/types";
import type { ReadModel } from "@/core/read-model";
import { OPAQUE_PAD_BYTES } from "@/lib/offline/rules";

// La barra de descarga de Lecturas y «Borrar del dispositivo» (design poblar §5.4, §5.5, §6.4, §6.7 y §6.11; anexo r2
// [17]). La fachada (src/lib/offline/api.ts) y el registro de routes se simulan: lo que se prueba es lo que la pantalla
// hace con cada respuesta. Los cuerpos reales de la fachada tienen sus pruebas (offline-run, offline-verify,
// offline-delete); el recorrido real lo cubre el E2E descarga-lecturas.cjs.
const api = vi.hoisted(() => ({
  forgeRouteStatus: vi.fn(),
  forgeWorldStatus: vi.fn(),
  downloadForgeRoute: vi.fn(),
  downloadForgeWorld: vi.fn(),
  deleteForgeRoute: vi.fn(),
  deleteForgeWorld: vi.fn(),
  deleteForgeBookLocal: vi.fn(),
  forgeBookCacheFiles: vi.fn(),
  storageReport: vi.fn(),
}));
const store = vi.hoisted(() => ({ rows: [] as OfflineRouteRow[] }));
vi.mock("@/lib/offline/api", () => api);
vi.mock("@/lib/offline-store", async (orig) => ({ ...(await orig<object>()), listRouteRows: async () => store.rows }));

import { ForgeDownloadBar } from "@/forge/ui/library/ForgeDownloadBar";
import { APP_NO_INSTALADA, IOS_SIN_INSTALAR } from "@/forge/ui/library/download-bar-text";
import { partialText } from "@/forge/offline/verify";

const rc = (listos: number, total: number, bytes: number | null = 0): ResourceCount => ({ listos, total, faltan: [], bytes });
const status = (o: Partial<ScopeStatus> = {}): ScopeStatus => ({
  libros: rc(0, 8),
  bancos: rc(8, 8, null),
  atlas: rc(0, 5),
  python: rc(0, 6),
  figuras: rc(0, 7, null),
  app: { listos: 257, total: 257 },
  completa: false,
  bytesPrevistos: 2_500_000,
  cuotaFiguras: 7 * OPAQUE_PAD_BYTES,
  ...o,
});
const COMPLETA = status({ libros: rc(8, 8), atlas: rc(5, 5), python: rc(6, 6), figuras: rc(7, 7, null), completa: true, bytesPrevistos: 0, cuotaFiguras: 0 });
const PARCIAL = status({ libros: rc(7, 8), atlas: rc(5, 5), python: rc(6, 6), figuras: rc(7, 7, null), bytesPrevistos: 10_000, cuotaFiguras: 0 });
const row = (key: string): OfflineRouteRow => ({ key, world: "forge", slug: key.slice(6), ts: 1, recursos: { libros: [], atlas: [], figuras: [] } });
const rm = { goals: [], paths: [], modules: [], edges: [] } as unknown as ReadModel;
const freed = (o: Partial<DeleteResult> = {}): DeleteResult => ({ liberadosBytes: 84_120, compartidosBytes: 1_200_000, figurasBorradas: 0, errores: [], ...o });

function bar(o: { slug?: string | null; onChanged?: () => void } = {}) {
  const slug = o.slug === undefined ? "s1" : o.slug;
  return render(<ForgeDownloadBar slug={slug} code={slug ? slug.toUpperCase() : null} readModel={rm} onChanged={o.onChanged ?? (() => {})} />);
}
/** Una descarga que no termina hasta que la prueba la resuelve, o hasta que la señal se aborta (cancelado). */
function pendingDownload() {
  const box: { opts: DownloadOptions | null; resolve: (r: DownloadResult) => void } = { opts: null, resolve: () => {} };
  api.downloadForgeRoute.mockImplementation(
    (_slug: string, opts: DownloadOptions) =>
      new Promise<DownloadResult>((resolve) => {
        box.opts = opts;
        box.resolve = resolve;
        opts.signal?.addEventListener("abort", () => resolve({ ok: false, motivo: "cancelado", detalle: "Descarga cancelada: lo ya guardado se conserva" }));
      }),
  );
  return box;
}

beforeEach(() => {
  store.rows = [];
  api.forgeRouteStatus.mockResolvedValue(status());
  api.forgeWorldStatus.mockResolvedValue(status({ libros: rc(0, 128), bytesPrevistos: 40_100_000 }));
  api.storageReport.mockResolvedValue({ persistente: true, usoBytes: 1, cuotaBytes: 2, iosSinInstalar: false });
  api.forgeBookCacheFiles.mockResolvedValue(null);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("barra de descarga · estados (design poblar §5.5 y §6.4)", () => {
  it("sin descargar: ofrece la ruta con su tamaño y la línea de figuras con su cuota, sin «Borrar descarga»", async () => {
    bar();
    expect(await screen.findByRole("button", { name: "Descargar ruta S1 · ≈ 2.5 MB" })).toBeInTheDocument();
    expect(screen.getByText("Sin descargar")).toBeInTheDocument();
    expect(screen.getByText("Incluye 7 figuras de palantir.com (≈ 51 MB de cuota)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Borrar descarga" })).toBeNull();
    expect(api.forgeRouteStatus).toHaveBeenCalledWith("s1");
  });

  it("descargando: pasa readModel y una señal a la fachada, y pinta el progreso por tipo", async () => {
    const box = pendingDownload();
    bar();
    fireEvent.click(await screen.findByRole("button", { name: /Descargar ruta S1/ }));
    await waitFor(() => expect(box.opts).not.toBeNull());
    expect(api.downloadForgeRoute.mock.calls[0]![0]).toBe("s1");
    expect(box.opts!.readModel).toBe(rm);
    expect(box.opts!.signal).toBeInstanceOf(AbortSignal);
    expect(screen.getByText("Preparando la descarga…")).toBeInTheDocument();
    act(() => box.opts!.onProgress?.(3, 30, "libros"));
    expect(screen.queryByText("Descargando libros · 3 de 30"), "la descarga no mostró su progreso").not.toBeNull();
    expect(screen.getByRole("progressbar", { name: "Progreso de la descarga" }).getAttribute("aria-valuenow")).toBe("3");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    store.rows = [row("forge:s1")];
    api.forgeRouteStatus.mockResolvedValue(COMPLETA);
    await act(async () => box.resolve({ ok: true, estado: COMPLETA, fallidos: [] }));
    expect(await screen.findByText("Descargada ✓ · 8/8 libros")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("parcial: dice qué falta con el texto de §6.4 y «Reintentar» vuelve a descargar", async () => {
    store.rows = [row("forge:s1")];
    api.forgeRouteStatus.mockResolvedValue(PARCIAL);
    api.downloadForgeRoute.mockResolvedValue({ ok: true, estado: PARCIAL, fallidos: [{ tipo: "libros", id: "S1-04", motivo: "no-descargado" }] });
    bar();
    expect(await screen.findByText("7 de 8 libros listos sin red; 1 falló: Reintentar")).toBeInTheDocument();
    const retry = screen.queryByRole("button", { name: "Reintentar" });
    expect(retry, "una ruta a medias no ofreció Reintentar").not.toBeNull();
    expect(screen.getByRole("button", { name: "Borrar descarga" })).toBeInTheDocument();
    await act(async () => fireEvent.click(retry!));
    await waitFor(() => expect(api.downloadForgeRoute).toHaveBeenCalledTimes(1));
  });

  it("«Descargada ✓» sale sólo de completa: registrada e incompleta es parcial, y sin registro es «Sin descargar»", async () => {
    store.rows = [row("forge:s1")];
    api.forgeRouteStatus.mockResolvedValue(COMPLETA);
    bar();
    expect(await screen.findByText("Descargada ✓ · 8/8 libros")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Borrar descarga" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Descargar ruta/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reintentar figuras" })).toBeNull();
    cleanup();
    // completa con una figura que no pintó (se olvidó de la caché): sigue «Descargada ✓» y ofrece volver a pedirla
    api.forgeRouteStatus.mockResolvedValue({ ...COMPLETA, figuras: rc(6, 7, null), cuotaFiguras: OPAQUE_PAD_BYTES });
    bar();
    expect(await screen.findByText("Descargada ✓ · 8/8 libros")).toBeInTheDocument();
    expect(screen.getByText("Incluye 7 figuras de palantir.com (≈ 51 MB de cuota) · 6 guardadas")).toBeInTheDocument();
    const rf = screen.queryByRole("button", { name: "Reintentar figuras" });
    expect(rf, "una figura que faltaba no se pudo volver a pedir desde la barra").not.toBeNull();
    api.downloadForgeRoute.mockResolvedValue({ ok: true, estado: COMPLETA, fallidos: [] });
    await act(async () => fireEvent.click(rf!));
    expect(api.downloadForgeRoute).toHaveBeenCalledWith("s1", expect.objectContaining({ readModel: rm }));
    cleanup();
    api.forgeRouteStatus.mockResolvedValue(PARCIAL);
    bar();
    await screen.findByText("7 de 8 libros listos sin red; 1 falló: Reintentar");
    expect(screen.queryByText(/Descargada ✓/), "la barra dijo Descargada ✓ con la ruta incompleta").toBeNull();
  });

  it("cancelado: «Cancelar» aborta la señal y la barra lo dice; lo guardado queda como parcial", async () => {
    const box = pendingDownload();
    bar();
    fireEvent.click(await screen.findByRole("button", { name: /Descargar ruta S1/ }));
    await waitFor(() => expect(box.opts).not.toBeNull());
    store.rows = [row("forge:s1")];
    api.forgeRouteStatus.mockResolvedValue(PARCIAL);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Cancelar" })));
    expect(box.opts!.signal!.aborted, "«Cancelar» no detuvo la descarga").toBe(true);
    expect(await screen.findByText("Descarga cancelada: lo ya guardado se conserva")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("cerrar Lecturas (desmontar la barra) cancela la descarga en curso (anexo r2 [17])", async () => {
    const box = pendingDownload();
    const { unmount } = bar();
    fireEvent.click(await screen.findByRole("button", { name: /Descargar ruta S1/ }));
    await waitFor(() => expect(box.opts).not.toBeNull());
    unmount();
    expect(box.opts!.signal!.aborted, "cerrar Lecturas no canceló la descarga en curso").toBe(true);
  });

  it("sin service worker: la barra dice que la app no está instalada para usarse sin red (§6.11)", async () => {
    api.forgeRouteStatus.mockResolvedValue(status({ app: null }));
    bar();
    await screen.findByText("Sin descargar");
    expect(screen.queryByText(APP_NO_INSTALADA), "sin service worker la barra no dijo que la app no está instalada para usarse sin red").not.toBeNull();
    // la misma frase que pone partialText cuando ya se intentó: no hay dos textos para el mismo hecho
    expect(partialText(status({ app: null }))).toContain(APP_NO_INSTALADA);
    // el botón sigue: libros y bancos quedan en Dexie aunque el SW no controle (§6.11, «Parcial»)
    expect(screen.getByRole("button", { name: /Descargar ruta S1/ })).toBeInTheDocument();
  });

  it("Safari de iOS sin instalar: avisa del borrado a 7 días (§6.7)", async () => {
    api.storageReport.mockResolvedValue({ persistente: false, usoBytes: null, cuotaBytes: null, iosSinInstalar: true });
    bar();
    await screen.findByText("Sin descargar");
    expect(await screen.findByText(IOS_SIN_INSTALAR).catch(() => null), "Safari sin instalar no avisó del borrado a 7 días en Lecturas").not.toBeNull();
    cleanup();
    api.storageReport.mockResolvedValue({ persistente: true, usoBytes: 1, cuotaBytes: 2, iosSinInstalar: false });
    bar();
    await screen.findByText("Sin descargar");
    expect(screen.queryByText(IOS_SIN_INSTALAR)).toBeNull();
  });

  it("sin red al empezar: lo dice y no se queda descargando", async () => {
    api.downloadForgeRoute.mockResolvedValue({ ok: false, motivo: "sin-red", detalle: "La descarga necesita conexión" });
    bar();
    { const el = await screen.findByRole("button", { name: /Descargar ruta S1/ }); await act(async () => fireEvent.click(el)); }
    expect(await screen.findByText("La descarga necesita conexión")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("sin espacio: «Descargar sin figuras» vuelve a evaluar sin figuras y «Descargar todo» fuerza", async () => {
    const detalle = "Espacio libre ≈ 40 MB; esta descarga ocupa ≈ 3 MB, y las 7 figuras de palantir.com cuentan ≈ 51 MB más de cuota en este navegador.";
    api.downloadForgeRoute.mockResolvedValue({ ok: false, motivo: "sin-espacio", detalle, espacio: { libreBytes: 40e6, previstoBytes: 54e6, cuotaFigurasBytes: 51e6, figuras: 7 } });
    bar();
    { const el = await screen.findByRole("button", { name: /Descargar ruta S1/ }); await act(async () => fireEvent.click(el)); }
    expect(await screen.findByText(detalle)).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Descargar sin figuras" })));
    const second = api.downloadForgeRoute.mock.calls[1]![1] as DownloadOptions;
    expect(second.figuras, "«Descargar sin figuras» volvió a pedir las figuras").toBe(false);
    expect(second.forzar).toBeFalsy();
    // sin figuras que pedir, el botón que fuerza es «Descargar de todos modos» y conserva figuras: false
    { const el = await screen.findByRole("button", { name: "Descargar de todos modos" }); await act(async () => fireEvent.click(el)); }
    const third = api.downloadForgeRoute.mock.calls[2]![1] as DownloadOptions;
    expect(third.forzar).toBe(true);
    expect(third.figuras).toBe(false);
    cleanup();
    bar();
    { const el = await screen.findByRole("button", { name: /Descargar ruta S1/ }); await act(async () => fireEvent.click(el)); }
    { const el = await screen.findByRole("button", { name: "Descargar todo" }); await act(async () => fireEvent.click(el)); }
    const forced = api.downloadForgeRoute.mock.calls[4]![1] as DownloadOptions;
    expect(forced.forzar, "«Descargar todo» no saltó el aviso de espacio").toBe(true);
    expect(forced.figuras).not.toBe(false);
  });

  it("al terminar, el progreso se queda hasta tener el estado nuevo: nunca vuelve a pintar el anterior", async () => {
    api.downloadForgeRoute.mockResolvedValue({ ok: true, estado: COMPLETA, fallidos: [] });
    bar();
    const el = await screen.findByRole("button", { name: /Descargar ruta S1/ });
    let release: (s: ScopeStatus) => void = () => {};
    api.forgeRouteStatus.mockImplementation(() => new Promise<ScopeStatus>((r) => (release = r)));
    store.rows = [row("forge:s1")];
    await act(async () => fireEvent.click(el));
    await waitFor(() => expect(api.forgeRouteStatus).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Sin descargar"), "al terminar la descarga la barra volvió a pintar un instante «Sin descargar»").toBeNull();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    await act(async () => release(COMPLETA));
    expect(await screen.findByText("Descargada ✓ · 8/8 libros")).toBeInTheDocument();
  });

  it("al terminar una descarga, Lecturas vuelve a leer el dispositivo", async () => {
    const onChanged = vi.fn();
    api.downloadForgeRoute.mockResolvedValue({ ok: true, estado: COMPLETA, fallidos: [] });
    bar({ onChanged });
    { const el = await screen.findByRole("button", { name: /Descargar ruta S1/ }); await act(async () => fireEvent.click(el)); }
    await waitFor(() => expect(onChanged, "la descarga terminó y Lecturas no volvió a leer el dispositivo").toHaveBeenCalled());
  });
});

describe("barra de descarga · borrar (design poblar §6.4 «Borrado»)", () => {
  it("«Borrar descarga» de una ruta borra sólo esa ruta, dice lo liberado y lo que se queda, y vuelve a «Sin descargar»", async () => {
    store.rows = [row("forge:s1"), row("forge:p2")];
    api.forgeRouteStatus.mockResolvedValue(COMPLETA);
    api.deleteForgeRoute.mockImplementation(async () => {
      store.rows = [row("forge:p2")];
      api.forgeRouteStatus.mockResolvedValue(status({ atlas: rc(3, 5), python: rc(6, 6) }));
      return freed();
    });
    bar();
    { const el = await screen.findByRole("button", { name: "Borrar descarga" }); await act(async () => fireEvent.click(el)); }
    expect(api.deleteForgeWorld, "borrar la ruta S1 borró el mundo entero").not.toHaveBeenCalled();
    expect(api.deleteForgeRoute).toHaveBeenCalledWith("s1");
    expect(await screen.findByText("Liberados 84 KB · 1.2 MB compartidos con otras rutas se quedan · Python se queda: lo usan todos los mundos")).toBeInTheDocument();
    expect(await screen.findByText("Sin descargar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Descargar ruta S1/ })).toBeInTheDocument();
  });

  it("sin ruta elegida, la barra es del mundo: «Descargar mundo» y su borrado", async () => {
    store.rows = [row("forge:mundo")];
    api.forgeWorldStatus.mockResolvedValue(status({ libros: rc(128, 128), completa: true }));
    api.deleteForgeWorld.mockResolvedValue(freed({ compartidosBytes: 0 }));
    bar({ slug: null });
    expect(await screen.findByText("Descargada ✓ · 128/128 libros")).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Borrar descarga" })));
    expect(api.deleteForgeWorld).toHaveBeenCalled();
    expect(api.deleteForgeRoute).not.toHaveBeenCalled();
    cleanup();
    store.rows = [];
    api.forgeWorldStatus.mockResolvedValue(status({ libros: rc(0, 128), bytesPrevistos: 40_100_000 }));
    bar({ slug: null });
    expect(await screen.findByRole("button", { name: "Descargar mundo · ≈ 40.1 MB" })).toBeInTheDocument();
  });

  it("un error de borrado se dice, no se calla", async () => {
    store.rows = [row("forge:s1")];
    api.forgeRouteStatus.mockResolvedValue(COMPLETA);
    api.deleteForgeRoute.mockResolvedValue(freed({ liberadosBytes: 0, compartidosBytes: 0, errores: ["No se pudo borrar la partición docs/x.json"] }));
    bar();
    { const el = await screen.findByRole("button", { name: "Borrar descarga" }); await act(async () => fireEvent.click(el)); }
    expect(await screen.findByText(/No se pudo borrar la partición docs\/x\.json/)).toBeInTheDocument();
  });
});

// ── «Borrar del dispositivo» en la fila de un libro de Forge (§5.5) ──
import { RowCard } from "@/ui/books/library/LibraryCatalog";
const forgeBook = (o: Partial<LibraryRow> = {}): LibraryRow => ({
  key: "forge-libro:S1-02",
  kind: "libro",
  world: { goalId: "forge", title: "Engineering Forge" },
  route: { id: "s1", slug: "s1", name: "S1 · Sistemas" },
  cell: { id: "forge-s1-02", code: "S1-02", title: "S1-02 · Transacciones" },
  title: "S1-02 · Transacciones",
  minutes: 15,
  items: null,
  autoria: "autorado",
  generatedBy: "Claude (Anthropic) · agente Kiro",
  disponible: "si",
  disponibleDetalle: "En este dispositivo",
  sealed: false,
  source: "forge",
  ...o,
});
const noop = () => {};
const card = (r: LibraryRow, onBorrarLocal: () => void = noop) =>
  render(<RowCard row={r} note={null} onLeer={noop} onEjercicios={noop} onEvaluaciones={noop} onBorrar={noop} onBorrarLocal={onBorrarLocal} />);

describe("«Borrar del dispositivo» (design poblar §5.5)", () => {
  it("un libro de Forge en el dispositivo (o en versión anterior) lo ofrece, con 44 px", () => {
    const fn = vi.fn();
    card(forgeBook(), fn);
    const b = screen.getByRole("button", { name: "Borrar del dispositivo" });
    expect(b.className).toMatch(/\btap\b/);
    fireEvent.click(b);
    expect(fn).toHaveBeenCalledTimes(1);
    cleanup();
    card(forgeBook({ disponible: "anterior", disponibleDetalle: "Versión anterior en este dispositivo · se actualiza con red" }));
    expect(screen.getByRole("button", { name: "Borrar del dispositivo" })).toBeInTheDocument();
  });

  it("nunca en una importación de Forge, ni sin nada en el dispositivo, ni en un banco o una semilla clásica", () => {
    card(forgeBook({ autoria: "importado", disponibleDetalle: "En este dispositivo · tu importación" }));
    expect(screen.queryByRole("button", { name: "Borrar del dispositivo" }), "Lecturas ofreció borrar del dispositivo una importación de Forge").toBeNull();
    cleanup();
    card(forgeBook({ disponible: "no", disponibleDetalle: "Requiere conexión una vez" }));
    expect(screen.queryByRole("button", { name: "Borrar del dispositivo" }), "Lecturas ofreció borrar un libro que no está en el dispositivo").toBeNull();
    cleanup();
    card(forgeBook({ key: "forge-banco:S1-02", kind: "banco", items: { total: 6, disponibles: 6 }, disponible: "incluido" }));
    expect(screen.queryByRole("button", { name: "Borrar del dispositivo" })).toBeNull();
    cleanup();
    card(forgeBook({ key: "libro:x", source: "seed", disponible: "incluido", world: { goalId: "g", title: "ITC" }, cell: { id: "m", code: null, title: "Celda" } }));
    expect(screen.queryByRole("button", { name: "Borrar del dispositivo" }), "una semilla clásica ofreció borrar: el arranque la repone").toBeNull();
  });
});

// ── el catálogo conecta la barra y el botón con la fachada ──
const lib = vi.hoisted(() => ({ rows: [] as LibraryRow[] }));
vi.mock("@/forge/model/library-catalog", async (orig) => ({
  ...(await orig<object>()),
  forgeLibraryIndex: async () => ({ v: 1, celdas: {} }),
  forgeRows: () => lib.rows,
}));
import LibraryCatalog from "@/ui/books/library/LibraryCatalog";
import { FORGE_GOAL_ID } from "@/core/forge-verdict";
import { FORGE_SPINE } from "@/lib/spines-forge";
import { FILTER_KEY } from "@/lib/library/filter";

describe("Lecturas · la barra y el botón en el catálogo", () => {
  it("con Forge y S1 elegidos aparece la barra de S1; «Borrar del dispositivo» llama a la fachada, refresca y re-verifica la ruta", async () => {
    const s1 = FORGE_SPINE.paths.find((p) => p.slug === "s1")!;
    localStorage.setItem(FILTER_KEY, JSON.stringify({ v: 1, world: FORGE_GOAL_ID, route: s1.id, estado: "todos" }));
    lib.rows = [forgeBook({ world: { goalId: FORGE_GOAL_ID, title: "Engineering Forge" }, route: { id: s1.id, slug: "s1", name: s1.name } })];
    api.deleteForgeBookLocal.mockResolvedValue(freed({ liberadosBytes: 12_400, compartidosBytes: 0 }));
    const onRefresh = vi.fn(async () => {});
    const model = { goals: [{ id: FORGE_GOAL_ID, title: "Engineering Forge", archived: false }], paths: [], modules: [], edges: [], evidence: [], pendingAi: [] } as unknown as ReadModel;
    render(<LibraryCatalog books={[]} banks={[]} readModel={model} onDeleteImport={async () => {}} onRefresh={onRefresh} />);
    expect(await screen.findByRole("button", { name: "Descargar ruta S1 · ≈ 2.5 MB" }), "con Forge y una ruta elegidos no apareció la barra de descarga").toBeInTheDocument();
    expect(api.forgeRouteStatus).toHaveBeenLastCalledWith("s1");
    const calls = api.forgeRouteStatus.mock.calls.length;
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Borrar del dispositivo" })));
    expect(api.deleteForgeBookLocal).toHaveBeenCalledWith("S1-02");
    expect(await screen.findByText("Liberados 12 KB")).toBeInTheDocument();
    expect(onRefresh).toHaveBeenCalled();
    await waitFor(() => expect(api.forgeRouteStatus.mock.calls.length, "borrar un libro desde su fila no re-verificó la barra de su ruta").toBeGreaterThan(calls));
    localStorage.removeItem(FILTER_KEY);
  });
});
