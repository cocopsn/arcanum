import type { CSSProperties } from "react";

// The ARCANUM mark: the guardian raven (assets/brand/cuervo-guardian-1254.png → public/icons/logo-256.png, made by
// `pnpm icons`). A plain <img> on a precached URL (next.config globPublicPatterns "icons/**/*"), so it draws offline
// from the first install; the rounded tile is the image's own #0C0016 background. Engineering Forge stays monochrome
// (D4): this mark is never rendered on a Forge screen.
// `alt` defaults to "" (decorative): every current use sits next to the visible word ARCANUM, so a descriptive alt made
// screen readers announce the brand twice (post-merge review #2). Pass BRAND_ALT where the mark stands alone.
export const BRAND_ALT = "Cuervo guardián, emblema de Arcanum";
export function BrandMark({
  size,
  className = "",
  style,
  alt = "",
}: {
  size: number;
  className?: string;
  style?: CSSProperties;
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- precached brand icon; the image optimizer would bypass the precache
    <img
      src="/icons/logo-256.png"
      width={size}
      height={size}
      alt={alt}
      decoding="async"
      className={`shrink-0 rounded-[22%] ${className}`}
      style={style}
    />
  );
}
