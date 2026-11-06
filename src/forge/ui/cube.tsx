// The «Celda» object of the Forge map: an isometric wireframe cube (design §14.4, viewBox 0 0 56 56). The state is
// read by stroke, fill, glyph and text — never by colour (D4). Pure SVG, currentColor + monochrome literals only.
import { useId } from "react";

export type CubeState = "sellado" | "disponible" | "en-curso" | "dominado" | "observado" | "reprobado";

export const CUBE_STATE_LABEL: Record<CubeState, string> = {
  sellado: "sellado",
  disponible: "disponible",
  "en-curso": "en curso",
  dominado: "dominado",
  observado: "observado",
  reprobado: "reprobado",
};

const TOP = "28,6 50,18 28,30 6,18";
const LEFT = "6,18 28,30 28,52 6,40";
const RIGHT = "50,18 28,30 28,52 50,40";

export function Cube({ state, size = 44 }: { state: CubeState; size?: number }) {
  const hatchId = useId().replace(/:/g, "");
  const dash = state === "sellado" || state === "reprobado" ? "4 3" : state === "observado" ? "1 3" : undefined;
  const stroke = state === "sellado" ? "var(--forge-control, #9b9b9b)" : "#ffffff";
  const width = state === "sellado" || state === "reprobado" ? 1 : 1.5;
  const topFill = state === "dominado" ? "#ffffff" : state === "en-curso" ? `url(#h${hatchId})` : "none";
  const lit = state === "disponible" || state === "en-curso" || state === "dominado";
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 56 56"
      className={lit ? "forge-cube-lit" : undefined}
      data-cube={state}
    >
      <defs>
        <pattern id={`h${hatchId}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.35" />
        </pattern>
      </defs>
      <g fill="none" stroke={stroke} strokeWidth={width} strokeDasharray={dash} strokeLinejoin="round">
        <polygon points={TOP} fill={topFill} />
        <polygon points={LEFT} />
        <polygon points={RIGHT} />
      </g>
      {state === "dominado" && (
        <path d="M21 18l5 4 9-7" fill="none" stroke="#0a0a0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {state === "observado" && <circle cx="28" cy="18" r="3" fill="none" stroke="#ffffff" strokeWidth="1.2" />}
      {state === "reprobado" && <path d="M24 14l8 8M32 14l-8 8" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" />}
      {state === "sellado" && (
        <g fill="none" stroke="var(--forge-control, #9b9b9b)" strokeWidth="1.2">
          <rect x="24" y="33" width="8" height="7" />
          <path d="M25.5 33v-2.5a2.5 2.5 0 0 1 5 0V33" />
        </g>
      )}
    </svg>
  );
}
