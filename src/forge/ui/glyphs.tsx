// Engineering Forge glyphs (design §14.1): ↳ ↘ ↗ → ▼ ✓ ✕ ◉ and the lock, drawn in SVG so they never depend on a
// fallback font (the latin Plex subset lacks them). Always aria-hidden and always next to their text. currentColor
// only: the glyph follows the monochrome text tokens (D4).
import type { SVGProps } from "react";

export type ForgeGlyphName = "enter" | "down-right" | "up-right" | "right" | "down" | "check" | "cross" | "observed" | "lock";

const PATHS: Record<ForgeGlyphName, string> = {
  enter: "M4 3v6h8M9 6l3 3-3 3",
  "down-right": "M4 4l8 8M6 12h6V6",
  "up-right": "M4 12l8-8M6 4h6v6",
  right: "M3 8h10M9 4l4 4-4 4",
  down: "M3 5h10L8 12z",
  check: "M3 8.5l3 3 7-7",
  cross: "M4 4l8 8M12 4l-8 8",
  observed: "M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11M8 6a2 2 0 1 0 0 4a2 2 0 1 0 0-4",
  lock: "M4.5 7.5h7v6h-7zM6 7.5V5.5a2 2 0 0 1 4 0v2",
};

export function Glyph({ name, size = 12, ...rest }: { name: ForgeGlyphName; size?: number } & SVGProps<SVGSVGElement>) {
  const filled = name === "down";
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-glyph={name}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
