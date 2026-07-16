"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { audio } from "@/lib/audio";
import { pickReward, type Reward, type RewardTier } from "@/lib/reward";

// The reward OVERLAY — a single fixed, pointer-events-none layer that renders the active flourish. One
// system, so every celebration speaks the same visual language. Transform/opacity only (60fps); with
// prefers-reduced-motion it drops the motion but KEEPS the moment (a brief hold + any Asuka/lore line).
// Audio always plays (it isn't motion). Tinted by the caller's world accent, falling back to imperial gold.

export interface RewardOptions {
  /** viewport point the ring/motes emanate from (defaults to screen centre) */
  x?: number;
  y?: number;
  /** the world accent to tint with (CSS colour). Defaults to the rank gold. */
  accent?: string;
  /** override the tier's default sfx (to keep a crafted semantic sound, e.g. the insight arpeggio) */
  sfx?: import("@/lib/audio").Sfx;
}

type RewardFn = (tier: RewardTier, opts?: RewardOptions) => void;
const RewardCtx = createContext<RewardFn>(() => {});

/** Fire a scaled, variable reward. Call from any meaningful gesture. */
export function useReward(): RewardFn {
  return useContext(RewardCtx);
}

interface Active extends Reward {
  key: number;
  x: number;
  y: number;
  accent: string;
}

export function RewardProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Active | null>(null);
  const seq = useRef(0);
  const reduce = useReducedMotion();

  const reward = useCallback<RewardFn>((tier, opts) => {
    const key = ++seq.current;
    // seed varies per action so the variable reward feels alive (src/ui may use the clock)
    const seed = (Date.now() ^ (key * 0x9e3779b1)) >>> 0;
    const r = pickReward(tier, seed);
    audio.unlock();
    audio.sfx(opts?.sfx ?? r.sfx);
    setActive({
      ...r,
      key,
      x: opts?.x ?? window.innerWidth / 2,
      y: opts?.y ?? Math.min(window.innerHeight / 2, 320),
      accent: opts?.accent ?? "var(--gold, #e8c36a)",
    });
    const hold = r.extra && r.extra.kind !== "glow" ? 2000 : tier === "ceremony" ? 2600 : 1200;
    window.setTimeout(() => setActive((a) => (a && a.key === key ? null : a)), hold);
  }, []);

  const value = useMemo(() => reward, [reward]);

  return (
    <RewardCtx.Provider value={value}>
      {children}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[95] overflow-hidden">
        <AnimatePresence>{active && <Flourish key={active.key} r={active} reduce={!!reduce} />}</AnimatePresence>
      </div>
    </RewardCtx.Provider>
  );
}

const SIZE: Record<RewardTier, number> = { micro: 60, small: 90, medium: 150, large: 240, ceremony: 420 };

function Flourish({ r, reduce }: { r: Active; reduce: boolean }) {
  const size = SIZE[r.tier];
  const dur = r.tier === "ceremony" ? 1.9 : r.tier === "large" ? 1.2 : 0.95;

  // reduced-motion: a brief, still hold of the ring + the extra text — the moment, without the movement.
  if (reduce) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        {r.ring && (
          <div className="absolute rounded-full" style={{ left: r.x - size / 2, top: r.y - size / 2, width: size, height: size, border: `1px solid ${r.accent}`, boxShadow: `0 0 24px ${r.accent}` }} />
        )}
        {r.extra && r.extra.kind !== "glow" && <ExtraLine text={r.extra.text} kind={r.extra.kind} accent={r.accent} reduce />}
      </motion.div>
    );
  }

  return (
    <>
      {/* expanding ring pulse from the action point */}
      {r.ring && (
        <motion.div
          className="absolute rounded-full"
          style={{ left: r.x, top: r.y, width: size, height: size, x: "-50%", y: "-50%", border: `1.5px solid ${r.accent}` }}
          initial={{ scale: 0.2, opacity: 0.9 }}
          animate={{ scale: 1.9, opacity: 0 }}
          transition={{ duration: dur, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
      {/* an extra bloom for a 'glow' variable reward, or the ceremony */}
      {(r.extra?.kind === "glow" || r.tier === "ceremony") && (
        <motion.div
          className="absolute rounded-full"
          style={{ left: r.x, top: r.y, width: size * 2.4, height: size * 2.4, x: "-50%", y: "-50%", background: `radial-gradient(circle, ${r.accent}, transparent 62%)` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{ duration: dur * 1.3, ease: "easeOut" }}
        />
      )}
      {/* diagonal glint sweep */}
      {r.glint && (
        <motion.div
          className="absolute"
          style={{ left: r.x - size * 1.4, top: r.y - 2, width: size * 2.8, height: 3, rotate: -22, background: `linear-gradient(90deg, transparent, ${r.accent}, transparent)` }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: [0, 1, 0], opacity: [0, 0.85, 0] }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      )}
      {/* rising motes */}
      {Array.from({ length: r.particles }).map((_, i) => {
        const mote = mulberryFloat(r.key * 97 + i);
        const dx = (mote(0) - 0.5) * size * 2.1;
        const rise = 60 + mote(1) * 120;
        const s = 2 + mote(2) * 3;
        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{ left: r.x, top: r.y, width: s, height: s, background: r.accent, boxShadow: `0 0 6px ${r.accent}` }}
            initial={{ x: 0, y: 0, opacity: 0 }}
            animate={{ x: dx, y: -rise, opacity: [0, 1, 0] }}
            transition={{ duration: dur + mote(3) * 0.5, ease: "easeOut", delay: mote(4) * 0.12 }}
          />
        );
      })}
      {r.extra && r.extra.kind !== "glow" && <ExtraLine text={r.extra.text} kind={r.extra.kind} accent={r.accent} reduce={false} />}
    </>
  );
}

function ExtraLine({ text, kind, accent, reduce }: { text: string; kind: "asuka" | "lore"; accent: string; reduce: boolean }) {
  return (
    <motion.div
      className="absolute inset-x-0 flex justify-center px-8"
      style={{ bottom: "22%" }}
      initial={{ opacity: 0, y: reduce ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduce ? 0 : -8 }}
      transition={{ duration: reduce ? 0.15 : 0.5, ease: "easeOut" }}
    >
      <div className="max-w-[420px] text-center">
        {kind === "asuka" && <div className="mb-1 text-[9px] uppercase tracking-[0.32em]" style={{ color: accent }}>Asuka</div>}
        <p className={kind === "asuka" ? "font-serif text-[15px] italic leading-snug text-text" : "font-display text-[13px] uppercase tracking-[0.14em]"} style={kind === "lore" ? { color: accent } : undefined}>
          {text}
        </p>
      </div>
    </motion.div>
  );
}

// tiny deterministic float source for mote scatter (UI layer → clock-seeded via the key)
function mulberryFloat(seed: number): (i: number) => number {
  let a = (seed >>> 0) || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const cache: number[] = [];
  return (i: number) => {
    while (cache.length <= i) cache.push(next());
    return cache[i]!;
  };
}
