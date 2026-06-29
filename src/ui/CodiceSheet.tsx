"use client";

import { useArcanum } from "@/app/providers";
import { codexUpTo } from "@/lib/lore";
import { gradeSigil } from "@/lib/grade-sigil";
import { GRADES } from "@/core/grade";

function MiniSigil({ index, color }: { index: number; color: string }) {
  const s = gradeSigil(index);
  return (
    <svg viewBox="0 0 120 120" width={36} height={36} aria-hidden className="shrink-0">
      {s.paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={color} strokeWidth={i === 0 ? 2 : 1.5} strokeLinejoin="round" opacity={i === 0 ? 0.95 : 0.6} />
      ))}
      <circle cx="60" cy="60" r="5" fill={color} />
    </svg>
  );
}

/** Códice / Legado — the founder narrative, written one fragment per ascension. */
export function CodiceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const gradeIndex = useArcanum((s) => s.readModel.stats.gradeIndex);
  if (!open) return null;
  const entries = codexUpTo(gradeIndex);
  const sealedLeft = GRADES.length - 1 - gradeIndex;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "var(--overlay-scrim)" }}
      onClick={onClose}
    >
      <div
        className="scroll-touch flex max-h-[85vh] w-full max-w-md flex-col overflow-y-auto rounded-t-[var(--r-lg)] border border-line bg-surface-raised p-6 sm:rounded-[var(--r-lg)]"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg tracking-[0.14em] text-rank">CÓDICE · LEGADO</h2>
        <p className="mb-4 mt-1 text-sm text-text-muted">
          El relato del fundador se escribe con cada ascenso.{" "}
          <span className="text-gold tnum">{entries.length}</span> de {GRADES.length} sellos revelados.
        </p>

        <div className="space-y-3">
          {entries.map((e) => (
            <div key={e.index} className="rounded-[var(--r-md)] border border-line bg-surface p-4">
              <div className="flex items-center gap-3">
                <MiniSigil index={e.index} color={e.color} />
                <div>
                  <div className="font-display text-sm tracking-[0.14em]" style={{ color: e.color }}>
                    {e.name.toUpperCase()}
                  </div>
                  <div className="font-serif text-xs italic text-text-muted">{e.epithet}</div>
                </div>
              </div>
              <p className="mt-3 font-serif text-[15px] leading-relaxed text-text">{e.text}</p>
              <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-faint">
                <span style={{ fontVariant: "small-caps" }}>{e.seal}</span>
                {e.revealsNode && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="text-topic">nodo del mapa revelado</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {sealedLeft > 0 && (
          <p className="mt-4 text-center text-[11px] uppercase tracking-[0.2em] text-text-faint">
            {sealedLeft} sello{sealedLeft === 1 ? "" : "s"} aún por revelar
          </p>
        )}

        <button
          onClick={onClose}
          className="mt-5 min-h-11 w-full text-xs uppercase tracking-[0.2em] text-text-faint transition hover:text-text-muted"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
