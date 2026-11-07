"use client";
// Límite de error de chunk (design poblar §5.7). Los corredores de RUNNERS son next/dynamic y su rechazo queda guardado:
// un chunk que no llega deja el catálogo en pie y pinta el texto de chunkErrorText(). Cualquier otro error sigue hacia
// arriba (lo atiende src/app/error.tsx); nunca se lo traga.
import React from "react";
import { chunkErrorText, isChunkError } from "@/lib/chunk-error";
import { chunkContext } from "@/ui/books/library/use-lazy-module";

export function ChunkFallback({ onClose }: { onClose(): void }) {
  const { tipo, texto } = chunkErrorText(chunkContext());
  return (
    <div className="space-y-2" role="alert">
      <p className="text-[12px] text-text-muted">{texto}</p>
      <div className="flex flex-wrap gap-2">
        {tipo === "stale" && (
          <button type="button" onClick={() => window.location.reload()} className="tap border border-[var(--forge-control)] px-3 text-[12px] text-text">
            Recargar
          </button>
        )}
        <button type="button" onClick={onClose} className="tap border border-[var(--forge-control)] px-3 text-[12px] text-text">
          Cerrar
        </button>
      </div>
    </div>
  );
}

export class ChunkBoundary extends React.Component<{ onClose(): void; children: React.ReactNode }, { err: unknown }> {
  state = { err: null as unknown };
  static getDerivedStateFromError(err: unknown) {
    return { err };
  }
  render() {
    if (!this.state.err) return this.props.children;
    if (!isChunkError(this.state.err)) throw this.state.err; // otro error: lo atiende src/app/error.tsx
    return <ChunkFallback onClose={this.props.onClose} />;
  }
}
