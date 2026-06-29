"use client";

import { rankAuraVars } from "@/lib/rank-aura";
import type { GradeName } from "@/core/config";
import type { CSSProperties } from "react";

/**
 * Wraps the app and projects the current grade's aura onto CSS vars. Ascending
 * a grade swaps these → every descendant + the ambient glow retints (spec §9.3).
 */
export function RankAura({
  grade,
  children,
}: {
  grade: GradeName;
  children: React.ReactNode;
}) {
  const style = rankAuraVars(grade) as CSSProperties;
  return (
    <div style={style} className="relative min-h-full">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(120% 70% at 50% -15%, var(--rank-soft), transparent 55%)",
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
