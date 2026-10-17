import { useEffect, useRef, useState } from "react";
import { MAPPING, type LayerId } from "../data/copy";
import { HeatLegend, SectionLabel } from "../components/Motifs";
import { ALL_LAYERS, SampleMap, type Layers } from "../components/SampleMap";
import { useReveal } from "../lib/motion";
import { useZone } from "../lib/zone";
import "../styles/mapsection.css";

/** Small legend glyph per layer, matching the map styling. */
function Swatch({ id }: { id: LayerId }) {
  switch (id) {
    case "hotspots":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="#ffe6a0" strokeWidth="1.2" />
          <circle cx="12" cy="12" r="4.5" fill="#ffe6a0" />
        </svg>
      );
    case "affected":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 15 L8 6 L17 5 L20 13 L13 19Z" fill="rgba(255,158,27,0.3)" stroke="#ff9e1b" strokeWidth="1.3" />
        </svg>
      );
    case "infra":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 18 L21 6" stroke="#ece7e0" strokeWidth="1.2" />
          <rect x="1.5" y="15" width="5" height="5" fill="#0f0e0d" stroke="#ece7e0" strokeWidth="1.2" />
          <rect x="16" y="3" width="6" height="6" fill="rgba(236,231,224,0.15)" stroke="#ece7e0" strokeWidth="1.2" />
        </svg>
      );
    case "patrol":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2 18 C8 18 10 6 22 6" fill="none" stroke="#ff6a1f" strokeWidth="1.6" strokeDasharray="4 3" />
          <circle cx="16" cy="16" r="3" fill="#ece7e0" />
        </svg>
      );
    case "change":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 12 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0" fill="none" stroke="#a2195b" strokeWidth="1.2" strokeDasharray="2 2" />
          <path d="M4.5 12 a7.5 7.5 0 1 0 15 0 a7.5 7.5 0 1 0 -15 0" fill="none" stroke="#ff9e1b" strokeWidth="1.2" strokeDasharray="2 2" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <defs>
            <pattern id="sw-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M0 0 V4" stroke="#e8452c" strokeWidth="1.6" />
            </pattern>
          </defs>
          <rect x="3" y="5" width="18" height="14" fill="url(#sw-hatch)" stroke="#e8452c" strokeWidth="1.2" strokeDasharray="3 2" />
        </svg>
      );
  }
}

function usePhoneMap() {
  const q = "(max-width: 767px)";
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const f = () => setM(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return m;
}

export function MapSection() {
  const ref = useRef<HTMLElement>(null);
  const zone = useZone();
  const phone = usePhoneMap();
  const [layers, setLayers] = useState<Layers>(ALL_LAYERS);
  const [time, setTime] = useState(2);
  useReveal(ref);

  const toggle = (id: LayerId) => setLayers((l) => ({ ...l, [id]: !l[id] }));
  const allOn = Object.values(layers).every(Boolean);
  const times = zone?.perimeters.map((p) => p.t) ?? ["T+00:00", "T+00:25", "T+00:50"];

  return (
    <section ref={ref} id="mapping" className="section mapsec" aria-labelledby="map-title">
      <div className="wrap">
        <div className="mapsec__head">
          <SectionLabel idx="05">Hands-on sample</SectionLabel>
          <h2 id="map-title" className="h2" data-reveal>
            {MAPPING.title}
          </h2>
          <p className="lead" data-reveal style={{ ["--i" as string]: 1 }}>
            {MAPPING.intro}
          </p>
        </div>

        <div className="mapsec__ws">
          <div className="mapsec__mapcol">
            <div className="mapsec__frame">
              <SampleMap layers={layers} time={time} crop={phone ? "focus" : "full"} interactive title="Interactive sample wildfire map of a fictional watch zone" />
              <p className="mapsec__stamp mono mono--s" aria-hidden="true">
                {MAPPING.stamp}
              </p>
              <p className="mapsec__north mono mono--s" aria-hidden="true">
                <svg viewBox="0 0 12 16" aria-hidden="true">
                  <path d="M6 1 L11 15 L6 11 L1 15Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                N
              </p>
              <div className="mapsec__scale mono mono--s" aria-hidden="true">
                <span>200 m</span>
                <i style={{ width: `${(200 / (phone ? 1240 : 1600)) * 100}%` }} />
              </div>
            </div>
            <p className="mapsec__note body">{MAPPING.note}</p>
          </div>

          <div className="mapsec__panel">
            <fieldset className="mapsec__group">
              <legend className="mapsec__legend mono mono--s">
                <span>Layers</span>
                <button type="button" className="mapsec__all mono mono--s" onClick={() => setLayers(allOn ? { hotspots: true, affected: false, infra: false, patrol: false, change: false, escalation: false } : ALL_LAYERS)}>
                  {allOn ? "Hotspots only" : "Show all"}
                </button>
              </legend>
              <ul className="mapsec__layers">
                {MAPPING.layers.map((l) => (
                  <li key={l.id}>
                    <button type="button" className="layer" aria-pressed={layers[l.id]} onClick={() => toggle(l.id)} title={l.brief}>
                      <span className="layer__sw">
                        <Swatch id={l.id} />
                      </span>
                      <span className="layer__txt">
                        <span className="layer__name">{l.label}</span>
                        <span className="layer__brief">{l.brief}</span>
                      </span>
                      <span className="layer__state" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </fieldset>

            <div className="mapsec__group">
              <label htmlFor="map-time" className="mapsec__legend mono mono--s">
                <span>Time</span>
                <span className="mapsec__tval">
                  {times[time]} <span className="sample">Sample</span>
                </span>
              </label>
              <input
                id="map-time"
                className="scrub"
                type="range"
                min={0}
                max={2}
                step={1}
                value={time}
                onChange={(e) => setTime(Number(e.target.value))}
                aria-valuetext={`${times[time]}, sample time ${time + 1} of 3`}
                style={{ ["--t" as string]: time / 2 }}
              />
              <div className="scrub__ticks">
                {times.map((t, i) => (
                  <button key={t} type="button" className="scrub__tick mono mono--s" aria-pressed={i === time} onClick={() => setTime(i)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="mapsec__group">
              <HeatLegend />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
