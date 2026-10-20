import { useId } from "react";
import type React from "react";

/**
 * Sequoia Security wordmark, rebuilt from the client's business card (references/Sequoia Security Anik.jpg):
 * a geometric monoline sans in caps, the E drawn as three bars with no spine, and the A in SEQUOIA drawn as a
 * crossbar-less Λ. Cap height 100 units; strokes are centrelines clipped flat at baseline and cap height.
 */

const SW = 17; // stroke weight
const H = SW / 2;

type Glyph = { w: number; d?: string; rects?: [number, number, number, number][] };

const ell = (cx: number, cy: number, rx: number, ry: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return `${(cx + rx * Math.cos(a)).toFixed(2)} ${(cy + ry * Math.sin(a)).toFixed(2)}`;
};

const S: Glyph = (() => {
  // two stacked bowls; the lower one a touch larger for optical balance
  const cx = 37;
  const t = { rx: 27.6, ry: 20.2, cy: H + 20.2 };
  const b = { rx: 28.6, ry: 21.3, cy: 100 - H - 21.3 };
  const mid = `${cx} ${(t.cy + t.ry).toFixed(2)}`;
  return {
    w: 74,
    d: `M${ell(cx, t.cy, t.rx, t.ry, -30)} A${t.rx} ${t.ry} 0 1 0 ${mid} A${b.rx} ${b.ry} 0 1 1 ${ell(cx, b.cy, b.rx, b.ry, 150)}`,
  };
})();

const E: Glyph = { w: 60, rects: [[0, 0, 60, SW], [0, 50 - SW / 2, 60, SW], [0, 100 - SW, 60, SW]] };
const O: Glyph = { w: 100, d: `M50 ${H} A${50 - H} ${50 - H} 0 1 1 49.99 ${H}Z` };
const Q: Glyph = { w: 100, d: `${O.d} M63 64 L95 104` };
const U: Glyph = { w: 82, d: `M${H} -4 V59 A32.5 32.5 0 0 0 ${82 - H} 59 V-4` };
const I: Glyph = { w: SW, d: `M${H} -4 V104` };
const LAMBDA: Glyph = { w: 92, d: "M7.62 104 L46 0 L84.38 104" };
const C: Glyph = { w: 88, d: `M${ell(50, 50, 50 - H, 50 - H, -44)} A${50 - H} ${50 - H} 0 1 0 ${ell(50, 50, 50 - H, 50 - H, 44)}` };
const R: Glyph = { w: 78, d: `M${H} -4 V104 M${H} ${H} H44 A20.75 20.75 0 0 1 44 50 H${H} M40 50 L70 104` };
const T: Glyph = { w: 74, rects: [[0, 0, 74, SW]], d: "M37 -4 V104" };
const Y: Glyph = { w: 88, d: "M7.6 -4 L44 54 L80.4 -4 M44 54 V104" };

const WORD: (Glyph | null)[] = [S, E, Q, U, O, I, LAMBDA, null, S, E, C, U, R, I, T, Y];
const TRACK = 25;
const SPACE = 44;

const LAYOUT = (() => {
  let x = 0;
  const items: { g: Glyph; x: number }[] = [];
  WORD.forEach((g, i) => {
    if (!g) {
      x += SPACE;
      return;
    }
    items.push({ g, x });
    x += g.w + (i < WORD.length - 1 ? TRACK : 0);
  });
  return { items, width: Math.ceil(x) };
})();

export const LOGO_ASPECT = LAYOUT.width / 100;

export function Wordmark({ className, title = "Sequoia Security" }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      className={className}
      viewBox={`0 0 ${LAYOUT.width} 100`}
      role="img"
      aria-label={title}
      focusable="false"
      preserveAspectRatio="xMinYMid meet"
    >
      <defs>
        <clipPath id={`cap-${id}`}>
          <rect x="-2" y="0" width={LAYOUT.width + 4} height="100" />
        </clipPath>
      </defs>
      <g clipPath={`url(#cap-${id})`}>
        {LAYOUT.items.map(({ g, x }, i) => (
          <g key={i} transform={`translate(${x} 0)`} style={{ ["--i" as string]: i } as React.CSSProperties}>
            {g.rects?.map(([rx, ry, rw, rh], k) => <rect key={k} x={rx} y={ry} width={rw} height={rh} fill="currentColor" />)}
            {g.d && (
              <path
                d={g.d}
                pathLength={1}
                fill="none"
                stroke="currentColor"
                strokeWidth={SW}
                strokeLinecap="butt"
                strokeLinejoin="miter"
                strokeMiterlimit={12}
              />
            )}
          </g>
        ))}
      </g>
    </svg>
  );
}

export function Logo({ descriptor = true, className = "" }: { descriptor?: boolean; className?: string }) {
  return (
    <span className={`logo ${className}`}>
      <Wordmark className="logo__mark" />
      {descriptor && (
        <span className="logo__desc mono" aria-hidden="true">
          Wildfire monitoring &amp; fire watch
        </span>
      )}
    </span>
  );
}
