"use client";

import type { Stats } from "@/core/read-model";
import { gradeForXp } from "@/core/grade";
import { gradeSigil } from "@/lib/grade-sigil";

export function GradeSigil({ stats }: { stats: Stats }) {
  const g = gradeForXp(stats.totalXp);
  const frac =
    g.nextXp == null || g.nextXp === g.floorXp
      ? 1
      : Math.min(1, Math.max(0, (stats.totalXp - g.floorXp) / (g.nextXp - g.floorXp)));
  const ringR = 52;
  const circ = 2 * Math.PI * ringR;
  const sigil = gradeSigil(g.index);

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox="0 0 120 120"
        width={132}
        height={132}
        role="img"
        aria-label={`Sello ${g.name}`}
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
        {sigil.paths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="var(--rank)"
            strokeWidth={i === 0 ? 1.25 : 1}
            strokeLinejoin="round"
            opacity={i === 0 ? 0.95 : 0.6}
          />
        ))}
        <circle cx="60" cy="60" r="4" fill="var(--rank)" />
      </svg>

      <div className="text-center">
        <div className="font-display text-xl tracking-[0.18em] text-rank">
          {g.name.toUpperCase()}
        </div>
        <div className="mt-0.5 font-serif text-[13px] italic text-text-muted">{g.epithet}</div>
        <div className="tnum mt-1.5 text-sm">
          <span
            className="font-display text-base text-gold"
            style={{ textShadow: "0 0 12px var(--gold-glow)" }}
          >
            {stats.totalXp.toLocaleString("en-US")}
          </span>
          <span className="ml-1 text-text-muted">XP</span>
          {g.nextXp != null && (
            <span className="text-text-faint"> / {g.nextXp.toLocaleString("en-US")}</span>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-text-faint">
          <span style={{ fontVariant: "small-caps", letterSpacing: "0.1em" }}>{g.seal}</span>
          <span aria-hidden>·</span>
          <span title="El grado es acumulativo: nunca baja.">récord</span>
        </div>
      </div>
    </div>
  );
}
