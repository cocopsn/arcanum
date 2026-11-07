"use client";

import { useEffect } from "react";
import { chunkErrorText, isChunkError } from "@/lib/chunk-error";

// Límite de error del segmento (design poblar §6.9, §6.11). Un chunk que no cargó muestra el texto de chunkErrorText
// según el controlador y la red, con «Recargar»; la reanudación de HomeView devuelve mundo, celda, Lecturas y libro.
// Cualquier otro error: «Algo falló al pintar esta pantalla» con «Reintentar» (reset) y «Recargar».
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const chunk = isChunkError(error);
  useEffect(() => {
    console.warn(chunk ? "[app] un chunk no cargó" : "[app] error al pintar", error?.name ?? "Error");
  }, [chunk, error]);
  const texto = chunk
    ? chunkErrorText({
        controlled: typeof navigator !== "undefined" && Boolean(navigator.serviceWorker?.controller),
        online: typeof navigator === "undefined" || navigator.onLine !== false,
      }).texto
    : "Algo falló al pintar esta pantalla";
  return (
    <main
      role="alert"
      className="grid min-h-dvh place-items-center px-safe text-center"
      style={{ paddingTop: "calc(var(--safe-top) + 2rem)", paddingBottom: "calc(var(--safe-bottom) + 2rem)" }}
    >
      <div className="max-w-md space-y-4">
        <p className="text-text">{texto}</p>
        <div className="flex justify-center gap-3">
          {chunk ? null : (
            <button type="button" className="tap rounded-[var(--r-md)] border border-line px-4 text-text" onClick={() => reset()}>
              Reintentar
            </button>
          )}
          <button type="button" className="tap rounded-[var(--r-md)] border border-line px-4 text-text" onClick={() => location.reload()}>
            Recargar
          </button>
        </div>
      </div>
    </main>
  );
}
