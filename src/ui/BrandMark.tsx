import type { CSSProperties } from "react";

// The ARCANUM mark: the guardian raven (assets/brand/cuervo-guardian-1254.png → public/icons/logo-256.png, made by
// `pnpm icons`). A plain <img> on a precached URL (next.config globPublicPatterns "icons/**/*"), so it draws offline
// from the first install; the rounded tile is the image's own #0C0016 background. Engineering Forge stays monochrome
// (D4): this mark is never rendered on a Forge screen.
export function BrandMark({ size, className = "", style }: { size: number; className?: string; style?: CSSProperties }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- precached brand icon; the image optimizer would bypass the precache
    <img
      src="/icons/logo-256.png"
      width={size}
      height={size}
      alt="Cuervo guardián, emblema de Arcanum"
      decoding="async"
      className={`shrink-0 rounded-[22%] ${className}`}
      style={style}
    />
  );
}
