import { forwardRef, useImperativeHandle, useRef } from "react";
import type { FrameInfo, InsetInfo, LabelPoint } from "../three/engine.js";
import { THERMAL_VIEW } from "../data/copy";

/**
 * The thermal lens's view in the heat beat, as a drone app shows it: the engine composites the lens's own render
 * into a corner of the canvas (FrameInfo.ir); this draws its frame over the same rect: the lens (with a cobalt key,
 * the colour of its footprint outline on the model), palette and gain, a spot meter on the hotspot with its reading,
 * and the palette scale; and a connector from under the reading down to the hotspot on the model.
 */
export interface ThermalLayer {
  update(f: FrameInfo): void;
}

function Readouts() {
  return (
    <>
      <div className="ir__bar">
        <span>
          <b className="ir__key" aria-hidden="true" />
          {THERMAL_VIEW.lens} <i>·</i> {THERMAL_VIEW.palette} <i>·</i> {THERMAL_VIEW.gain}
        </span>
        <span className="ir__sample">SAMPLE</span>
      </div>
      <div className="ir__scale">
        <span className="ir__ramp" />
        <span className="ir__ticks">
          {THERMAL_VIEW.scale.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </span>
      </div>
    </>
  );
}

function Spot({ x, y }: { x: number; y: number }) {
  return (
    <div className="ir__spot" style={{ transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)` }}>
      <svg className="ir__cross" viewBox="-12 -12 24 24" width="24" height="24" aria-hidden="true">
        <path d="M-11 0 H-4 M4 0 H11 M0 -11 V-4 M0 4 V11" />
      </svg>
      <span className="ir__read">{THERMAL_VIEW.spot}</span>
    </div>
  );
}

/** a vertical S from (x1, y1) under the reading to (x2, y2) on the model */
const curve = (x1: number, y1: number, x2: number, y2: number) => {
  const my = (y1 + y2) / 2;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} C${x1.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
};

function Link({ d, x1, y1, x2, y2, scale }: { d: string; x1: number; y1: number; x2: number; y2: number; scale?: boolean }) {
  const ve = scale ? undefined : ("non-scaling-stroke" as const);
  return (
    <>
      <path className="ir__link-case" d={d} vectorEffect={ve} />
      <path className="ir__link" d={d} vectorEffect={ve} />
      <rect className="ir__link-a" x={x1 - 3} y={y1 - 3} width={6} height={6} />
      <circle className="ir__link-ring" cx={x2} cy={y2} r={9} />
      <circle className="ir__link-b" cx={x2} cy={y2} r={3} />
    </>
  );
}

export const ThermalFrame = forwardRef<ThermalLayer>(function ThermalFrame(_, ref) {
  const box = useRef<HTMLDivElement>(null);
  const spot = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  useImperativeHandle(ref, () => ({
    update(f) {
      const b = box.current, s = spot.current, g = svg.current;
      if (!b || !s || !g) return;
      const ir = f.ir;
      if (!ir || ir.a < 0.01) {
        if (b.style.visibility !== "hidden") b.style.visibility = g.style.visibility = "hidden";
        return;
      }
      b.style.visibility = g.style.visibility = "visible";
      b.style.opacity = g.style.opacity = String(ir.a);
      b.style.transform = `translate3d(${ir.x}px, ${ir.y}px, 0)`;
      b.style.width = `${ir.w}px`;
      b.style.height = `${ir.h}px`;
      s.style.transform = `translate3d(${ir.hx.toFixed(1)}px, ${ir.hy.toFixed(1)}px, 0)`;
      const hot = f.labels.hotspot;
      if (hot) {
        const x1 = ir.x + ir.hx, y1 = ir.y + ir.h, d = curve(x1, y1, hot.x, hot.y);
        const [cs, ln] = g.querySelectorAll("path");
        cs.setAttribute("d", d);
        ln.setAttribute("d", d);
        const a = g.querySelector("rect")!;
        a.setAttribute("x", (x1 - 3).toFixed(1));
        a.setAttribute("y", (y1 - 3).toFixed(1));
        g.querySelectorAll("circle").forEach((c) => {
          c.setAttribute("cx", hot.x.toFixed(1));
          c.setAttribute("cy", hot.y.toFixed(1));
        });
      }
    },
  }));
  return (
    <>
      <svg ref={svg} className="ir__links" aria-hidden="true" style={{ visibility: "hidden" }}>
        <Link d="" x1={0} y1={0} x2={0} y2={0} />
      </svg>
      <div ref={box} className="ir" style={{ visibility: "hidden" }} role="img" aria-label="SAMPLE thermal lens view: the hotspot reads 312 °C">
        <Readouts />
        <div ref={spot} className="ir__spot-at">
          <Spot x={0} y={0} />
        </div>
      </div>
    </>
  );
});

/** the same frame over a static still (positions in % of the figure) */
export function StaticThermalFrame({ ir, labels, w, h }: { ir: InsetInfo; labels: Record<string, LabelPoint>; w: number; h: number }) {
  if (!ir || ir.a < 0.5) return null;
  const pc = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;
  const hot = labels.hotspot;
  const x1 = ir.x + ir.hx, y1 = ir.y + ir.h;
  return (
    <>
      {hot ? (
        <svg className="ir__links" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
          <Link d={curve(x1, y1, hot.x, hot.y)} x1={x1} y1={y1} x2={hot.x} y2={hot.y} />
        </svg>
      ) : null}
      <div className="ir ir--static" style={{ left: pc(ir.x, w), top: pc(ir.y, h), width: pc(ir.w, w), height: pc(ir.h, h) }} role="img" aria-label="SAMPLE thermal lens view: the hotspot reads 312 °C">
        <Readouts />
        <div className="ir__spot-at" style={{ left: pc(ir.hx, ir.w), top: pc(ir.hy, ir.h) }}>
          <Spot x={0} y={0} />
        </div>
      </div>
    </>
  );
}
