"use client";

import { ARCANUM_CONFIG } from "@/core/config";

/** Cold arcane fire (violet→cyan), shields as warding pips. Dims when broken. */
export function StreakFlame({
  streak,
  shields,
  alive,
}: {
  streak: number;
  shields: number;
  alive: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative" style={{ opacity: alive ? 1 : 0.4 }}>
        <svg
          viewBox="0 0 32 40"
          width={30}
          height={38}
          role="img"
          aria-label={`Racha ${streak} días`}
          style={{ filter: alive ? "drop-shadow(0 0 8px rgba(124,77,232,0.55))" : "none" }}
        >
          <defs>
            <linearGradient id="arcfire" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={alive ? "#7c4de8" : "#4a4658"} />
              <stop offset="100%" stopColor={alive ? "#25b0c9" : "#6b6780"} />
            </linearGradient>
          </defs>
          <path
            d="M16 2 C 9 12, 26 16, 16 26 C 6 16, 23 12, 16 2 Z M16 14 C 12 20, 21 22, 16 31 C 11 22, 20 20, 16 14 Z"
            fill="url(#arcfire)"
            fillRule="evenodd"
          />
          <path d="M16 8 C 12 16, 20 18, 16 30 C 12 18, 20 16, 16 8 Z" fill={alive ? "#cfeaf3" : "#8a86a0"} opacity="0.85" />
        </svg>
      </div>

      <div className="leading-none">
        <span className="tnum font-mono text-2xl text-text">{streak}</span>
        <span className="ml-1 text-xs text-text-muted">días</span>
        <div className="mt-1 flex gap-1" aria-label={`${shields} escudos`}>
          {Array.from({ length: ARCANUM_CONFIG.streak.shieldMax }, (_, i) => (
            <Shield key={i} active={i < shields} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Shield({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 16 18" width={12} height={14} aria-hidden>
      <path
        d="M8 1 L14 3 V8 C14 13, 8 16, 8 16 C8 16, 2 13, 2 8 V3 Z"
        fill={active ? "var(--topic)" : "none"}
        stroke={active ? "var(--topic)" : "var(--line)"}
        strokeWidth="1"
        opacity={active ? 0.9 : 0.6}
      />
    </svg>
  );
}
