// Panel y el contrato de chunks (design §9.1, §23.3; CA). Cuando una parte perezosa del compañero no carga, el panel
// pinta el texto de aviso-carga y, SÓLO si recargar arregla el problema (chunk stale: hay controlador o hay red),
// ofrece «Recargar». Un chunk no descargado (sin red y sin controlador) no ofrece «Recargar» porque recargar no lo baja.
//
// Red-check (§23.3): la costura es `avisoCarga` de aviso-carga.ts. Si se le quita el acople entre «recargar arregla» y
// el botón —devuelve recargar:false ante un error stale—, el panel describe un error que una recarga resolvería pero no
// da el botón: el invariante «si es stale, hay botón» se rompe con «el compañero pidió recargar sin botón para hacerlo».
import { describe, it, expect, afterEach, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { Panel } from "@/ui/companion/Panel";
import * as avisoMod from "@/ui/companion/aviso-carga";
import { rojoEscena } from "./rojo";

/** Error que isChunkError reconoce (nombre ChunkLoadError), como el de un import() de webpack que no llegó. */
function errorDeChunk(): Error {
  const e = new Error("Loading chunk companion-practica failed");
  e.name = "ChunkLoadError";
  return e;
}

/** Fija navigator.onLine y navigator.serviceWorker.controller para el caso que se quiere (stale vs no descargado). */
function entorno({ online, controlado }: { online: boolean; controlado: boolean }): () => void {
  const onlineDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine") ?? Object.getOwnPropertyDescriptor(navigator, "onLine");
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
  const swPrevio = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    get: () => ({ controller: controlado ? {} : null }),
  });
  return () => {
    if (onlineDesc) Object.defineProperty(navigator, "onLine", onlineDesc);
    if (swPrevio) Object.defineProperty(navigator, "serviceWorker", swPrevio);
    else delete (navigator as unknown as Record<string, unknown>).serviceWorker;
  };
}

async function montarConFalla(reject: () => Promise<unknown>): Promise<ReturnType<typeof render>> {
  let r!: ReturnType<typeof render>;
  await act(async () => {
    r = render(<Panel esquina="inf-der" activo despachar={() => {}} precargar={reject} />);
    await new Promise<void>((res) => setTimeout(res, 50));
  });
  // el panel precarga en reposo (requestIdleCallback o 300 ms): deja que la precarga falle y pinte el aviso
  await act(async () => {
    await new Promise<void>((res) => setTimeout(res, 400));
  });
  return r;
}

const recargar = () => screen.queryByRole("button", { name: "Recargar" });

describe("Panel · contrato de chunks (design §9.1, §23.3)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("CHUNK_STALE (hay controlador): el aviso ofrece «Recargar»", async () => {
    const restaurar = entorno({ online: false, controlado: true });
    const r = await montarConFalla(() => Promise.reject(errorDeChunk()));
    try {
      await waitFor(() => expect(recargar(), "no apareció el botón Recargar para un chunk stale").not.toBeNull());
    } finally {
      r.unmount();
      restaurar();
    }
  });

  it("CHUNK_NOT_DOWNLOADED (sin red y sin controlador): el aviso NO ofrece «Recargar»", async () => {
    const restaurar = entorno({ online: false, controlado: false });
    const r = await montarConFalla(() => Promise.reject(errorDeChunk()));
    try {
      await waitFor(() => expect(screen.queryByText(/no está descargada/i), "no pintó el aviso de no descargado").not.toBeNull());
      expect(recargar(), "ofreció Recargar para un chunk que recargar no baja").toBeNull();
    } finally {
      r.unmount();
      restaurar();
    }
  });

  it("red-check: avisoCarga que dice recargar:false ante un chunk stale → no hay botón para hacerlo", async () => {
    // la copia intacta (CHUNK_STALE) debe pasar antes del red-check
    const restaurarOk = entorno({ online: true, controlado: true });
    const rOk = await montarConFalla(() => Promise.reject(errorDeChunk()));
    await waitFor(() => expect(recargar(), "la copia intacta debe ofrecer Recargar antes del red-check").not.toBeNull());
    rOk.unmount();
    restaurarOk();

    await rojoEscena(async () => {
      // la costura: avisoCarga ya no acopla «recargar arregla» con el botón (recargar:false para un error stale). El
      // texto sigue diciendo que una recarga lo resuelve, pero no se ofrece el botón.
      vi.spyOn(avisoMod, "avisoCarga").mockReturnValue({
        texto: "Hay una versión nueva de Arcanum. Recarga para continuar.",
        recargar: false,
      });
      const restaurar = entorno({ online: true, controlado: true });
      const r = await montarConFalla(() => Promise.reject(errorDeChunk()));
      try {
        await waitFor(() => expect(screen.queryByText(/Recarga para continuar/i), "no pintó el aviso stale").not.toBeNull());
        if (recargar() === null) throw new Error("el compañero pidió recargar sin botón para hacerlo");
      } finally {
        r.unmount();
        restaurar();
      }
    }, "el compañero pidió recargar sin botón para hacerlo");
  });
});
