import { useEffect, useRef, type ReactNode } from "react";
import { motionOn, useInView } from "../lib/motion";

/** Section index label: "03 ── How it works" */
export function SectionLabel({ idx, children }: { idx: string; children: ReactNode }) {
  return (
    <p className="label mono" data-reveal>
      <span className="label__idx">{idx}</span>
      <span className="label__rule" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** The SAMPLE tag that goes on every demo readout. */
export function SampleTag({ children = "Sample" }: { children?: ReactNode }) {
  return <span className="sample mono mono--s">{children}</span>;
}

/** Telemetry strip: mono items split by hairlines. */
export function Stamp({ items, sample = true, live = false, className = "" }: { items: ReactNode[]; sample?: boolean; live?: boolean; className?: string }) {
  return (
    <p className={`stamp mono mono--s ${className}`}>
      {live && <span className="live-dot" aria-hidden="true" />}
      {items.map((it, i) => (
        <span key={i} className="stamp__item">
          {it}
        </span>
      ))}
      {sample && <SampleTag />}
    </p>
  );
}

/** A T+hh:mm:ss stamp that ticks once a second while visible (static when motion is off). */
export function Ticker({ from = "00:14:32", prefix = "T+" }: { from?: string; prefix?: string }) {
  const [ref, inView] = useInView<HTMLSpanElement>("0px");
  const t = useRef(toSec(from));
  useEffect(() => {
    if (!inView || !motionOn()) return;
    const id = window.setInterval(() => {
      t.current += 1;
      if (ref.current) ref.current.textContent = prefix + fmt(t.current);
    }, 1000);
    return () => window.clearInterval(id);
  }, [inView, prefix, ref]);
  return (
    <span ref={ref} className="ticker">
      {prefix + fmt(t.current)}
    </span>
  );
}

function toSec(s: string) {
  const [h, m, sec] = s.split(":").map(Number);
  return h * 3600 + m * 60 + sec;
}
function fmt(n: number) {
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

/** Thermal reticle: broken ring, centre cross, corner brackets. */
export function Reticle({ className = "", brackets = true }: { className?: string; brackets?: boolean }) {
  return (
    <svg className={`reticle ${className}`} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke">
        <path d="M50 14 A36 36 0 0 1 86 50" vectorEffect="non-scaling-stroke" />
        <path d="M86 50 A36 36 0 0 1 50 86" vectorEffect="non-scaling-stroke" opacity="0.35" />
        <path d="M50 86 A36 36 0 0 1 14 50" vectorEffect="non-scaling-stroke" />
        <path d="M14 50 A36 36 0 0 1 50 14" vectorEffect="non-scaling-stroke" opacity="0.35" />
        <path d="M50 4 V20 M50 80 V96 M4 50 H20 M80 50 H96" vectorEffect="non-scaling-stroke" />
        <path d="M46 50 H54 M50 46 V54" vectorEffect="non-scaling-stroke" />
        {brackets && (
          <path
            d="M2 12 V2 H12 M88 2 H98 V12 M98 88 V98 H88 M12 98 H2 V88"
            vectorEffect="non-scaling-stroke"
            opacity="0.6"
          />
        )}
      </g>
    </svg>
  );
}

/** Ironbow heat-ramp legend (heat data only). */
export function HeatLegend({ ticks = ["0 °C", "150", "300", "500 °C"], caption = "Thermal scale · low gain", className = "" }: { ticks?: string[]; caption?: string; className?: string }) {
  return (
    <div className={`heatlegend ${className}`}>
      <div className="heatlegend__bar" aria-hidden="true" />
      <div className="heatlegend__ticks mono mono--s" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <p className="heatlegend__cap mono mono--s smoke">{caption}</p>
    </div>
  );
}

/** Small arrow used in buttons/links. */
export function Arrow({ className = "btn__arrow" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path d="M1 7 H12 M8 3 L12 7 L8 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
    </svg>
  );
}

/** Corner frame brackets for camera-like frames. */
export function FrameCorners({ className = "" }: { className?: string }) {
  return (
    <span className={`corners ${className}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
