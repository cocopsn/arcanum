"use client";

import type { NodeProps } from "@xyflow/react";

export interface LaneHeaderData {
  title: string;
  color: string;
  [key: string]: unknown;
}

/** A non-interactive lane marker — the goal's name + color seal, anchored left. */
export function LaneHeader({ data }: NodeProps) {
  const d = data as LaneHeaderData;
  return (
    <div className="flex items-center gap-2.5 pr-4" style={{ width: 200 }}>
      <span
        aria-hidden
        className="h-8 w-1 rounded-full"
        style={{ background: d.color, boxShadow: `0 0 12px ${d.color}66` }}
      />
      <span
        className="font-display text-[15px] leading-tight tracking-[0.06em]"
        style={{ color: d.color }}
      >
        {d.title}
      </span>
    </div>
  );
}
