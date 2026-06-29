"use client";

import { motion, useReducedMotion } from "framer-motion";

/** A single rising +XP mote, tinted by the current rank aura. */
export function XpBurst({ amount }: { amount: number }) {
  const reduce = useReducedMotion();
  if (amount <= 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.9 }}
      animate={{ opacity: 1, y: reduce ? 0 : -30, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0.2 : 0.95, ease: "easeOut" }}
      className="tnum pointer-events-none select-none font-mono text-lg font-medium text-rank"
      style={{ textShadow: "0 0 14px var(--rank-glow)" }}
    >
      +{amount} XP
    </motion.div>
  );
}
