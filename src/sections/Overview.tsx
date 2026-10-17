import type { ReactNode } from "react";
import { MEDIA } from "../data/media";
import "../styles/landing.css";

/** Faint contour lines behind the copy: distorted rings, computed once. */
const TOPO = (() => {
  const paths: string[] = [];
  const [cx, cy] = [120, 330];
  for (let k = 0; k < 12; k++) {
    const r = 40 + k * 32;
    const pts: string[] = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      const rr = r * (1 + 0.16 * Math.sin(3 * a + k * 0.55) + 0.07 * Math.sin(5 * a - k * 0.9));
      pts.push(`${(cx + rr * Math.cos(a) * 1.3).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`);
    }
    paths.push(`M${pts.join("L")}Z`);
  }
  return paths;
})();

const crop = (name: string, widths: number[]) => ({
  src: `/media/photos/${name}-${widths[widths.length - 1]}.webp`,
  srcSet: widths.map((w) => `/media/photos/${name}-${w}.webp ${w}w`).join(", "),
});

/** Line icons for the four cards (ember stroke, 24 px grid). */
const ICONS: Record<string, ReactNode> = {
  observe: (
    <>
      <circle cx="7" cy="15" r="4" />
      <circle cx="17" cy="15" r="4" />
      <path d="M10.2 12.6 12 11l1.8 1.6M5 11.5 7 5h2.5l.8 4M19 11.5 17 5h-2.5l-.8 4" />
    </>
  ),
  detect: (
    <path d="M7 5c-1.6 2.3 1.6 4.2 0 6.5s1.6 4.2 0 6.5M12 4c-1.6 2.3 1.6 4.4 0 6.7s1.6 4.4 0 6.8M17 5c-1.6 2.3 1.6 4.2 0 6.5s1.6 4.2 0 6.5" />
  ),
  map: <path d="M3.5 6.5 9 4.5l6 2 5.5-2v13l-5.5 2-6-2-5.5 2Zm5.5-2v13m6-11v13" />,
  report: (
    <>
      <path d="M6 3.5h8.5L19 8v12.5H6Z" />
      <path d="M14.5 3.5V8H19M9 12h7M9 15h7M9 18h4.5" />
    </>
  ),
};

type Card = { id: string; verb: string; note: string; text: string; img: { src: string; srcSet: string }; alt: string; mark?: boolean };

const CARDS: Card[] = [
  {
    id: "observe",
    verb: "Observe",
    note: "Ground patrols",
    text: "Ground-level patrols and visual identification of smoke or fire, conducted by trained personnel.",
    img: crop("landing-observe", [480, 800, 1200]),
    alt: "A fire watch guard on a ridge at dusk scanning the valley with binoculars.",
  },
  {
    id: "detect",
    verb: "Detect",
    note: "Aerial thermal imaging",
    text: "Aerial thermal imaging designed to identify heat signatures and potential hazards early.",
    img: crop("landing-detect", [340, 680]),
    alt: "A thermal drone in flight over the ridges at dusk.",
  },
  {
    id: "map",
    verb: "Map",
    note: "Geospatial mapping",
    text: "Geospatial mapping to locate and track observations across the monitoring area.",
    img: crop("landing-map", [480, 800, 1000]),
    alt: "Aerial view of a smouldering stump in a forest clearing, marked as a sample observation.",
    mark: true,
  },
  {
    id: "report",
    verb: "Report",
    note: "Structured reports",
    text: "Clear, structured reports to support informed decision-making.",
    img: crop("landing-report", [480, 800, 1200]),
    alt: "A topographic map, a rugged tablet, a radio and a drone case on an operations table.",
  },
];

const CARD_SIZES = "(min-width: 1024px) 22vw, 46vw";

/** Section 01 (the user's comp), right under the 3D hero: statement over the ground + sky photo, then the four verbs as cards. */
export function Overview() {
  const photo = MEDIA.statementGroundAndSky;
  return (
    <section className="land" aria-labelledby="overview-title">
      <div className="land__band">
        <div className="land__media">
          {photo.src && (
            <img
              className="land__photo"
              src={photo.src}
              srcSet={photo.srcset}
              sizes="(min-width: 1024px) 70vw, 100vw"
              alt="A fire watch guard on a ridge at dusk flying a thermal drone out over the valley toward a distant smoke column."
              loading="lazy"
              decoding="async"
            />
          )}
        </div>
        <svg className="land__topo" viewBox="0 0 700 660" preserveAspectRatio="xMinYMid slice" aria-hidden="true" focusable="false">
          {TOPO.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </svg>

        <div className="wrap land__copy">
          <p className="land__eyebrow mono" data-reveal>
            <span className="land__idx">01</span>
            <span className="land__rule" aria-hidden="true" />
            <span>Beyond ground-level observation</span>
          </p>
          <h2 id="overview-title" className="land__title display">
            <span className="land__a" data-reveal style={{ ["--i" as string]: 1 }}>
              Traditional <br />
              fire watch observes.
            </span>
            <span className="land__b" data-reveal style={{ ["--i" as string]: 2 }}>
              Sequoia Security <br />
              is designed to <br />
              <em>
                observe, detect, <br />
                map, and report.
              </em>
            </span>
          </h2>
          <p className="land__lead" data-reveal style={{ ["--i" as string]: 3 }}>
            Drone-enhanced wildfire monitoring and fire watch services designed to deliver wider visibility, earlier detection, and actionable
            intelligence for high-risk areas across British Columbia.
          </p>
        </div>
      </div>

      <div className="wrap">
        <ol className="land__cards">
          {CARDS.map((c, i) => (
            <li key={c.id} className="land__card" data-reveal style={{ ["--i" as string]: i }}>
              <p className="land__n mono mono--s">
                <span className="land__dash" aria-hidden="true" />
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="land__verb display">{c.verb}</h3>
              <p className="land__note mono mono--s">{c.note}</p>
              <figure className="land__img">
                <img src={c.img.src} srcSet={c.img.srcSet} sizes={CARD_SIZES} alt={c.alt} loading="lazy" decoding="async" />
                {c.mark && (
                  <svg className="land__mark" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                    <path d="M30 22H22v8M70 22h8v8M30 78H22v-8M70 78h8v-8" />
                    <path d="M50 38v24M38 50h24" />
                    <circle cx="50" cy="50" r="4.5" />
                  </svg>
                )}
              </figure>
              <div className="land__foot">
                <span className="land__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    {ICONS[c.id]}
                  </svg>
                </span>
                <p className="land__text">{c.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
