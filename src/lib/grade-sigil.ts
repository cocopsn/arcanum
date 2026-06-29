// Parametric per-grade seal. Each grade gets a DISTINCT geometry (not the same
// star recolored): point count grows 3→13 (spark → source), with concentric
// rings and radial rays accruing at higher grades. Pure → testable.

type Pt = readonly [number, number];

function pt(cx: number, cy: number, r: number, deg: number): Pt {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** A step that yields a star polygon (coprime with points, ~points/2.4); 1 = convex. */
function starStep(points: number): number {
  if (points < 5) return 1;
  const target = Math.max(2, Math.round(points / 2.4));
  for (let t = 0; t < points; t++) {
    const cand = (((target - t) % points) + points) % points;
    if (cand >= 2 && gcd(cand, points) === 1) return cand;
  }
  return 1;
}

function starPath(cx: number, cy: number, r: number, points: number, step: number): string {
  const verts: Pt[] = Array.from({ length: points }, (_, i) =>
    pt(cx, cy, r, -90 + (i * 360) / points),
  );
  const order: number[] = [];
  let idx = 0;
  for (let k = 0; k < points; k++) {
    order.push(idx);
    idx = (idx + step) % points;
  }
  return (
    order.map((j, i) => `${i === 0 ? "M" : "L"}${verts[j]![0].toFixed(2)} ${verts[j]![1].toFixed(2)}`).join(" ") + " Z"
  );
}

function circlePath(cx: number, cy: number, r: number): string {
  const l = (cx - r).toFixed(2);
  const rr = (cx + r).toFixed(2);
  const c = cy.toFixed(2);
  return `M${l} ${c} A${r} ${r} 0 1 1 ${rr} ${c} A${r} ${r} 0 1 1 ${l} ${c} Z`;
}

export interface SigilGeometry {
  /** stroke paths, drawn (pathLength) during the ascension ceremony */
  paths: string[];
  /** point count of the core star (for aria / debugging) */
  points: number;
}

/** Build the seal geometry for a grade index (0 = Scintilla … 10 = Origo). */
export function gradeSigil(index: number, cx = 60, cy = 60, r = 38): SigilGeometry {
  const i = Math.max(0, Math.min(10, index));
  const points = 3 + i;
  const paths: string[] = [starPath(cx, cy, r, points, starStep(points))];

  const ringCount = Math.floor(i / 3); // 0,0,0,1,1,1,2,2,2,3,3
  for (let k = 0; k < ringCount; k++) paths.push(circlePath(cx, cy, r + 6 + k * 7));

  if (i >= 7) {
    const base = r + 6 + ringCount * 7;
    for (let k = 0; k < points; k++) {
      const a = -90 + (k * 360) / points;
      const [x1, y1] = pt(cx, cy, base, a);
      const [x2, y2] = pt(cx, cy, base + 9, a);
      paths.push(`M${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)}`);
    }
  }
  return { paths, points };
}
