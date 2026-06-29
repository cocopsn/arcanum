"use client";

import type { Stats } from "@/core/read-model";
import { gradeForXp } from "@/core/grade";

function heptagramPath(cx: number, cy: number, r: number): string {
  const pts: [number, number][] = Array.from({ length: 7 }, (_, i) => {
    const a = ((-90 + i * (360 / 7)) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  const order = [0, 3, 6, 2, 5, 1, 4, 0];
  return (
    order
      .map((idx, i) => {
        const p = pts[idx]!;
        return `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
      })
      .join(" ") + " Z"
  );
}

export function GradeSigil({ stats }: { stats: Stats }) {
  const g = gradeForXp(stats.totalXp);
  const frac =
    g.nextXp == null || g.nextXp === g.floorXp
      ? 1
      : Math.min(1, Math.max(0, (stats.totalXp - g.floorXp) / (g.nextXp - g.floorXp)));
  const ringR = 52;
  const circ = 2 * Math.PI * ringR;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox="0 0 120 120"
        width={132}
        height={132}
        role="img"
        aria-label={`Grado ${stats.grade}`}
        style={{ filter: "drop-shadow(0 0 10px var(--rank-glow))" }}
      >
        <circle cx="60" cy="60" r={ringR} fill="none" stroke="var(--line)" strokeWidth="1.5" />
        <circle
          cx="60"
          cy="60"
          r={ringR}
          fill="none"
          stroke="var(--rank)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - frac)}
          transform="rotate(-90 60 60)"
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
        <path d={heptagramPath(60, 60, 38)} fill="none" stroke="var(--rank)" strokeWidth="1.25" strokeLinejoin="round" opacity="0.92" />
        <circle cx="60" cy="60" r="4" fill="var(--rank)" />
      </svg>

      <div className="text-center">
        <div className="font-display text-xl tracking-[0.18em] text-[var(--rank)]">
          {stats.grade.toUpperCase()}
        </div>
        <div className="tnum mt-1 font-mono text-sm text-text-muted">
          {stats.totalXp.toLocaleString("en-US")} XP
          {g.nextXp != null && (
            <span className="text-text-faint"> / {g.nextXp.toLocaleString("en-US")}</span>
          )}
        </div>
      </div>
    </div>
  );
}
