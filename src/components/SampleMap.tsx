import { memo, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from "react";
import type { LayerId } from "../data/copy";
import { buildGrid, contourPaths, damAxes, hillshadeURL } from "../lib/terrain";
import { rectPts } from "../lib/tableRender";
import { gridLabel, useZone, type Pt, type Zone } from "../lib/zone";
import "../styles/map.css";

/**
 * The 2D sample map of the fictional watch zone (SAMPLE data). Geometry comes from public/table/js/zone.js so it
 * matches the 3D table. Layers are the brief's six; `time` picks one of the three sample perimeters.
 */

export type Layers = Record<LayerId, boolean>;
export const ALL_LAYERS: Layers = { hotspots: true, affected: true, infra: true, patrol: true, change: true, escalation: true };

type Crop = "full" | "focus";
const VIEW: Record<Crop, [number, number, number, number]> = {
  full: [-800, -500, 1600, 1000],
  focus: [-440, -500, 1240, 930],
};

const d = (pts: Pt[], close = false) => "M" + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L") + (close ? "Z" : "");

const RAMP = ["#a2195b", "#e8452c", "#ff9e1b"]; // the three sample times, cooler to hotter (ironbow)

function useHillshade(zone: Zone | null, mode: "visible" | "thermal", enabled: boolean): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!zone || !enabled) return;
    let live = true;
    // after paint: building the image is ~50ms of CPU
    const t = window.setTimeout(() => {
      hillshadeURL(zone, mode).then((u) => live && setUrl(u));
    }, 30);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [zone, mode, enabled]);
  return url;
}

export interface MapLabel {
  x: number;
  z: number;
  text: string;
  layer: LayerId | "base";
  tone?: "heat" | "ember" | "bone";
  side?: "r" | "l" | "t" | "b";
}

export const SampleMap = memo(function SampleMap({
  layers,
  time = 2,
  thermal = false,
  crop = "full",
  labels = true,
  interactive = false,
  className = "",
  title = "Sample wildfire map of a fictional watch zone",
}: {
  layers: Layers;
  time?: number;
  thermal?: boolean;
  crop?: Crop;
  labels?: boolean;
  interactive?: boolean;
  className?: string;
  title?: string;
}) {
  const zone = useZone();
  const uid = useId().replace(/:/g, "");
  const visURL = useHillshade(zone, "visible", true);
  const thURL = useHillshade(zone, "thermal", thermal);
  const [vx, vz, vw, vh] = VIEW[crop];
  const boxRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<{ x: number; z: number } | null>(null);

  const geo = useMemo(() => {
    if (!zone) return null;
    const g = buildGrid(zone, 10);
    const levels: number[] = [];
    for (let L = 20; L < 340; L += 20) levels.push(L);
    const contours = contourPaths(g, levels);
    const { crest, flow } = damAxes(zone);
    const half = zone.dam.crest / 2;
    const dam: Pt[] = [
      [zone.dam.x + crest[0] * half, zone.dam.z + crest[1] * half],
      [zone.dam.x - crest[0] * half, zone.dam.z - crest[1] * half],
    ];
    const ph = rectPts(zone.powerhouse.x, zone.powerhouse.z, zone.powerhouse.w, zone.powerhouse.d, crest);
    const sw = rectPts(zone.switchyard.x, zone.switchyard.z, zone.switchyard.w, zone.switchyard.d, [1, 0]);
    const ss = zone.substation;
    const sub = rectPts(ss.x, ss.z, ss.w, ss.d, [Math.cos(ss.rot), Math.sin(ss.rot)]);
    const cps = zone.checkpoints.map((c) => ({ p: zone.patrol[c.i], t: c.t }));
    return { contours, dam, ph, sw, sub, cps, flow };
  }, [zone]);

  const lbls: MapLabel[] = useMemo(() => {
    if (!zone) return [];
    const hs = zone.hotspot;
    const tw = zone.towers;
    return [
      { x: zone.dam.x - 70, z: zone.dam.z + 30, text: "Dam", layer: "infra", side: "l" },
      { x: zone.powerhouse.x + 22, z: zone.powerhouse.z + 26, text: "Powerhouse", layer: "infra", side: "r" },
      { x: zone.substation.x, z: zone.substation.z + 52, text: "Substation", layer: "infra", side: "b" },
      { x: tw[1][0], z: tw[1][1] - 18, text: "Transmission line", layer: "infra", side: "t" },
      { x: hs.x - 44, z: hs.z - 10, text: `${hs.peakC} °C`, layer: "hotspots", tone: "heat", side: "l" },
      { x: zone.escalation[3][0] - 20, z: zone.escalation[3][1] + 22, text: "Escalation", layer: "escalation", tone: "heat", side: "b" },
      { x: zone.truckStart.x - 14, z: zone.truckStart.z + 10, text: "Patrol", layer: "patrol", tone: "ember", side: "l" },
      { x: -620, z: -330, text: "Reservoir", layer: "base", side: "r" },
    ] as MapLabel[];
  }, [zone]);

  const pct = (x: number, z: number): CSSProperties => ({
    left: `${(((x - vx) / vw) * 100).toFixed(3)}%`,
    top: `${(((z - vz) / vh) * 100).toFixed(3)}%`,
  });

  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCursor({ x: vx + ((e.clientX - r.left) / r.width) * vw, z: vz + ((e.clientY - r.top) / r.height) * vh });
  };

  const on = (l: LayerId) => (layers[l] ? "1" : "0");
  const t = Math.max(0, Math.min(2, Math.round(time)));

  return (
    <div
      ref={boxRef}
      className={`smap ${className}`}
      style={{ "--map-ratio": `${vw} / ${vh}` } as CSSProperties}
      data-thermal={thermal ? "" : undefined}
      onPointerMove={interactive ? onMove : undefined}
      onPointerLeave={interactive ? () => setCursor(null) : undefined}
    >
      {zone && geo ? (
        <svg className="smap__svg" viewBox={`${vx} ${vz} ${vw} ${vh}`} role="img" aria-label={title} preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id={`hatch-${uid}`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M0 0 V14" stroke="#e8452c" strokeWidth="3" opacity="0.85" />
            </pattern>
            <radialGradient id={`hot-${uid}`}>
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.22" stopColor="#ffe6a0" />
              <stop offset="0.5" stopColor="#ff9e1b" stopOpacity="0.75" />
              <stop offset="1" stopColor="#e8452c" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* base: hillshade + contours + water + roads + faint infrastructure */}
          <rect x={-800} y={-500} width={1600} height={1000} fill="#171615" />
          {visURL && <image href={visURL} x={-800} y={-500} width={1600} height={1000} preserveAspectRatio="none" className="smap__img" />}
          {thURL && <image href={thURL} x={-800} y={-500} width={1600} height={1000} preserveAspectRatio="none" className="smap__img smap__img--th" />}
          <g className="smap__grid" aria-hidden="true">
            {Array.from({ length: 15 }, (_, i) => -700 + i * 100).map((x) => (
              <path key={`x${x}`} d={`M${x} -500 V500`} />
            ))}
            {Array.from({ length: 9 }, (_, i) => -400 + i * 100).map((z) => (
              <path key={`z${z}`} d={`M-800 ${z} H800`} />
            ))}
          </g>
          <g className="smap__contours" aria-hidden="true">
            {geo.contours.map((c) => (
              <path key={c.level} d={c.d} className={c.level % 100 === 0 ? "is-index" : undefined} />
            ))}
          </g>
          <path d={d(zone.river)} className="smap__river" />
          <path d={d(zone.reservoir, true)} className="smap__water" />
          <g className="smap__road">
            <path d={d(zone.road)} />
            <path d={d(zone.roadBranch)} />
          </g>
          <g className="smap__road smap__road--in">
            <path d={d(zone.road)} />
            <path d={d(zone.roadBranch)} />
          </g>
          <g className="smap__base-infra">
            <path d={d(zone.towers)} />
            <path d={d(geo.dam)} className="smap__dam" />
            <path d={d(geo.sub, true)} />
            <path d={d(geo.ph, true)} />
          </g>

          {/* 3 critical infrastructure */}
          <g className="smap__layer" style={{ opacity: on("infra") }} data-layer="infra">
            <path d={d(zone.towers)} className="smap__line" />
            {zone.towers.map(([x, z], i) => (
              <rect key={i} x={x - 6} y={z - 6} width="12" height="12" className="smap__tower" />
            ))}
            <path d={d(geo.dam)} className="smap__dam smap__dam--on" />
            <path d={d(geo.ph, true)} className="smap__box" />
            <path d={d(geo.sw, true)} className="smap__box" />
            <path d={d(geo.sub, true)} className="smap__box smap__box--sub" />
          </g>

          {/* 6 escalation areas */}
          <g className="smap__layer" style={{ opacity: on("escalation") }} data-layer="escalation">
            <path d={d(zone.escalation, true)} fill={`url(#hatch-${uid})`} className="smap__esc" />
          </g>

          {/* 5 change over time: isochrones up to the selected time */}
          <g className="smap__layer" style={{ opacity: on("change") }} data-layer="change">
            {zone.perimeters.map((p, i) => (
              <path
                key={p.t}
                d={d(p.pts, true)}
                className="smap__iso"
                stroke={RAMP[i]}
                style={{ opacity: i <= t ? 1 : 0.0 }}
              />
            ))}
          </g>

          {/* 2 estimated affected area at the selected time */}
          <g className="smap__layer" style={{ opacity: on("affected") }} data-layer="affected">
            <path d={d(zone.perimeters[t].pts, true)} className="smap__area" />
          </g>

          {/* 4 patrol + drone observation locations */}
          <g className="smap__layer" style={{ opacity: on("patrol") }} data-layer="patrol">
            <path d={d(zone.flight)} className="smap__flight" />
            <path d={d(zone.patrol)} className="smap__patrol" />
            {geo.cps.map((c, i) => (
              <rect key={i} x={c.p[0] - 7} y={c.p[1] - 7} width="14" height="14" className="smap__cp" />
            ))}
            {zone.observations.map(([x, z], i) => (
              <g key={i} className="smap__obs">
                <circle cx={x} cy={z} r="9" />
                <path d={`M${x - 16} ${z} H${x - 11} M${x + 11} ${z} H${x + 16} M${x} ${z - 16} V${z - 11} M${x} ${z + 11} V${z + 16}`} />
              </g>
            ))}
            <circle cx={zone.truckStart.x} cy={zone.truckStart.z} r="8" className="smap__truck" />
          </g>

          {/* 1 hotspots / thermal anomalies */}
          <g className="smap__layer" style={{ opacity: on("hotspots") }} data-layer="hotspots">
            <circle cx={zone.hotspot.x} cy={zone.hotspot.z} r="46" fill={`url(#hot-${uid})`} />
            <circle cx={zone.hotspot.x} cy={zone.hotspot.z} r="30" className="smap__ring smap__ring--a" />
            <circle cx={zone.hotspot.x} cy={zone.hotspot.z} r="30" className="smap__ring smap__ring--b" />
          </g>
        </svg>
      ) : (
        <div className="smap__loading mono mono--s smoke" aria-hidden="true">
          Loading sample map
        </div>
      )}

      {zone && geo && labels && (
        <div className="smap__labels" aria-hidden="true">
          {lbls.map((l) => (
            <span
              key={l.text}
              className={`smap__lbl mono mono--s smap__lbl--${l.side ?? "r"} ${l.tone ? `is-${l.tone}` : ""}`}
              style={{ ...pct(l.x, l.z), opacity: l.layer === "base" || layers[l.layer as LayerId] ? 1 : 0 }}
            >
              {l.text}
            </span>
          ))}
          {geo.cps
            // checkpoints at the substation fence would crowd its label; their squares still show
            .filter((c) => Math.hypot(c.p[0] - zone.substation.x, c.p[1] - zone.substation.z) > 150)
            .map((c, i) => (
              <span
                key={`cp${i}`}
                className="smap__lbl smap__lbl--cp mono mono--s is-ember"
                style={{ ...pct(c.p[0], c.p[1]), opacity: layers.patrol ? 1 : 0 }}
              >
                {c.t}
              </span>
            ))}
          {(() => {
            // one time tag, on the east edge of the selected perimeter
            const pts = zone.perimeters[t].pts;
            const east = pts.reduce((a, b) => (b[0] > a[0] ? b : a), pts[0]);
            return (
              <span
                className="smap__lbl smap__lbl--iso mono mono--s is-heat"
                style={{ ...pct(east[0] + 8, east[1]), opacity: layers.affected || layers.change ? 1 : 0 }}
              >
                {zone.perimeters[t].t}
              </span>
            );
          })()}
        </div>
      )}

      {interactive && cursor && (
        <div className="smap__cursor" aria-hidden="true">
          <i className="smap__cx" style={{ left: pct(cursor.x, cursor.z).left as string }} />
          <i className="smap__cy" style={{ top: pct(cursor.x, cursor.z).top as string }} />
        </div>
      )}
      {interactive && (
        <p className="smap__readout mono mono--s" aria-hidden="true">
          {cursor ? (
            <>
              E {gridLabel(cursor.x, cursor.z).e} &nbsp;N {gridLabel(cursor.x, cursor.z).n}
            </>
          ) : (
            "Local grid · metres"
          )}
        </p>
      )}
    </div>
  );
});
