"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import { audio } from "@/lib/audio";
import { readableAccent } from "@/lib/accent";

// THE THRESHOLD — entering a lesson/cell should FEEL like crossing into focus, not opening a form. The
// world dims to a single point of light, the realm's sigil breathes, a beat passes, then it fades to
// reveal the work beneath. transform/opacity only, 60fps. prefers-reduced-motion → a short, still hold
// (the moment lands without the movement). Tinted by the spine's world.
export function EnterRitual({
  title,
  glyph,
  accent,
  onDone,
}: {
  title: string;
  glyph: string;
  accent: string;
  onDone: () => void;
}) {
  const reduce = useReducedMotion() ?? false;

  // The threshold is a ONE-SHOT: unlock audio, play the tone, then dismiss after a beat — exactly once,
  // on mount. onDone is captured in a ref so a parent re-render (the lesson loading async while the ritual
  // is up) can NEVER re-run this and replay the tone or reset the timer. Mount-only by design.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  useEffect(() => {
    audio.unlock();
    audio.sfx("reveal"); // a soft threshold tone
    const t = window.setTimeout(() => onDoneRef.current(), reduceRef.current ? 420 : 1250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[86] grid place-items-center px-8 text-center"
      style={{ background: "radial-gradient(80% 60% at 50% 44%, var(--world-bg-2, #10151f), var(--world-bg, #080b12))" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0.12 : 0.4, ease: "easeOut" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(46% 38% at 50% 44%, ${accent}22, transparent 62%)` }} />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(130% 90% at 50% 50%, transparent 42%, rgba(0,0,0,0.7))" }} />
      <motion.div
        className="relative"
        initial={{ opacity: 0, scale: reduce ? 1 : 0.94, y: reduce ? 0 : 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: reduce ? 0.12 : 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          aria-hidden
          className="font-display text-6xl leading-none"
          style={{ color: accent, textShadow: `0 0 28px ${accent}` }}
          animate={reduce ? {} : { opacity: [0.72, 1, 0.72], scale: [1, 1.05, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          {glyph}
        </motion.div>
        <div className="mx-auto mt-5 max-w-sm font-display text-[13px] uppercase leading-snug tracking-[0.2em]" style={{ color: readableAccent(accent) }}>
          {title}
        </div>
        <div className="mt-2 text-[9px] uppercase tracking-[0.44em] text-text-faint">cruza el umbral</div>
      </motion.div>
    </motion.div>
  );
}
