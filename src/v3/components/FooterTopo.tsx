import { useMemo } from "react";

/**
 * The footer's background: a hill drawn as topographic contours in the corner (the site's own map language), with
 * one contour lit as an ember line a fire front travels along. The rings are closed smooth curves around a centre
 * off the corner, each radius perturbed by the same few low harmonics (so neighbouring rings never cross), phase
 * shifted ring to ring so the hill leans like real terrain. Motion (CSS): the hill breathes and turns very slowly,
 * the fire front runs along its contour, an ember pulses on it. Motion off: a still map.
 */
const W = 900, H = 520;
const CX = 820, CY = 560;              // the summit, just off the bottom-right corner
const RINGS = 16;
const LIT = 9;                          // the contour the fire front runs along

function ring(k: number) {
  const base = 48 + k * 34 + k * k * 0.9;
  const n = 72;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const wob =
      0.13 * Math.sin(2 * a + 0.6 + k * 0.05) +
      0.08 * Math.sin(3 * a + 1.9 + k * 0.11) +
      0.05 * Math.sin(5 * a + 0.3 - k * 0.07) +
      0.03 * Math.sin(7 * a + 2.4 + k * 0.13);
    const r = base * (1 + wob) * (1 + 0.18 * Math.cos(a - 2.5));   // a longer flank toward the upper left
    pts.push([CX + Math.cos(a) * r * 1.25, CY + Math.sin(a) * r * 0.82]);
  }
  // closed Catmull-Rom → cubic Bézier
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + "Z";
}

export function FooterTopo() {
  const rings = useMemo(() => Array.from({ length: RINGS }, (_, k) => ring(k)), []);
  return (
    <svg className="ftopo" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMaxYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="ftopo-fade" cx="94%" cy="100%" r="64%">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.7" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="ftopo-mask">
          <rect width={W} height={H} fill="url(#ftopo-fade)" />
        </mask>
        <filter id="ftopo-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g mask="url(#ftopo-mask)">
        <g className="ftopo__hill">
          {rings.map((d, k) => (
            <path key={k} d={d} className={k % 5 === 4 ? "ftopo__ring ftopo__ring--index" : "ftopo__ring"} />
          ))}
          <path d={rings[LIT]} className="ftopo__lit" pathLength={1} />
          <path d={rings[LIT]} className="ftopo__front" pathLength={1} filter="url(#ftopo-glow)" />
        </g>
      </g>
    </svg>
  );
}
