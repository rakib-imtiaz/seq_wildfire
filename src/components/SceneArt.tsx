import { memo, useId } from "react";
import { fbm } from "../lib/terrain";

/**
 * Generated placeholder art for photo slots: layered BC ridgelines with conifer saw-tooth tops and one subject
 * per slot. `mode="thermal"` redraws the identical geometry in the ironbow ramp, so a visible/thermal pair lines
 * up exactly under the lens. Replaced by real photography via src/data/media.ts.
 */

export type SceneKind =
  | "ridge-guard"
  | "ridge-drone"
  | "pilot"
  | "controller"
  | "patrol"
  | "canopy"
  | "live-feed"
  | "preflight"
  | "cta"
  | "proposal"
  | "hydro"
  | "transmission"
  | "remote-utility"
  | "industrial"
  | "forestry";

type Mode = "visible" | "thermal";

const PAL = {
  visible: {
    sky0: "#121110",
    sky1: "#2a221d",
    glow: "rgba(255,150,92,0.16)",
    far: "#25211e",
    mid: "#1b1917",
    near: "#121110",
    ground: "#191715",
    struct: "#34302b",
    structHi: "rgba(236,231,224,0.28)",
    detail: "rgba(236,231,224,0.18)",
    warm: "#3d342c",
  },
  thermal: {
    sky0: "#14002e",
    sky1: "#22053f",
    glow: "rgba(74,12,106,0.0)",
    far: "#3b0a5f",
    mid: "#4a0c6a",
    near: "#2a0650",
    ground: "#7a1462",
    struct: "#b8224f",
    structHi: "rgba(255,158,27,0.6)",
    detail: "rgba(232,69,44,0.55)",
    warm: "#e8452c",
  },
};

function hash(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function ridge(seed: number, W: number, H: number, base: number, amp: number, freq: number, tree = 0, steps = 120): string {
  const pts: string[] = [];
  for (let k = 0; k <= steps; k++) {
    const x = -4 + ((W + 8) * k) / steps;
    let y = H * base - H * amp * (fbm((x / W) * freq + seed, seed * 0.37, 4, seed | 0) - 0.42) * 2;
    if (tree) y -= k % 2 ? tree * H * (0.55 + 0.9 * hash(seed * 31 + k)) : 0;
    pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return `M-4 ${H + 4} L${pts.join(" L")} L${W + 4} ${H + 4}Z`;
}

function ridgeLine(seed: number, W: number, H: number, base: number, amp: number, freq: number, steps = 90): string {
  const pts: string[] = [];
  for (let k = 0; k <= steps; k++) {
    const x = -4 + ((W + 8) * k) / steps;
    const y = H * base - H * amp * (fbm((x / W) * freq + seed, seed * 0.37, 4, seed | 0) - 0.42) * 2;
    pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
}

function ridgeY(seed: number, W: number, H: number, base: number, amp: number, freq: number, x: number) {
  return H * base - H * amp * (fbm((x / W) * freq + seed, seed * 0.37, 4, seed | 0) - 0.42) * 2;
}

function Tower({ x, y, s, c }: { x: number; y: number; s: number; c: string }) {
  const h = 120 * s;
  const w = 26 * s;
  return (
    <g fill="none" stroke={c} strokeWidth={1.4 * s} strokeLinejoin="round">
      <path d={`M${x - w / 2} ${y} L${x - w / 6} ${y - h} L${x + w / 6} ${y - h} L${x + w / 2} ${y}`} />
      <path d={`M${x - w / 2} ${y} L${x + w / 4} ${y - h * 0.4} M${x + w / 2} ${y} L${x - w / 4} ${y - h * 0.4} M${x - w / 3.2} ${y - h * 0.4} L${x + w / 4.5} ${y - h * 0.75} M${x + w / 3.2} ${y - h * 0.4} L${x - w / 4.5} ${y - h * 0.75}`} opacity="0.75" />
      <path d={`M${x - w * 1.25} ${y - h * 0.86} H${x + w * 1.25} M${x - w * 0.6} ${y - h * 0.86} L${x} ${y - h * 1.08} L${x + w * 0.6} ${y - h * 0.86}`} />
    </g>
  );
}

function Drone({ x, y, s, c }: { x: number; y: number; s: number; c: string }) {
  return (
    <g fill={c} stroke={c} strokeWidth={1.2 * s}>
      <rect x={x - 7 * s} y={y - 3 * s} width={14 * s} height={6 * s} />
      <path d={`M${x - 6 * s} ${y} L${x - 18 * s} ${y - 3 * s} M${x + 6 * s} ${y} L${x + 18 * s} ${y - 3 * s}`} fill="none" />
      <ellipse cx={x - 19 * s} cy={y - 4.5 * s} rx={9 * s} ry={1.4 * s} opacity="0.55" stroke="none" />
      <ellipse cx={x + 19 * s} cy={y - 4.5 * s} rx={9 * s} ry={1.4 * s} opacity="0.55" stroke="none" />
    </g>
  );
}

function Hot({ x, y, r, id }: { x: number; y: number; r: number; id: string }) {
  return <circle cx={x} cy={y} r={r} fill={`url(#hot-${id})`} />;
}

export const SceneArt = memo(function SceneArt({
  kind,
  mode = "visible",
  ratio = [3, 2],
  seed = 3,
  className = "",
}: {
  kind: SceneKind;
  mode?: Mode;
  ratio?: [number, number];
  seed?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const P = PAL[mode];
  const T = mode === "thermal";
  const W = 1000;
  const H = Math.round((1000 * ratio[1]) / ratio[0]);
  const tall = H > W;

  // shared skyline
  const far = ridge(seed + 0.3, W, H, tall ? 0.5 : 0.56, 0.12, 2.2, 0.006, 160);
  const mid = ridge(seed + 4.1, W, H, tall ? 0.62 : 0.68, 0.14, 1.6, 0.012, 140);
  const near = ridge(seed + 9.7, W, H, tall ? 0.8 : 0.86, 0.12, 1.3, 0.02, 110);
  const sunX = W * (0.18 + 0.1 * hash(seed));
  const horizon = H * (tall ? 0.48 : 0.54);

  const subject = (() => {
    switch (kind) {
      case "hydro": {
        const y0 = H * (tall ? 0.6 : 0.66);
        const cx = W * 0.56;
        return (
          <g>
            <path d={`M0 ${y0 - 6} H${W}`} stroke={T ? "#14002e" : "rgba(236,231,224,0.12)"} strokeWidth="2" />
            <rect x="0" y={y0 - 4} width={W} height={H * 0.07} fill={T ? "#1c0338" : "#161514"} />
            <path d={`M${cx - 230} ${y0} L${cx + 230} ${y0} L${cx + 190} ${y0 + H * 0.16} L${cx - 190} ${y0 + H * 0.16}Z`} fill={P.struct} />
            <path d={`M${cx - 230} ${y0} H${cx + 230}`} stroke={P.structHi} strokeWidth="3" />
            {[-120, -40, 40, 120].map((o) => (
              <path key={o} d={`M${cx + o} ${y0 + 4} V${y0 + H * 0.15}`} stroke={P.detail} strokeWidth="6" />
            ))}
            <rect x={cx - 80} y={y0 + H * 0.16} width="160" height={H * 0.06} fill={T ? "#e8452c" : "#2c2824"} />
          </g>
        );
      }
      case "transmission":
      case "patrol": {
        const yb = (x: number) => ridgeY(seed + 9.7, W, H, tall ? 0.8 : 0.86, 0.12, 1.3, x) + 4;
        const xs = kind === "patrol" ? [W * 0.68] : [W * 0.2, W * 0.52, W * 0.84];
        const s = kind === "patrol" ? 2 : tall ? 1.6 : 1.3;
        return (
          <g>
            {xs.map((x, i) => (
              <Tower key={i} x={x} y={yb(x)} s={s} c={T ? "#a2195b" : "rgba(236,231,224,0.42)"} />
            ))}
            {xs.length > 1 &&
              [-1, 1].map((side) => (
                <path
                  key={side}
                  d={xs
                    .slice(0, -1)
                    .map((x, i) => {
                      const x2 = xs[i + 1];
                      const y1 = yb(x) - 120 * s * 0.86;
                      const y2 = yb(x2) - 120 * s * 0.86;
                      const off = side * 32 * s;
                      return `M${x + off} ${y1} Q${(x + x2) / 2 + off} ${(y1 + y2) / 2 + 40} ${x2 + off} ${y2}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke={T ? "rgba(162,25,91,0.8)" : "rgba(236,231,224,0.22)"}
                  strokeWidth="1.2"
                />
              ))}
            {kind === "transmission" && (
              <g fill="none" stroke={T ? "#ff9e1b" : "rgba(236,231,224,0.3)"} strokeWidth="1.5">
                <rect x={W * 0.64} y={H * 0.86} width={W * 0.26} height={H * 0.06} />
                <path d={`M${W * 0.68} ${H * 0.86} V${H * 0.92} M${W * 0.74} ${H * 0.86} V${H * 0.92} M${W * 0.8} ${H * 0.86} V${H * 0.92} M${W * 0.86} ${H * 0.86} V${H * 0.92}`} opacity="0.6" />
              </g>
            )}
            {kind === "patrol" && (
              <g>
                <path d={`M${W * 0.08} ${H} Q${W * 0.36} ${H * 0.9} ${W * 0.6} ${H * 0.86} T${W} ${H * 0.82}`} fill="none" stroke={T ? "#a2195b" : "rgba(236,231,224,0.2)"} strokeWidth="10" />
                <circle cx={W * 0.84} cy={H * 0.83} r="4" fill={T ? "#ffe6a0" : "#ff6a1f"} />
              </g>
            )}
          </g>
        );
      }
      case "remote-utility":
        return (
          <g>
            <path d={`M0 ${H * 0.86} H${W}`} stroke={P.detail} />
            <rect x={W * 0.3} y={H * 0.74} width={W * 0.3} height={H * 0.1} fill={P.struct} />
            <path d={`M${W * 0.3} ${H * 0.74} H${W * 0.6}`} stroke={P.structHi} strokeWidth="2" />
            <rect x={W * 0.64} y={H * 0.785} width={W * 0.08} height={H * 0.055} fill={T ? "#ff9e1b" : "#2c2824"} />
            {[0.12, 0.2, 0.8, 0.88].map((x) => (
              <ellipse key={x} cx={W * x} cy={H * 0.86} rx={W * 0.05} ry={H * 0.03} fill={T ? "#5a0f66" : "#211e1b"} />
            ))}
          </g>
        );
      case "industrial":
        return (
          <g>
            <path d={`M${W * 0.46} ${H * 0.84} V${H * 0.66} L${W * 0.6} ${H * 0.58} L${W * 0.74} ${H * 0.66} V${H * 0.84}Z`} fill={P.struct} />
            <path d={`M${W * 0.46} ${H * 0.66} L${W * 0.6} ${H * 0.58} L${W * 0.74} ${H * 0.66}`} fill="none" stroke={P.structHi} strokeWidth="2" />
            <rect x={W * 0.77} y={H * 0.5} width={W * 0.025} height={H * 0.34} fill={T ? "#e8452c" : "#2c2824"} />
            {Array.from({ length: 14 }, (_, i) => (
              <circle key={i} cx={W * (0.1 + (i % 7) * 0.045)} cy={H * (0.83 - Math.floor(i / 7) * 0.035)} r={W * 0.02} fill={T ? "#7a1462" : "#24201d"} stroke={P.detail} />
            ))}
          </g>
        );
      case "forestry":
        return (
          <g>
            <path d={`M${W * 0.5} ${H} L${W * 0.5} ${H * 0.7} L${W} ${H * 0.66} V${H}Z`} fill={P.ground} />
            <path d={`M${W * 0.5} ${H * 0.98} Q${W * 0.72} ${H * 0.86} ${W} ${H * 0.84}`} fill="none" stroke={T ? "#a2195b" : "rgba(236,231,224,0.2)"} strokeWidth="9" />
            <g fill={P.struct}>
              <rect x={W * 0.7} y={H * 0.79} width={W * 0.09} height={H * 0.04} />
              <path d={`M${W * 0.75} ${H * 0.79} L${W * 0.8} ${H * 0.7} L${W * 0.86} ${H * 0.73}`} fill="none" stroke={T ? "#e8452c" : "rgba(236,231,224,0.35)"} strokeWidth="4" />
            </g>
          </g>
        );
      case "ridge-drone":
        return <Drone x={W * 0.62} y={H * 0.36} s={1.6} c={T ? "#ff9e1b" : "rgba(236,231,224,0.7)"} />;
      default:
        return null;
    }
  })();

  // hotspot location (thermal) / smoke wisp (visible)
  const hot = (() => {
    switch (kind) {
      case "hydro": return [W * 0.22, H * (tall ? 0.56 : 0.6)];
      case "transmission": return [W * 0.38, H * (tall ? 0.7 : 0.76)];
      case "remote-utility": return [W * 0.16, H * 0.82];
      case "industrial": return [W * 0.3, H * 0.62];
      case "forestry": return [W * 0.28, H * 0.74];
      case "canopy": return [W * 0.56, H * 0.46];
      case "ridge-guard":
      case "ridge-drone":
      case "cta": return [W * 0.78, H * (tall ? 0.48 : 0.55)];
      default: return null;
    }
  })();

  if (kind === "canopy") {
    // straight-down conifer canopy: jittered crowns around a small clearing; thermal redraws the same crowns cool
    const cx = W * 0.56;
    const cy = H * 0.46;
    const crowns: { x: number; y: number; r: number; o: number }[] = [];
    const step = 44;
    for (let gy = -step; gy < H + step; gy += step * 0.86) {
      for (let gx = -step; gx < W + step; gx += step) {
        const k = gx * 7.31 + gy * 3.17 + seed;
        const x = gx + (hash(k) - 0.5) * 30 + ((gy / step) % 2 ? step / 2 : 0);
        const y = gy + (hash(k + 1.7) - 0.5) * 26;
        const dx = (x - cx) / (W * 0.15);
        const dy = (y - cy) / (H * 0.12);
        if (dx * dx + dy * dy < 1 + hash(k + 3.3) * 0.5) continue;
        crowns.push({ x, y, r: 15 + hash(k + 5.1) * 16, o: 0.62 + hash(k + 8.9) * 0.38 });
      }
    }
    crowns.sort((a, b) => a.y - b.y);
    return (
      <svg className={`scene ${className}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id={`crown-${uid}`} cx="0.42" cy="0.38" r="0.62">
            <stop offset="0" stopColor={T ? "#5c1068" : "#3b3630"} />
            <stop offset="0.55" stopColor={T ? "#3b0a5f" : "#24211d"} />
            <stop offset="1" stopColor={T ? "#1c0338" : "#121110"} />
          </radialGradient>
          <radialGradient id={`clear-${uid}`}>
            <stop offset="0" stopColor={T ? "#e8452c" : "#4d443a"} />
            <stop offset="0.6" stopColor={T ? "#a2195b" : "#2f2923"} />
            <stop offset="1" stopColor={T ? "#4a0c6a" : "#1a1714"} />
          </radialGradient>
          <radialGradient id={`hot-${uid}`}>
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.25" stopColor="#ffe6a0" />
            <stop offset="0.55" stopColor="#ff9e1b" stopOpacity="0.8" />
            <stop offset="1" stopColor="#e8452c" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`wisp-${uid}`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#8c8781" stopOpacity="0.45" />
            <stop offset="1" stopColor="#8c8781" stopOpacity="0" />
          </linearGradient>
          <filter id={`soft-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>
        <rect width={W} height={H} fill={T ? "#2a0650" : "#151412"} />
        <ellipse cx={cx} cy={cy} rx={W * 0.2} ry={H * 0.17} fill={`url(#clear-${uid})`} />
        {crowns.map((c, i) => (
          <circle key={i} cx={c.x.toFixed(1)} cy={c.y.toFixed(1)} r={c.r.toFixed(1)} fill={`url(#crown-${uid})`} opacity={c.o.toFixed(2)} />
        ))}
        {T && hot && <Hot x={hot[0]} y={hot[1]} r={64} id={uid} />}
        {!T && (
          <g>
            <circle cx={cx} cy={cy} r="10" fill="#2a2420" stroke="rgba(236,231,224,0.35)" strokeWidth="1.5" />
            <path
              d={`M${cx} ${cy} C${cx + 40} ${cy - 30} ${cx + 60} ${cy - 120} ${cx + 160} ${cy - 200} L${cx + 210} ${cy - 170} C${cx + 110} ${cy - 110} ${cx + 70} ${cy - 30} ${cx + 12} ${cy + 4}Z`}
              fill={`url(#wisp-${uid})`}
              filter={`url(#soft-${uid})`}
            />
          </g>
        )}
      </svg>
    );
  }

  return (
    <svg className={`scene ${className}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.sky0} />
          <stop offset="1" stopColor={P.sky1} />
        </linearGradient>
        <radialGradient id={`glow-${uid}`} cx={sunX / W} cy={horizon / H} r="0.6" gradientTransform={`translate(${sunX / W} ${horizon / H}) scale(1 ${W / H * 0.35}) translate(${-sunX / W} ${-horizon / H})`}>
          <stop offset="0" stopColor={P.glow} />
          <stop offset="1" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <radialGradient id={`hot-${uid}`}>
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.2" stopColor="#ffe6a0" />
          <stop offset="0.5" stopColor="#ff9e1b" stopOpacity="0.85" />
          <stop offset="1" stopColor="#e8452c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`smoke-${uid}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#8c8781" stopOpacity="0.42" />
          <stop offset="0.6" stopColor="#8c8781" stopOpacity="0.16" />
          <stop offset="1" stopColor="#8c8781" stopOpacity="0" />
        </linearGradient>
        <filter id={`soft-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>
      <rect width={W} height={H} fill={`url(#sky-${uid})`} />
      {!T && <rect width={W} height={H} fill={`url(#glow-${uid})`} />}
      {kind === "proposal" || kind === "preflight" ? (
        <g>
          <rect width={W} height={H} fill={T ? "#14002e" : "#121110"} />
          {/* a printed topographic sheet on the table, lit by one warm lamp */}
          <g transform={`rotate(${kind === "proposal" ? -4 : 3} ${W / 2} ${H / 2})`}>
            <rect x={W * 0.12} y={H * 0.1} width={W * 0.62} height={H * 0.86} fill="#1c1a17" stroke="rgba(236,231,224,0.12)" />
            {Array.from({ length: 22 }, (_, i) => (
              <path
                key={i}
                d={ridgeLine(seed + i * 0.11, W, H, 0.14 + i * 0.038, 0.06, 1.4)}
                fill="none"
                stroke={i % 5 === 0 ? "rgba(236,231,224,0.2)" : "rgba(236,231,224,0.1)"}
                strokeWidth={i % 5 === 0 ? 1.6 : 1}
                clipPath={`url(#sheet-${uid})`}
              />
            ))}
          </g>
          <clipPath id={`sheet-${uid}`}>
            <rect x={W * 0.12} y={H * 0.1} width={W * 0.62} height={H * 0.86} />
          </clipPath>
          <rect x={W * (kind === "proposal" ? 0.7 : 0.66)} y={H * 0.3} width={W * 0.14} height={H * 0.42} fill="#0d0c0b" stroke="rgba(236,231,224,0.14)" />
          <circle cx={W * (kind === "proposal" ? 0.8 : 0.24)} cy={H * 0.2} r={H * 0.8} fill="rgba(255,150,92,0.08)" filter={`url(#soft-${uid})`} />
        </g>
      ) : (
        <>
          {!T && hot && (kind === "ridge-guard" || kind === "ridge-drone" || kind === "cta") && (
            <path
              d={`M${hot[0] - 6} ${hot[1]} C${hot[0] - 14} ${hot[1] - 60} ${hot[0] + 10} ${hot[1] - 120} ${hot[0] + 46} ${hot[1] - 190} C${hot[0] + 80} ${hot[1] - 250} ${hot[0] + 150} ${hot[1] - 300} ${hot[0] + 250} ${hot[1] - 330} L${hot[0] + 300} ${hot[1] - 280} C${hot[0] + 190} ${hot[1] - 250} ${hot[0] + 110} ${hot[1] - 190} ${hot[0] + 70} ${hot[1] - 120} C${hot[0] + 40} ${hot[1] - 70} ${hot[0] + 18} ${hot[1] - 30} ${hot[0] + 8} ${hot[1]}Z`}
              fill={`url(#smoke-${uid})`}
              filter={`url(#soft-${uid})`}
              opacity="0.8"
            />
          )}
          <path d={far} fill={P.far} />
          <path d={mid} fill={P.mid} />
          {subject}
          <path d={near} fill={P.near} />
          {(kind === "ridge-guard" || kind === "ridge-drone") && (
            <path d={`M${-4} ${H} L${W * 0.06} ${H * 0.9} L${W * 0.3} ${H * 0.87} L${W * 0.44} ${H * 0.92} L${W * 0.5} ${H}Z`} fill={T ? "#7a1462" : "#0f0e0d"} />
          )}
          {T && hot && <Hot x={hot[0]} y={hot[1]} r={tall ? 70 : 54} id={uid} />}
        </>
      )}
    </svg>
  );
});
