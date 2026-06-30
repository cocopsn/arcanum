"use client";

import { useEffect, useState } from "react";
import { audio, type AudioConfig as Cfg } from "@/lib/audio";

// Audio preferences — master volume, SFX on/off, music on/off + its volume. Persisted to
// localStorage (a DEVICE preference, not log state). Toggling is a user gesture → unlocks audio.
export function AudioConfig({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [cfg, setCfg] = useState<Cfg>(() => audio.getConfig());

  useEffect(() => audio.subscribe(setCfg), []);

  if (!open) return null;
  const set = (patch: Partial<Cfg>) => {
    audio.unlock();
    audio.setConfig(patch);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" style={{ background: "var(--overlay-scrim)" }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ajustes de audio"
        className="w-full max-w-md rounded-t-[var(--r-lg)] border border-line bg-surface-raised p-6 sm:rounded-[var(--r-lg)]"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg tracking-[0.14em] text-text">Audio</h2>
          <button onClick={onClose} aria-label="Cerrar" className="-mr-2 min-h-11 px-2 text-2xl leading-none text-text-faint transition hover:text-text">×</button>
        </div>

        <div className="mt-5 space-y-5">
          <Row label="Efectos (SFX)" sub="clic, compuerta, ascensión">
            <Toggle on={cfg.sfx} onChange={(v) => set({ sfx: v })} label="SFX" />
          </Row>

          <div>
            <div className="mb-1 flex items-center justify-between text-[12px] text-text-muted">
              <span>Volumen general</span>
              <span className="tnum text-text-faint">{Math.round(cfg.master * 100)}%</span>
            </div>
            <input type="range" min={0} max={1} step={0.05} value={cfg.master} onChange={(e) => set({ master: Number(e.target.value) })} aria-label="Volumen general" className="w-full accent-[var(--rank)]" />
          </div>

          <Row label="Música ambiente" sub="un loop por mundo, bajo, no cansa">
            <Toggle on={cfg.music} onChange={(v) => set({ music: v })} label="Música" />
          </Row>

          {cfg.music && (
            <div>
              <div className="mb-1 flex items-center justify-between text-[12px] text-text-muted">
                <span>Volumen de música</span>
                <span className="tnum text-text-faint">{Math.round(cfg.musicVol * 100)}%</span>
              </div>
              <input type="range" min={0} max={1} step={0.05} value={cfg.musicVol} onChange={(e) => set({ musicVol: Number(e.target.value) })} aria-label="Volumen de música" className="w-full accent-[var(--rank)]" />
            </div>
          )}

          <button
            onClick={() => {
              audio.unlock();
              audio.sfx("gate");
            }}
            className="min-h-11 w-full rounded-[var(--r-sm)] border border-line text-[12px] uppercase tracking-[0.16em] text-text-muted transition hover:text-text"
          >
            Probar sonido
          </button>
          <p className="text-[11px] leading-relaxed text-text-faint">
            Sintetizado en el dispositivo (Web Audio) — cero archivos. En iOS el audio arranca tras tu primer toque.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, sub, children }: { label: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-[13px] text-text">{label}</div>
        <div className="text-[11px] text-text-faint">{sub}</div>
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="relative h-7 w-12 shrink-0 rounded-full border transition"
      style={{ borderColor: on ? "var(--rank)" : "var(--line)", background: on ? "color-mix(in srgb, var(--rank) 30%, transparent)" : "transparent" }}
    >
      <span className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-all" style={{ left: on ? "calc(100% - 22px)" : "2px", background: on ? "var(--rank)" : "var(--text-faint)" }} />
    </button>
  );
}
