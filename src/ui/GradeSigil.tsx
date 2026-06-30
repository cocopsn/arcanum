"use client";

import type { Stats } from "@/core/read-model";
import { gradeForXp, gradeByIndex } from "@/core/grade";
import { gradeSigil } from "@/lib/grade-sigil";

// THE CROWN — the Scintilla→Origo ascent presented with ceremonial weight (not a corner badge):
// the grade sigil in a halo, the imperial name (Cinzel), the epithet, the latin seal, the eternal
// record ("nunca baja"), and the arc + bar of progress to the next threshold. The ego, at the front.
export function GradeSigil({ stats }: { stats: Stats }) {
  const g = gradeForXp(stats.totalXp);
  const next = g.nextXp != null ? gradeByIndex(g.index + 1) : null;
  const frac =
    g.nextXp == null || g.nextXp === g.floorXp
      ? 1
      : Math.min(1, Math.max(0, (stats.totalXp - g.floorXp) / (g.nextXp - g.floorXp)));
  const ringR = 50;
  const circ = 2 * Math.PI * ringR;
  const sigil = gradeSigil(g.index);

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="text-[9px] uppercase tracking-[0.4em] text-text-faint">Grado · récord eterno</div>

      <div className="relative grid place-items-center">
        {/* ceremonial bloom behind the sigil */}
        <div
          aria-hidden
          className="pointer-events-none absolute h-[180px] w-[180px] rounded-full"
          style={{ background: "radial-gradient(circle, var(--rank-glow), transparent 68%)", opacity: 0.7 }}
        />
        <svg
          viewBox="0 0 120 120"
          width={150}
          height={150}
          role="img"
          aria-label={`Sello ${g.name}`}
          style={{ filter: "drop-shadow(0 0 14px var(--rank-glow))" }}
        >
          {/* twin frame rings — the seal */}
          <circle cx="60" cy="60" r="56" fill="none" stroke="var(--line)" strokeWidth="1" opacity="0.6" />
          <circle cx="60" cy="60" r={ringR} fill="none" stroke="var(--line)" strokeWidth="1.5" />
          <circle
            cx="60"
            cy="60"
            r={ringR}
            fill="none"
            stroke="var(--rank)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - frac)}
            transform="rotate(-90 60 60)"
            style={{ transition: "stroke-dashoffset 800ms ease" }}
          />
          {sigil.paths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="var(--rank)"
              strokeWidth={i === 0 ? 1.3 : 1}
              strokeLinejoin="round"
              opacity={i === 0 ? 0.95 : 0.6}
            />
          ))}
          <circle cx="60" cy="60" r="4" fill="var(--rank)" />
        </svg>
      </div>

      <div>
        <div
          className="font-display text-[27px] leading-none tracking-[0.16em] text-rank"
          style={{ textShadow: "0 0 18px var(--rank-glow)" }}
        >
          {g.name.toUpperCase()}
        </div>
        <div className="mt-1.5 font-serif text-[13px] italic text-text-muted">{g.epithet}</div>
        <div
          className="mt-2 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-text-faint"
          style={{ fontVariant: "small-caps" }}
        >
          <span aria-hidden className="h-px w-5" style={{ background: "color-mix(in srgb, var(--gold) 50%, transparent)" }} />
          {g.seal}
          <span aria-hidden className="h-px w-5" style={{ background: "color-mix(in srgb, var(--gold) 50%, transparent)" }} />
        </div>
      </div>

      {/* the climb — XP record + the road to the next imperial rung */}
      <div className="w-full max-w-[230px]">
        <div className="tnum flex items-baseline justify-center gap-1 text-sm">
          <span className="font-display text-lg text-gold" style={{ textShadow: "0 0 12px var(--gold-glow)" }}>
            {stats.totalXp.toLocaleString("en-US")}
          </span>
          <span className="text-text-muted">XP</span>
          {g.nextXp != null && <span className="text-text-faint">· {g.nextXp.toLocaleString("en-US")}</span>}
        </div>
        {next && (
          <>
            <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full" style={{ width: `${Math.round(frac * 100)}%`, background: "linear-gradient(90deg, var(--rank), var(--gold))", transition: "width 800ms ease" }} />
            </div>
            <div className="mt-1.5 text-[9px] uppercase tracking-[0.26em] text-text-faint">
              hacia <span className="text-text-muted">{next.name}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
