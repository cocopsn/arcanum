// Brand constants shared by scripts/generate-icons.mjs and src/app/brand-icons.test.ts (post-merge review #11, #12).
// The generator runs at import time (top-level await), so the test cannot import it: both import these instead.

/** The raven's own background, #0C0016. The generator checks the source's measured background against it. */
export const BRAND_BG = [0x0c, 0x00, 0x16];
/** A pixel is raven when some channel is more than this away from the background. */
export const RAVEN_THRESHOLD = 24;

/** Precondition of the generator: the dominant flat color covers the whole canvas border, i.e. it IS the background.
 *  Returns the first border pixel that is farther than `t` from `bg` in some channel, or null. `px` is RGB, row-major. */
export function borderOffender(px, W, H, bg, t) {
  const far = (x, y) => {
    const i = (y * W + x) * 3;
    return Math.abs(px[i] - bg[0]) > t || Math.abs(px[i + 1] - bg[1]) > t || Math.abs(px[i + 2] - bg[2]) > t;
  };
  for (let x = 0; x < W; x++) {
    if (far(x, 0)) return { x, y: 0 };
    if (far(x, H - 1)) return { x, y: H - 1 };
  }
  for (let y = 0; y < H; y++) {
    if (far(0, y)) return { x: 0, y };
    if (far(W - 1, y)) return { x: W - 1, y };
  }
  return null;
}
