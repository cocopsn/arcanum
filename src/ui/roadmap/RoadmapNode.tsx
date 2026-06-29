"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { NodeStatus } from "@/core/roadmap";

export interface RoadmapNodeData {
  title: string;
  status: NodeStatus;
  /** r(now) ∈ [0,1] — mastery sigil charge */
  retrievability: number;
  goalColor: string;
  firetestRatio: number | null;
  onOpen: (moduleId: string) => void;
  [key: string]: unknown;
}

const LABEL: Record<NodeStatus, string> = {
  sealed: "Sellado",
  available: "Disponible",
  started: "En curso",
  completed: "Completado",
};

/** The mastery sigil — a charging ring (same language as the home ModuleCard). */
function Sigil({ charge, color, dim }: { charge: number; color: string; dim: boolean }) {
  const r = 11;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, charge));
  return (
    <svg viewBox="0 0 28 28" width={28} height={28} aria-hidden className="shrink-0">
      <circle cx="14" cy="14" r={r} fill="none" stroke="var(--line)" strokeWidth="2" />
      {!dim && (
        <circle
          cx="14"
          cy="14"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
          transform="rotate(-90 14 14)"
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      )}
      <circle cx="14" cy="14" r="2.2" fill={dim ? "var(--text-faint)" : color} opacity={dim ? 0.5 : 0.4 + 0.6 * f} />
    </svg>
  );
}

export function RoadmapNode({ id, data, selected }: NodeProps) {
  const d = data as RoadmapNodeData;
  const sealed = d.status === "sealed";
  const completed = d.status === "completed";
  const started = d.status === "started";
  const charge = Math.round((d.retrievability ?? 0) * 100);

  return (
    <button
      type="button"
      onClick={() => d.onOpen(id)}
      className="rf-node group block text-left"
      data-status={d.status}
      data-selected={selected ? "1" : undefined}
      style={
        {
          ["--goal" as string]: d.goalColor,
          width: 184,
        } as React.CSSProperties
      }
      aria-label={`${d.title} — ${LABEL[d.status]}`}
    >
      <Handle type="target" position={Position.Left} className="rf-port" />
      <div className="flex items-center gap-3 px-3.5 py-2.5">
        <Sigil charge={d.retrievability ?? 0} color={d.goalColor} dim={sealed} />
        <div className="min-w-0 flex-1">
          <div
            className="truncate font-serif text-[13px] leading-tight text-text"
            style={sealed ? { filter: "blur(4.5px)", opacity: 0.5, userSelect: "none" } : undefined}
          >
            {d.title}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.16em]">
            {sealed ? (
              <span className="text-text-faint">◆ {LABEL.sealed}</span>
            ) : (
              <>
                <span style={{ color: d.goalColor }}>{LABEL[d.status]}</span>
                {!completed && <span className="tnum text-text-faint">· {charge}%</span>}
                {completed && <span className="text-gold">· sellado</span>}
              </>
            )}
          </div>
        </div>
        {started && <span className="rf-pulse" aria-hidden style={{ background: d.goalColor }} />}
      </div>
      <Handle type="source" position={Position.Right} className="rf-port" />
    </button>
  );
}
