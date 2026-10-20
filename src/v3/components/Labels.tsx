import { forwardRef, useImperativeHandle, useRef } from "react";
import type { FrameInfo, LabelPoint } from "../three/engine.js";
import { ASSET_LABELS, CANVAS_LABELS, LENS_LABELS, OBSERVATIONS } from "../data/copy";

/**
 * Labels on the 3D: small plates with a leader to a point the engine projects every frame (lens fronts, footprint
 * corners, the aircraft, the patrol, the flight path, the hotspot, the observation pins). The engine's beat windows
 * never overlap. Positions are written imperatively, never through React state.
 *
 * Two map symbols carry no plate: the observation pins, and the aircraft once it is too small to see (at the
 * model's 1:250 the M3T is 1.4 mm across): a cobalt position dot in a halo, as a flight app marks it.
 */
type Kind = "lens" | "fp" | "note" | "sample" | "obs" | "asset";
export interface LabelDef {
  id: string;
  text: string;
  sub?: string;
  kind: Kind;
  /** plate corner offset from the anchor, px: [dx, dy] per layout */
  off: { wide: [number, number]; tall: [number, number] };
  pin?: boolean;
}

export const LABEL_DEFS: LabelDef[] = [
  { id: "wide", text: LENS_LABELS.wide, kind: "lens", off: { wide: [70, -64], tall: [44, -50] } },
  { id: "tele", text: LENS_LABELS.tele, kind: "lens", off: { wide: [-78, 46], tall: [-46, 48] } },
  { id: "thermal", text: LENS_LABELS.thermal, kind: "lens", off: { wide: [76, 58], tall: [40, 66] } },
  { id: "fpWide", text: CANVAS_LABELS.fpWide, kind: "fp", off: { wide: [-14, -16], tall: [-10, -12] } },
  { id: "fpTele", text: CANVAS_LABELS.fpTele, kind: "fp", off: { wide: [20, 20], tall: [14, 16] } },
  { id: "fpThermal", text: CANVAS_LABELS.fpThermal, kind: "fp", off: { wide: [-14, 16], tall: [-10, 12] } },
  { id: "craft", text: CANVAS_LABELS.craft, sub: CANVAS_LABELS.craftSub, kind: "note", off: { wide: [30, -40], tall: [20, -32] } },
  { id: "patrol", text: CANVAS_LABELS.patrol, kind: "note", off: { wide: [-36, 44], tall: [-20, 34] } },
  { id: "flight", text: CANVAS_LABELS.flight, kind: "fp", off: { wide: [36, -42], tall: [22, -34] } },
  { id: "launch", text: CANVAS_LABELS.launch, kind: "asset", off: { wide: [36, 30], tall: [26, 26] } },
  { id: "hotspot", text: CANVAS_LABELS.hotspot, kind: "sample", off: { wide: [-40, 54], tall: [-26, 44] } },
  // the site's assets (the team beat looks from the east: the reservoir and dam at the top, the line down the right)
  { id: "aReservoir", text: ASSET_LABELS.aReservoir, kind: "asset", off: { wide: [34, -26], tall: [28, -22] } },
  { id: "aDam", text: ASSET_LABELS.aDam, kind: "asset", off: { wide: [-46, -22], tall: [-36, -20] } },
  { id: "aPowerhouse", text: ASSET_LABELS.aPowerhouse, kind: "asset", off: { wide: [-52, 26], tall: [-40, 24] } },
  { id: "aRoad", text: ASSET_LABELS.aRoad, kind: "asset", off: { wide: [-40, 30], tall: [-30, 26] } },
  { id: "aLine", text: ASSET_LABELS.aLine, kind: "asset", off: { wide: [-44, -30], tall: [-30, -26] } },
  { id: "aSubstation", text: ASSET_LABELS.aSubstation, kind: "asset", off: { wide: [-44, -34], tall: [-32, -28] } },
  ...OBSERVATIONS.map((o, i) => ({
    id: o.id,
    text: o.time,
    sub: o.grid,
    kind: "obs" as const,
    pin: true,
    off: { wide: ([[-34, -30], [34, -30], [34, 30]] as [number, number][])[i], tall: ([[-24, -26], [22, -26], [22, 26]] as [number, number][])[i] },
  })),
];
const PINS = ["pin0", "pin1", "pin2"];
const CRAFT = "craftPin";

/** the aircraft as a map symbol: a cobalt position dot in a soft halo */
function CraftGlyph() {
  return (
    <>
      <circle r={11} className="lab__craft-halo" />
      <circle r={5} className="lab__craft-dot" />
    </>
  );
}

export interface LabelLayer {
  update(f: FrameInfo, w: number, h: number): void;
}

/** where a plate goes: its anchoring corner, clamped inside the view (px) */
export function place(def: LabelDef, L: LabelPoint, layout: "wide" | "tall", w: number, h: number, pw: number, ph: number) {
  const [dx, dy] = def.off[layout];
  let ex = L.x + dx, ey = L.y + dy;
  // plate rectangle from its anchoring corner
  let x0 = dx >= 0 ? ex : ex - pw;
  let y0 = dy >= 0 ? ey : ey - ph;
  const m = 10;
  const top = 46; // the SAMPLE tag owns the top-left band of the view
  const cx = Math.min(Math.max(x0, m), Math.max(m, w - m - pw));
  const cy = Math.min(Math.max(y0, top), Math.max(top, h - m - ph));
  ex += cx - x0; ey += cy - y0;
  x0 = cx; y0 = cy;
  return { x0, y0, ex, ey };
}

export const Labels = forwardRef<LabelLayer>(function Labels(_, ref) {
  const root = useRef<HTMLDivElement>(null);
  const cache = useRef<Map<string, { plate: HTMLElement; line: SVGLineElement; ring: SVGCircleElement; w: number; h: number }>>(new Map());
  const pins = useRef<Map<string, SVGGElement>>(new Map());

  useImperativeHandle(ref, () => ({
    update(f, w, h) {
      const el = root.current;
      if (!el) return;
      if (!cache.current.size) {
        for (const d of LABEL_DEFS) {
          const plate = el.querySelector<HTMLElement>(`[data-l="${d.id}"]`);
          const line = el.querySelector<SVGLineElement>(`[data-ll="${d.id}"]`);
          const ring = el.querySelector<SVGCircleElement>(`[data-lr="${d.id}"]`);
          if (plate && line && ring) cache.current.set(d.id, { plate, line, ring, w: 0, h: 0 });
        }
        for (const p of [...PINS, CRAFT]) {
          const g = el.querySelector<SVGGElement>(`[data-pin="${p}"]`);
          if (g) pins.current.set(p, g);
        }
      }
      for (const d of LABEL_DEFS) {
        const c = cache.current.get(d.id);
        const L = f.labels[d.id];
        if (!c) continue;
        const a = L ? L.a : 0;
        if (a < 0.01) {
          if (c.plate.style.visibility !== "hidden") {
            c.plate.style.visibility = "hidden";
            c.line.style.visibility = "hidden";
            c.ring.style.visibility = "hidden";
          }
          continue;
        }
        if (!c.w) {
          c.plate.style.visibility = "hidden";
          c.w = c.plate.offsetWidth;
          c.h = c.plate.offsetHeight;
        }
        const p = place(d, L, f.layout, w, h, c.w, c.h);
        c.plate.style.visibility = c.line.style.visibility = c.ring.style.visibility = "visible";
        c.plate.style.opacity = String(a);
        c.plate.style.transform = `translate3d(${p.x0.toFixed(1)}px, ${p.y0.toFixed(1)}px, 0)`;
        c.line.setAttribute("x1", L.x.toFixed(1));
        c.line.setAttribute("y1", L.y.toFixed(1));
        c.line.setAttribute("x2", p.ex.toFixed(1));
        c.line.setAttribute("y2", p.ey.toFixed(1));
        c.line.style.opacity = String(a);
        c.ring.setAttribute("cx", L.x.toFixed(1));
        c.ring.setAttribute("cy", L.y.toFixed(1));
        c.ring.style.opacity = String(d.pin ? 0 : a);
      }
      for (const [id, g] of pins.current) {
        const L = f.labels[id];
        const a = L ? L.a : 0;
        g.style.visibility = a < 0.01 ? "hidden" : "visible";
        if (a >= 0.01) {
          g.setAttribute("transform", `translate(${L.x.toFixed(1)} ${L.y.toFixed(1)})`);
          g.style.opacity = String(a);
        }
      }
    },
  }));

  return (
    <div ref={root} className="lab" aria-hidden="true">
      <svg className="lab__svg">
        {LABEL_DEFS.map((d) => (
          <g key={d.id} className={`lab__k lab__k--${d.kind}`}>
            <line data-ll={d.id} style={{ visibility: "hidden" }} />
            <circle data-lr={d.id} r={3.5} style={{ visibility: "hidden" }} />
          </g>
        ))}
        {PINS.map((p) => (
          <g key={p} data-pin={p} className="lab__pin" style={{ visibility: "hidden" }}>
            <circle r={6.5} />
            <circle r={2.2} className="lab__pin-c" />
          </g>
        ))}
        <g data-pin={CRAFT} className="lab__craft" style={{ visibility: "hidden" }}>
          <CraftGlyph />
        </g>
      </svg>
      {LABEL_DEFS.map((d) => (
        <div key={d.id} data-l={d.id} className={`lab__p lab__p--${d.kind}`} style={{ visibility: "hidden" }}>
          {d.kind === "sample" ? (
            <>
              <span className="lab__tag">SAMPLE</span> {d.text.replace("SAMPLE ", "")}
            </>
          ) : (
            d.text
          )}
          {d.sub ? <span className="lab__sub">{d.sub}</span> : null}
        </div>
      ))}
    </div>
  );
});

/** estimated plate width for the static figures (mono 12.5 px ≈ 7.6 px per character, plus padding) */
const plateW = (d: LabelDef) => Math.round((d.text.length + (d.sub ? d.sub.length + 1 : 0)) * 7.6 + 24);

/** The same plates over a static still (positions in % of the figure, clamped inside it) */
export function StaticLabels({ labels, w, h, layout, only }: { labels: Record<string, LabelPoint>; w: number; h: number; layout: "wide" | "tall"; only?: string[] }) {
  const defs = LABEL_DEFS.filter((d) => (only ? only.includes(d.id) : true) && (labels[d.id]?.a ?? 0) > 0.5);
  const pins = PINS.filter((p) => (labels[p]?.a ?? 0) > 0.5);
  const craft = (labels[CRAFT]?.a ?? 0) > 0.5 ? labels[CRAFT] : null;
  return (
    <div className="lab lab--static" aria-hidden="true">
      <svg className="lab__svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {defs.map((d) => {
          const L = labels[d.id];
          const p = place(d, L, layout, w, h, plateW(d), 27);
          return (
            <g key={d.id} className={`lab__k lab__k--${d.kind}`}>
              <line x1={L.x} y1={L.y} x2={p.ex} y2={p.ey} vectorEffect="non-scaling-stroke" />
              {!d.pin && <circle cx={L.x} cy={L.y} r={3.5} vectorEffect="non-scaling-stroke" />}
            </g>
          );
        })}
        {pins.map((p) => (
          <g key={p} className="lab__pin" transform={`translate(${labels[p].x} ${labels[p].y})`}>
            <circle r={6.5} />
            <circle r={2.2} className="lab__pin-c" />
          </g>
        ))}
        {craft ? (
          <g className="lab__craft" transform={`translate(${craft.x} ${craft.y})`}>
            <CraftGlyph />
          </g>
        ) : null}
      </svg>
      {defs.map((d) => {
        const L = labels[d.id];
        const p = place(d, L, layout, w, h, plateW(d), 27);
        return (
          <div key={d.id} className={`lab__p lab__p--${d.kind}`} style={{ left: `${(p.x0 / w) * 100}%`, top: `${(p.y0 / h) * 100}%` }}>
            {d.kind === "sample" ? (
              <>
                <span className="lab__tag">SAMPLE</span> {d.text.replace("SAMPLE ", "")}
              </>
            ) : (
              d.text
            )}
            {d.sub ? <span className="lab__sub">{d.sub}</span> : null}
          </div>
        );
      })}
    </div>
  );
}
