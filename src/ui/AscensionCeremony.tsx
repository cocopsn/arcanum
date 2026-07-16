"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import type { GradeInfo } from "@/core/grade";
import { gradeSigil } from "@/lib/grade-sigil";
import { audio } from "@/lib/audio";

/**
 * Ritual ascension: fade to near-black → the new grade's sigil is DRAWN
 * (stroke) → ~800ms silent beat → the ceremony phrase falls → latin seal +
 * epithet. transform/opacity (+ the requested stroke-draw via pathLength), 60fps.
 * Reduced-motion: same moment, no fades/draws — sigil + phrase shown at once.
 */
export function AscensionCeremony({
  grade,
  onDismiss,
}: {
  grade: GradeInfo;
  onDismiss: () => void;
}) {
  const reduce = useReducedMotion() ?? false;
  const sigil = gradeSigil(grade.index);
  // phase 2 = phrase/seal revealed (after draw + beat). Reduced-motion starts revealed.
  const [revealed, setRevealed] = useState(reduce);

  // the liturgical swell accompanies the visual ascension
  useEffect(() => {
    audio.sfx("ascension");
  }, []);

  useEffect(() => {
    // reduced-motion: reveal the phrase/seal IMMEDIATELY (useReducedMotion is null on first render, so the
    // useState(reduce) initializer was false for everyone — without this, reduced-motion users would never
    // see the phrase, because the draw timeout below is the only other path and it's skipped for them).
    if (reduce) {
      setRevealed(true);
      return;
    }
    const t = window.setTimeout(() => setRevealed(true), 1400 + 800); // draw ~1.4s + beat 0.8s
    return () => window.clearTimeout(t);
  }, [reduce]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-8 text-center"
      style={{ background: "#050407" }}
      initial={{ opacity: reduce ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0 : 0.6 }}
      role="dialog"
      aria-label={`Ascensión a ${grade.name}`}
    >
      {/* liturgical atmosphere — grade-colour bloom, light rays, vignette */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(60% 45% at 50% 42%, ${grade.color}26, transparent 62%)` }} />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[42%] h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: `conic-gradient(from 0deg, transparent, ${grade.color}1c, transparent 22%, transparent, ${grade.color}1c, transparent 72%)` }}
        initial={{ opacity: 0, rotate: 0 }}
        animate={{ opacity: revealed ? 0.7 : 0.3, rotate: reduce ? 0 : 60 }}
        transition={{ duration: reduce ? 0 : 24, ease: "linear", repeat: reduce ? 0 : Infinity, repeatType: "loop" }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(130% 90% at 50% 50%, transparent 40%, rgba(0,0,0,0.85))" }} />

      {/* rising embers — the swell made visible. transform/opacity only; none under reduced-motion. */}
      {!reduce &&
        Array.from({ length: 14 }).map((_, i) => {
          const left = 8 + ((i * 61) % 84);
          const delay = (i % 7) * 0.32;
          const drift = ((i % 5) - 2) * 14;
          return (
            <motion.span
              key={i}
              aria-hidden
              className="pointer-events-none absolute bottom-[-6%] h-1 w-1 rounded-full"
              style={{ left: `${left}%`, background: grade.color, boxShadow: `0 0 8px ${grade.color}` }}
              initial={{ y: 0, x: 0, opacity: 0 }}
              animate={{ y: -560, x: drift, opacity: [0, 0.9, 0] }}
              transition={{ duration: 5 + (i % 4), delay, repeat: Infinity, ease: "easeOut" }}
            />
          );
        })}

      <div className="relative z-[1] text-[10px] uppercase tracking-[0.5em] text-text-faint" style={{ marginBottom: "1.4rem" }}>
        Ascensión
      </div>

      <svg
        viewBox="0 0 120 120"
        width={172}
        height={172}
        aria-hidden
        className="relative z-[1]"
        style={{ filter: `drop-shadow(0 0 26px ${grade.color}80)` }}
      >
        {sigil.paths.map((d, i) => (
          <motion.path
            key={i}
            d={d}
            fill="none"
            stroke={grade.color}
            strokeWidth={i === 0 ? 1.5 : 1}
            strokeLinejoin="round"
            opacity={i === 0 ? 0.95 : 0.6}
            initial={{ pathLength: reduce ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: reduce ? 0 : 1.1, delay: reduce ? 0 : i * 0.12, ease: "easeInOut" }}
          />
        ))}
        <motion.circle
          cx="60"
          cy="60"
          r="4"
          fill={grade.color}
          initial={{ opacity: reduce ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduce ? 0 : 1.3, duration: 0.4 }}
        />
      </svg>

      <motion.div
        className="mt-8"
        initial={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : 14 }}
        animate={revealed ? { opacity: 1, y: 0 } : { opacity: reduce ? 1 : 0, y: reduce ? 0 : 14 }}
        transition={{ duration: reduce ? 0 : 0.7, ease: "easeOut" }}
      >
        <div className="font-display text-2xl tracking-[0.22em]" style={{ color: grade.color }}>
          {grade.name.toUpperCase()}
        </div>
        <div className="mt-1 font-serif text-sm italic text-text-muted">{grade.epithet}</div>
        <p className="mx-auto mt-6 max-w-xs font-serif text-lg leading-relaxed text-text">
          {grade.phrase}
        </p>
        <div
          className="mt-5 text-[11px] uppercase tracking-[0.3em] text-text-faint"
          style={{ fontVariant: "small-caps" }}
        >
          {grade.seal}
        </div>
        <button
          onClick={onDismiss}
          className="mt-9 min-h-11 rounded-[var(--r-sm)] border px-7 py-2 text-sm tracking-wide transition hover:brightness-125"
          style={{ borderColor: grade.color, color: grade.color }}
        >
          Continuar
        </button>
      </motion.div>
    </motion.div>
  );
}
