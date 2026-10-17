import { useEffect, useRef, useState } from "react";
import { PILOT } from "../data/copy";
import { MEDIA } from "../data/media";
import { FrameCorners, SectionLabel } from "../components/Motifs";
import { PhotoSlot } from "../components/Photo";
import { motionOn, useReveal } from "../lib/motion";
import { loadM3TModule, safe, type TableHandle } from "../lib/table3d";
import "../styles/pilot.css";

/** Top-view schematic of the M3T (placeholder for the 3D sculpt). Dimensions from FACTS §3. */
function M3TSchematic() {
  const cx = 400;
  const cy = 250;
  const motors: [number, number][] = [
    [cx + 158, cy - 128],
    [cx + 158, cy + 128],
    [cx - 150, cy - 136],
    [cx - 150, cy + 136],
  ];
  return (
    <svg className="m3t__svg" viewBox="0 0 800 500" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="m3t-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0 H0 V20" fill="none" stroke="rgba(236,231,224,0.045)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="800" height="500" fill="url(#m3t-grid)" />
      <g fill="none" stroke="rgba(236,231,224,0.85)" strokeWidth="1.2" strokeLinejoin="round">
        {/* rotor discs */}
        {motors.map(([x, y], i) => (
          <circle key={`d${i}`} cx={x} cy={y} r="96" stroke="rgba(236,231,224,0.22)" strokeDasharray="3 6" />
        ))}
        {/* arms */}
        <path d={`M${cx + 52} ${cy - 30} L${motors[0][0]} ${motors[0][1]} M${cx + 52} ${cy + 30} L${motors[1][0]} ${motors[1][1]}`} strokeWidth="10" stroke="rgba(236,231,224,0.16)" />
        <path d={`M${cx - 60} ${cy - 28} L${motors[2][0]} ${motors[2][1]} M${cx - 60} ${cy + 28} L${motors[3][0]} ${motors[3][1]}`} strokeWidth="10" stroke="rgba(236,231,224,0.16)" />
        <path d={`M${cx + 52} ${cy - 30} L${motors[0][0]} ${motors[0][1]} M${cx + 52} ${cy + 30} L${motors[1][0]} ${motors[1][1]} M${cx - 60} ${cy - 28} L${motors[2][0]} ${motors[2][1]} M${cx - 60} ${cy + 28} L${motors[3][0]} ${motors[3][1]}`} />
        {/* motors */}
        {motors.map(([x, y], i) => (
          <g key={`m${i}`}>
            <circle cx={x} cy={y} r="17" fill="#171615" />
            <circle cx={x} cy={y} r="6" />
          </g>
        ))}
        {/* body */}
        <path d={`M${cx - 98} ${cy - 40} H${cx + 70} Q${cx + 96} ${cy - 40} ${cx + 100} ${cy - 18} V${cy + 18} Q${cx + 96} ${cy + 40} ${cx + 70} ${cy + 40} H${cx - 98} Q${cx - 112} ${cy + 40} ${cx - 112} ${cy + 26} V${cy - 26} Q${cx - 112} ${cy - 40} ${cx - 98} ${cy - 40}Z`} fill="#1d1b19" />
        <path d={`M${cx - 70} ${cy - 22} H${cx + 30} M${cx - 70} ${cy + 22} H${cx + 30}`} stroke="rgba(236,231,224,0.3)" />
        <rect x={cx - 30} y={cy - 9} width="22" height="18" stroke="rgba(236,231,224,0.45)" />
        {/* gimbal + three lenses */}
        <rect x={cx + 104} y={cy - 30} width="34" height="60" fill="#171615" />
        <circle cx={cx + 121} cy={cy - 15} r="8" />
        <circle cx={cx + 121} cy={cy + 3} r="5.5" />
        <circle cx={cx + 121} cy={cy + 19} r="5.5" />
      </g>
      {/* dimension lines */}
      <g stroke="rgba(236,231,224,0.45)" strokeWidth="1" fill="none">
        <path d={`M${motors[2][0] - 17} 452 H${motors[0][0] + 17} M${motors[2][0] - 17} 444 V460 M${motors[0][0] + 17} 444 V460`} />
        <path d={`M52 ${motors[2][1] - 17} V${motors[3][1] + 17} M44 ${motors[2][1] - 17} H60 M44 ${motors[3][1] + 17} H60`} />
      </g>
      <g className="m3t__txt">
        <text x={cx} y="476" textAnchor="middle">347.5 mm</text>
        <text x="64" y={cy} dominantBaseline="middle">283 mm</text>
        <text x="44" y="50">M3T &#183; Top view &#183; Unfolded</text>
        <text x="44" y="72" className="m3t__dim">{PILOT.dims.unfolded}</text>
      </g>
      {/* lens callouts */}
      <g className="m3t__call" stroke="rgba(236,231,224,0.6)" fill="none">
        <path d={`M${cx + 129} ${cy - 15} L${cx + 196} ${cy - 70} H${cx + 236}`} />
        <path d={`M${cx + 126} ${cy + 3} L${cx + 210} ${cy + 3} H${cx + 236}`} />
        <path d={`M${cx + 126} ${cy + 19} L${cx + 196} ${cy + 76} H${cx + 236}`} />
      </g>
      <g className="m3t__txt m3t__txt--call">
        <text x={cx + 242} y={cy - 66}>Thermal</text>
        <text x={cx + 242} y={cy + 7}>Wide</text>
        <text x={cx + 242} y={cy + 80}>Tele</text>
      </g>
    </svg>
  );
}

/** The specs worth a glance (the full list stays in copy.ts). */
const KEY_SPECS = ["Thermal", "Low gain", "Wide", "Hybrid zoom", "Flight time", "Weight"];

export function Pilot() {
  const ref = useRef<HTMLElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  useReveal(ref);

  // optional 3D sculpt (public/table/js/m3t.js exporting mountM3T); silently keeps the schematic if absent
  useEffect(() => {
    const el = slotRef.current;
    if (!el) return;
    let handle: TableHandle | null = null;
    let gone = false;
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            ([e]) => {
              if (!e.isIntersecting) return;
              io?.disconnect();
              loadM3TModule().then((mod) => {
                if (!mod || gone) return;
                try {
                  handle = mod.mountM3T(el, { onReady: () => setLive(true), motion: motionOn() }) ?? null;
                } catch {
                  handle = null;
                }
              });
            },
            { rootMargin: "60% 0px" },
          )
        : null;
    io?.observe(el);
    return () => {
      gone = true;
      io?.disconnect();
      if (handle) safe(() => handle?.dispose?.());
    };
  }, []);

  return (
    <section ref={ref} id="pilot" className="section pilot" aria-labelledby="pilot-title">
      <div className="wrap">
        <div className="pilot__top">
          <div className="pilot__copy">
            <SectionLabel idx="03">Guard and pilot</SectionLabel>
            <h2 id="pilot-title" className="h2 pilot__title" data-reveal>
              {PILOT.title}
            </h2>
            <p className="lead" data-reveal style={{ ["--i" as string]: 1 }}>
              {PILOT.text}
            </p>
          </div>
          <PhotoSlot media={MEDIA.pilotPortrait} kind="pilot" ratio={[4, 5]} seed={11} className="pilot__portrait" origin={["46%", "68%"]} sizes="(min-width: 1024px) 30vw, (min-width: 560px) 520px, 100vw" />
        </div>

        <div className="pilot__kit">
          <div ref={slotRef} className="m3t" data-slot="m3t" data-live={live ? "" : undefined}>
            <div className="m3t__ph">
              <M3TSchematic />
            </div>
            <FrameCorners />
          </div>
          <div className="pilot__specs">
            <p className="mono mono--s smoke pilot__specs-head">
              <span>{PILOT.aircraft}</span>
              <span>{PILOT.specSource}</span>
            </p>
            <ul className="chips" aria-label="Aircraft specifications">
              {PILOT.specs.filter((s) => KEY_SPECS.includes(s.k)).map((s, i) => (
                <li key={s.k} className="chip" data-reveal style={{ ["--i" as string]: i % 4 }}>
                  <span className="chip__k mono mono--s">{s.k}</span>
                  <span className="chip__v mono">{s.v}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
