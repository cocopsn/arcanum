"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useArcanum } from "@/app/providers";
import { orderTopics } from "@/lib/subject-path";
import { nodeStatus, type NodeStatus } from "@/core/roadmap";
import { themeForGoal, type MotifId } from "@/lib/subject-themes";
import { contentForModule } from "@/lib/subject-content";
import { readableAccent } from "@/lib/accent";
import { TopicDetailSheet } from "@/ui/subject/TopicDetailSheet";
import type { ModuleRM } from "@/core/read-model";

// Fixed design-width coordinate system so the winding SVG connector and the
// absolutely-positioned badges share one geometry (fits a 375px phone, centered on
// desktop). The whole map is themed per subject via SVG motifs — zero image-API cost.
const W = 340;
const CX = W / 2;
const ROW_H = 108;
const AMP = 56;
const TOP = 44;
const WAVE = [0, AMP, 0, -AMP];
const xAt = (i: number) => CX + WAVE[i % WAVE.length]!;

function MotifPattern({ id, motif, color }: { id: string; motif: MotifId; color: string }) {
  const s = { stroke: color, strokeWidth: 1.2, fill: "none", opacity: 0.5 } as const;
  if (motif === "circuit") {
    return (
      <pattern id={id} width="56" height="56" patternUnits="userSpaceOnUse">
        <path d="M4 28 H24 M32 28 H52 M28 4 V24 M28 32 V52" {...s} />
        <circle cx="28" cy="28" r="3.5" {...s} />
        <circle cx="4" cy="28" r="1.6" fill={color} opacity={0.5} />
      </pattern>
    );
  }
  if (motif === "runes") {
    return (
      <pattern id={id} width="52" height="64" patternUnits="userSpaceOnUse">
        <path d="M12 10 V40 M12 16 L22 24 M12 28 L22 20" {...s} />
        <path d="M36 30 V58 M36 36 L44 44 M36 52 L44 44" {...s} />
      </pattern>
    );
  }
  if (motif === "cipher") {
    return (
      <pattern id={id} width="48" height="48" patternUnits="userSpaceOnUse">
        <path d="M10 10 L22 22 M22 10 L10 22" {...s} />
        <circle cx="36" cy="36" r="6" {...s} />
        <path d="M30 36 H42 M36 30 V42" {...s} />
      </pattern>
    );
  }
  if (motif === "lattice") {
    return (
      <pattern id={id} width="44" height="44" patternUnits="userSpaceOnUse">
        <path d="M22 4 L40 22 L22 40 L4 22 Z" {...s} />
        <circle cx="22" cy="22" r="1.6" fill={color} opacity={0.45} />
      </pattern>
    );
  }
  return (
    <pattern id={id} width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="20" cy="20" r="1.5" fill={color} opacity={0.4} />
    </pattern>
  );
}

const GLYPH: Record<NodeStatus, string> = { sealed: "⊘", available: "❯", started: "◆", completed: "✓" };

function TopicBadge({
  topic,
  status,
  index,
  retr,
  accent,
  onOpen,
}: {
  topic: ModuleRM;
  status: NodeStatus;
  index: number;
  retr: number;
  accent: string;
  onOpen: () => void;
}) {
  const sealed = status === "sealed";
  const completed = status === "completed";
  const started = status === "started";
  const r = 26;
  const c = 2 * Math.PI * r;

  return (
    <button
      onClick={onOpen}
      className="topic-badge absolute flex -translate-x-1/2 flex-col items-center gap-1.5"
      style={
        {
          left: xAt(index),
          top: TOP + index * ROW_H,
          ["--accent" as string]: accent,
          animationDelay: `${Math.min(index * 55, 600)}ms`,
        } as CSSProperties
      }
      data-status={status}
      aria-label={`${topic.title} — ${status}`}
    >
      <span className="topic-disc relative grid h-[60px] w-[60px] place-items-center rounded-full">
        <svg viewBox="0 0 60 60" width={60} height={60} className="absolute inset-0" aria-hidden>
          <circle cx="30" cy="30" r={r} fill="none" stroke="var(--line)" strokeWidth="3" />
          {!sealed && (
            <circle
              cx="30"
              cy="30"
              r={r}
              fill="none"
              stroke={accent}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={completed ? 0 : c * (1 - Math.max(0, Math.min(1, retr)))}
              transform="rotate(-90 30 30)"
              style={{ transition: "stroke-dashoffset 600ms ease" }}
            />
          )}
        </svg>
        <span aria-hidden className="z-[1] text-lg" style={{ color: sealed ? "var(--text-faint)" : accent }}>
          {GLYPH[status]}
        </span>
        {started && <span className="topic-pulse" style={{ background: accent }} aria-hidden />}
      </span>
      <span
        className="max-w-[128px] text-center font-serif text-[12px] leading-tight text-text"
        style={sealed ? { filter: "blur(4px)", opacity: 0.5, userSelect: "none" } : undefined}
      >
        {topic.title}
      </span>
    </button>
  );
}

export function SubjectMap({ goalId, onClose }: { goalId: string; onClose: () => void }) {
  const readModel = useArcanum((s) => s.readModel);
  const vmModules = useArcanum((s) => s.viewModel.modules);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Escape closes the map — but only when no topic detail is open (it self-handles).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !detailId) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailId, onClose]);

  const goal = readModel.goals.find((g) => g.id === goalId) ?? null;
  const theme = themeForGoal(goal?.title ?? "");
  const accent = goal?.color ?? theme.accent;

  const topics = useMemo(() => {
    const mods = readModel.modules.filter((m) => m.goalId === goalId);
    return orderTopics(mods, readModel.edges);
  }, [readModel.modules, readModel.edges, goalId]);

  const byId = useMemo(() => new Map(readModel.modules.map((m) => [m.id, m])), [readModel.modules]);
  const retrOf = useMemo(() => new Map(vmModules.map((m) => [m.id, m.retrievability])), [vmModules]);

  const height = TOP + topics.length * ROW_H + 80;
  const motifId = `motif-${theme.slug}`;
  const connectorD = topics.map((_, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${TOP + i * ROW_H + 30}`).join(" ");

  if (!goal) return null;

  return (
    <div className="fixed inset-0 z-50 bg-ink" style={{ ["--accent" as string]: accent } as CSSProperties}>
      <div className="scroll-touch h-full overflow-y-auto" style={{ paddingTop: "max(4.75rem, calc(env(safe-area-inset-top) + 3.75rem))" }}>
        <div className="relative mx-auto" style={{ height, width: W }}>
          <svg className="pointer-events-none absolute inset-0" width={W} height={height} viewBox={`0 0 ${W} ${height}`} aria-hidden>
            <defs>
              <MotifPattern id={motifId} motif={theme.motif} color={accent} />
            </defs>
            <rect width={W} height={height} fill={`url(#${motifId})`} opacity={0.14} />
            <path d={connectorD} fill="none" stroke="var(--line)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 11" />
          </svg>

          {topics.map((t, i) => (
            <TopicBadge
              key={t.id}
              topic={t}
              index={i}
              status={nodeStatus(t, readModel.edges, byId)}
              retr={retrOf.get(t.id) ?? 0}
              accent={accent}
              onOpen={() => setDetailId(t.id)}
            />
          ))}
        </div>
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
        <button onClick={onClose} className="pointer-events-auto min-h-11 rounded-[var(--r-pill)] border border-line bg-surface/90 px-4 text-[11px] uppercase tracking-[0.2em] text-text-muted transition hover:text-text">
          ‹ Cerrar
        </button>
        <div className="text-center">
          <div className="font-display text-sm tracking-[0.18em]" style={{ color: readableAccent(accent) }}>
            {goal.title}
          </div>
          <div className="text-[10px] tracking-[0.12em] text-text-faint">{theme.tagline}</div>
        </div>
        <span aria-hidden className="grid min-h-11 min-w-11 place-items-center text-xl" style={{ color: accent }}>
          {theme.glyph}
        </span>
      </header>

      {detailId && <TopicDetailSheet moduleId={detailId} accent={accent} onClose={() => setDetailId(null)} />}
    </div>
  );
}
