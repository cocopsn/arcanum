"use client";

// The map of ONE Forge route (design §14.4, RNF-2): each cell is an isometric wireframe cube whose state is read by
// stroke, fill, glyph and text (D4, no colour). Mobile: a vertical column of rows «cube + code + title + chip».
// Desktop: an isometric staircase. The only blocking link is «secuencia» (solid); fog-of-war comes from the log.
import { useMemo } from "react";
import type { ReadModel } from "@/core/read-model";
import { FORGE_SPINE } from "@/lib/spines-forge";
import { forgeCodeForCellId } from "@/forge/ids";
import { forgeCellState } from "@/forge/model/console-stats";
import { Cube, CUBE_STATE_LABEL, type CubeState } from "@/forge/ui/cube";
import { Glyph, type ForgeGlyphName } from "@/forge/ui/glyphs";

const STATE_GLYPH: Record<CubeState, ForgeGlyphName> = {
  sellado: "lock",
  disponible: "enter",
  "en-curso": "down-right",
  dominado: "check",
  observado: "observed",
  reprobado: "cross",
};

export interface ForgeMapCell {
  id: string;
  code: string;
  title: string;
  state: CubeState;
}

export function forgeRouteCells(slug: string, readModel: ReadModel): ForgeMapCell[] {
  const firstSlug = FORGE_SPINE.paths[0]!.slug;
  const byId = new Map(readModel.modules.map((m) => [m.id, m]));
  return FORGE_SPINE.cells
    .filter((c) => (c.pathSlug ?? firstSlug) === slug)
    .map((c) => ({
      id: c.id,
      code: forgeCodeForCellId(c.id) ?? "",
      title: c.title,
      state: forgeCellState(byId.get(c.id), readModel, byId),
    }));
}

export function ForgeRouteMap({
  slug,
  readModel,
  desktop,
  onOpen,
}: {
  slug: string;
  readModel: ReadModel;
  desktop: boolean;
  onOpen: (cellId: string) => void;
}) {
  const cells = useMemo(() => forgeRouteCells(slug, readModel), [slug, readModel]);
  if (cells.length === 0) return <p className="text-sm text-text-muted">Esta ruta no tiene celdas.</p>;

  // desktop: an isometric staircase (each step shifts right, wrapping every 4) inside a 760 px canvas; mobile: a column
  return (
    <ol className={desktop ? "mx-auto w-full max-w-[760px] space-y-1.5" : "space-y-2"} data-forge-map={slug}>
      {cells.map((c, i) => (
        <li key={c.id} className="relative" style={desktop ? { paddingLeft: (i % 4) * 96 } : undefined}>
          {i > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-2 h-2 w-px bg-[rgba(255,255,255,0.25)]"
              style={{ left: (desktop ? (i % 4) * 96 : 0) + 21 }}
            />
          )}
          <CellButton cell={c} onOpen={onOpen} />
        </li>
      ))}
    </ol>
  );
}

function CellButton({ cell, onOpen }: { cell: ForgeMapCell; onOpen: (id: string) => void }) {
  const label = CUBE_STATE_LABEL[cell.state];
  return (
    <button
      type="button"
      onClick={() => onOpen(cell.id)}
      aria-label={`${cell.code} · ${cell.title} — ${label}`}
      data-state={cell.state}
      className="flex min-h-11 w-full max-w-[420px] items-center gap-3 rounded-[2px] border border-[rgba(255,255,255,0.08)] bg-surface/90 px-2 py-1.5 text-left transition hover:border-[rgba(255,255,255,0.35)]"
    >
      <Cube state={cell.state} size={40} />
      <span className="min-w-0 flex-1">
        <span className="forge-label block text-[11px] text-text-muted">{cell.code}</span>
        <span className={`block truncate text-[13px] leading-snug ${cell.state === "sellado" ? "text-text-muted" : "text-text"}`}>{cell.title}</span>
      </span>
      <span
        className={`forge-label inline-flex shrink-0 items-center gap-1 border px-1.5 py-0.5 text-[10px] text-text-muted ${cell.state === "sellado" || cell.state === "reprobado" ? "border-dashed" : ""}`}
        style={{ borderColor: "var(--forge-control)" }}
      >
        <Glyph name={STATE_GLYPH[cell.state]} size={10} />
        {label}
      </span>
    </button>
  );
}
