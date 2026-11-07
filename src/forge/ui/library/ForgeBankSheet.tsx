"use client";
// Las evaluaciones de un banco de Forge abiertas desde Lecturas (design poblar §5.5). Se carga con useLazyModule desde
// LibraryCatalog: el banco va al dispositivo con ensureForgeBank y luego ForgeEvaluations, dentro de ChunkBoundary
// porque sus corredores son next/dynamic. Monocromo (D4): data-world="forge" y el tema de Forge. Nunca ofrece giro,
// entrevista ni expediente (isSelectable, D12), y una celda sellada ni siquiera llega aquí (§5.6).
import { useEffect, useState, type CSSProperties } from "react";
import { ensureForgeBank } from "@/forge/loaders";
import { ForgeEvaluations } from "@/forge/ui/ForgeEvaluations";
import { ChunkBoundary } from "@/ui/books/library/ChunkBoundary";
import { SUBJECT_THEMES, worldVars } from "@/lib/subject-themes";
import type { ReadModel } from "@/core/read-model";

type Estado = "cargando" | "listo" | "no-descargado" | "invalido";

export default function ForgeBankSheet({
  code,
  cellId,
  title,
  readModel,
  codigo,
  onCodigo,
  onClose,
}: {
  code: string;
  cellId: string;
  title: string;
  readModel: ReadModel;
  /** el banco trae ítems code, choice o production: se ofrecen «Ejercicios de código» en ExerciseMode */
  codigo: boolean;
  onCodigo(): void;
  onClose(): void;
}) {
  const [estado, setEstado] = useState<Estado>("cargando");
  useEffect(() => {
    let alive = true;
    void ensureForgeBank(code).then((r) => {
      if (!alive) return;
      setEstado(r.ok ? "listo" : r.reason === "invalido" ? "invalido" : "no-descargado");
    });
    return () => {
      alive = false;
    };
  }, [code]);
  const theme = SUBJECT_THEMES.forge;
  return (
    <div
      data-world="forge"
      role="dialog"
      aria-modal="true"
      aria-label={`Evaluaciones · ${code}`}
      className="scroll-touch fixed inset-0 z-[80] overflow-y-auto bg-[var(--forge-void,#0a0a0b)] pb-safe pt-safe"
      style={(theme ? worldVars(theme) : {}) as CSSProperties}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="mx-auto w-full max-w-2xl px-safe">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="forge-label text-[10px] text-text-muted">Evaluaciones · {code}</div>
            <h2 className="mt-1 text-[16px] leading-snug text-text" title={title}>
              {title}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="tap grid shrink-0 place-items-center border border-[var(--forge-control)] text-[13px] text-text">
            ×
          </button>
        </header>
        <div className="mt-4 border border-[rgba(255,255,255,0.12)] p-3" data-forge-evaluations={code}>
          {estado === "cargando" && <p className="text-[12px] text-text-muted">Cargando el banco…</p>}
          {estado === "no-descargado" && <p className="text-[12px] text-text-muted">Banco no descargado · requiere conexión una vez</p>}
          {estado === "invalido" && <p className="text-[12px] text-text-muted">Banco inválido en esta versión</p>}
          {estado === "listo" && (
            <ChunkBoundary onClose={onClose}>
              <ForgeEvaluations code={code} cellId={cellId} readModel={readModel} />
            </ChunkBoundary>
          )}
        </div>
        {estado === "listo" && codigo && (
          <button type="button" onClick={onCodigo} className="tap mt-3 w-full border border-[var(--forge-text)] px-3 text-[13px] text-text">
            Ejercicios de código
          </button>
        )}
      </div>
    </div>
  );
}
