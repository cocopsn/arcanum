import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppError from "@/app/error";
import { AppUpdate } from "@/ui/AppUpdate";
import { APP_UPDATED, CHUNK_NOT_DOWNLOADED, CHUNK_STALE } from "@/lib/offline-texts";

// The update notice and the chunk error (design poblar §6.9). Red-check in redchecks-offline-motor.md: without the
// previous-controller guard → «la primera instalación mostró que hay una versión nueva».

function fakeSw(controller: unknown) {
  const target = new EventTarget() as EventTarget & { controller: unknown };
  target.controller = controller;
  vi.stubGlobal("navigator", { userAgent: "test", serviceWorker: target, onLine: true });
  return target;
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const chunkError = () => Object.assign(new Error("Loading chunk 123 failed."), { name: "ChunkLoadError" });

describe("AppUpdate", () => {
  it("con un controlador previo, un SW nuevo muestra APP_UPDATED con «Recargar»", () => {
    const sw = fakeSw({});
    render(<AppUpdate />);
    act(() => void sw.dispatchEvent(new Event("controllerchange")));
    expect(screen.getByRole("status").textContent).toContain(APP_UPDATED);
    expect(screen.getByRole("button", { name: "Recargar" })).toBeTruthy();
  });
  it("la primera instalación (sin controlador previo) no muestra nada", () => {
    const sw = fakeSw(null);
    render(<AppUpdate />);
    act(() => void sw.dispatchEvent(new Event("controllerchange")));
    expect(screen.queryByRole("status"), "la primera instalación mostró que hay una versión nueva").toBeNull();
  });
  it("un ChunkLoadError sin atrapar muestra chunkErrorText según controlador y red", () => {
    fakeSw({});
    render(<AppUpdate />);
    act(() => {
      const e = new Event("unhandledrejection") as Event & { reason: unknown };
      e.reason = chunkError();
      window.dispatchEvent(e);
    });
    expect(screen.getByRole("status").textContent).toContain(CHUNK_STALE);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("otro rechazo no muestra nada", () => {
    fakeSw({});
    render(<AppUpdate />);
    act(() => {
      const e = new Event("unhandledrejection") as Event & { reason: unknown };
      e.reason = new Error("otra cosa");
      window.dispatchEvent(e);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("error.tsx", () => {
  it("un error de chunk sin controlador y sin red dice que no está descargada, con «Recargar» y sin «Reintentar»", () => {
    vi.stubGlobal("navigator", { userAgent: "test", serviceWorker: { controller: null }, onLine: false });
    render(<AppError error={chunkError()} reset={() => {}} />);
    expect(screen.getByRole("alert").textContent, "error.tsx no distinguió un chunk que no cargó").toContain(CHUNK_NOT_DOWNLOADED);
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Recargar" })).toBeTruthy();
  });
  it("otro error ofrece «Reintentar» (reset) y «Recargar»", () => {
    const reset = vi.fn();
    render(<AppError error={new Error("x")} reset={reset} />);
    expect(screen.getByRole("alert").textContent).toContain("Algo falló al pintar esta pantalla");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
