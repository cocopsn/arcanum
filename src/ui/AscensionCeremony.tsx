"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import type { GradeInfo } from "@/core/grade";
import { gradeSigil } from "@/lib/grade-sigil";

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

  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(() => setRevealed(true), 1400 + 800); // draw ~1.4s + beat 0.8s
    return () => window.clearTimeout(t);
  }, [reduce]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-8 text-center"
      style={{ background: "#050507" }}
      initial={{ opacity: reduce ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0 : 0.6 }}
      role="dialog"
      aria-label={`Ascensión a ${grade.name}`}
    >
      <svg
        viewBox="0 0 120 120"
        width={168}
        height={168}
        aria-hidden
        style={{ filter: `drop-shadow(0 0 18px ${grade.color}66)` }}
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
