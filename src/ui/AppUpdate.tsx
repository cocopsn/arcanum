"use client";

import { useEffect, useRef, useState } from "react";
import { chunkErrorText, isChunkError } from "@/lib/chunk-error";
import { APP_UPDATED } from "@/lib/offline-texts";

// Aviso de actualización y de chunk que no carga (design poblar §6.9). Se monta en page.tsx FUERA de AccessGate.
// Al montar guarda si ya había un service worker controlando: sólo entonces un `controllerchange` es una versión
// nueva (la primera instalación no muestra nada). Un error de chunk (rechazo o error global) muestra el texto de
// chunkErrorText según el controlador y la red. Arriba, bajo --safe-top y lejos de la esquina del orbe; no bloquea.

type Aviso = { texto: string } | null;

export function AppUpdate() {
  const [aviso, setAviso] = useState<Aviso>(null);
  const hadController = useRef(false);

  useEffect(() => {
    const sw = typeof navigator !== "undefined" ? navigator.serviceWorker : undefined;
    hadController.current = Boolean(sw?.controller);
    const onController = () => {
      if (hadController.current) setAviso({ texto: APP_UPDATED });
      hadController.current = true;
    };
    const onChunk = (reason: unknown) => {
      if (!isChunkError(reason)) return;
      console.warn("[app] un chunk no cargó", reason);
      setAviso({ texto: chunkErrorText({ controlled: Boolean(navigator.serviceWorker?.controller), online: navigator.onLine !== false }).texto });
    };
    const onRejection = (e: PromiseRejectionEvent) => onChunk(e.reason);
    const onError = (e: ErrorEvent) => onChunk(e.error ?? { message: e.message });
    sw?.addEventListener("controllerchange", onController);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    return () => {
      sw?.removeEventListener("controllerchange", onController);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  if (!aviso) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[90] flex justify-center px-safe"
      style={{ paddingTop: "calc(var(--safe-top) + 0.5rem)", pointerEvents: "none" }}
    >
      <div
        className="flex max-w-md items-center gap-3 rounded-[var(--r-md)] border border-line bg-surface-raised px-4 py-2 text-sm text-text-muted shadow-lg"
        style={{ pointerEvents: "auto" }}
      >
        <span className="flex-1">{aviso.texto}</span>
        <button type="button" className="tap px-2 text-text" onClick={() => location.reload()}>
          Recargar
        </button>
        <button type="button" aria-label="Cerrar aviso" className="tap text-text-faint hover:text-text" onClick={() => setAviso(null)}>
          ×
        </button>
      </div>
    </div>
  );
}
