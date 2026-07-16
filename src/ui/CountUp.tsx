"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";

// An XP/number that CLIMBS to its new value instead of snapping — the "progreso visible" the brain reads
// as reward. rAF tween, easeOutCubic. prefers-reduced-motion → snaps (the number is still correct, just
// no animation). Device-local presentation only; the value comes from the derived model.
export function CountUp({
  value,
  className,
  style,
  duration = 900,
  format = (n: number) => Math.round(n).toLocaleString("en-US"),
}: {
  value: number;
  className?: string;
  style?: CSSProperties;
  duration?: number;
  format?: (n: number) => string;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  // the CURRENTLY-shown number — a new tween starts from HERE, not from the previous tween's start, so a
  // value change mid-climb continues smoothly instead of snapping backward and re-climbing.
  const shown = useRef(value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (reduce || value === shown.current) {
      shown.current = value;
      setDisplay(value);
      return;
    }
    const a = shown.current;
    const b = value;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = a + (b - a) * eased;
      shown.current = v;
      setDisplay(v);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else {
        shown.current = b;
        setDisplay(b);
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, reduce, duration]);

  return (
    <span className={className} style={style}>
      {format(display)}
    </span>
  );
}
