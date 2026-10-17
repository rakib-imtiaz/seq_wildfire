import { useRef, type ReactNode } from "react";
import { SERVICES } from "../data/copy";
import { MEDIA, PAIRS, type MediaSlot } from "../data/media";
import { Arrow, Reticle, SampleTag, SectionLabel } from "../components/Motifs";
import { PhotoSlot, ThermalPair } from "../components/Photo";
import { ALL_LAYERS, SampleMap } from "../components/SampleMap";
import { SceneArt } from "../components/SceneArt";
import { useReveal } from "../lib/motion";
import "../styles/services.css";

function LiveFeed() {
  return (
    <PhotoSlot media={MEDIA.svcLiveFeed} kind="live-feed" ratio={[16, 9]} seed={21} origin={["50%", "50%"]} className="feed">
      <div className="feed__ui" aria-hidden="true">
        <div className="feed__top mono mono--s">
          <span className="feed__live">
            <span className="live-dot" />
            Live feed
          </span>
          <SampleTag>Sample feed</SampleTag>
        </div>
        <Reticle className="feed__reticle" />
      </div>
    </PhotoSlot>
  );
}

/** A report thumbnail: the canopy pair from row 2, framed on the stump (IMG 0412 in both places). */
function ReportThumb({ media, mode }: { media: MediaSlot; mode: "visible" | "thermal" }) {
  return (
    <div className="svc-report__thumb">
      {media.src ? (
        <div className="svc-report__img">
          <img src={media.src} srcSet={media.srcset} sizes="(min-width: 1024px) 480px, 70vw" alt="" loading="lazy" decoding="async" />
        </div>
      ) : (
        <SceneArt kind="canopy" mode={mode} ratio={[1, 1]} seed={8} />
      )}
      <span className="mono mono--s">IMG 0412 &middot; {mode === "visible" ? "Visible" : "Thermal"}</span>
    </div>
  );
}

function ReportCard() {
  return (
    <div className="svc-report" aria-label="Sample monitoring report">
      <div className="svc-report__head">
        <p className="mono mono--s">Monitoring report &middot; Sample watch zone 07</p>
        <SampleTag />
      </div>
      <div className="svc-report__thumbs" aria-hidden="true">
        <ReportThumb media={PAIRS.svcCanopy.visible} mode="visible" />
        <ReportThumb media={PAIRS.svcCanopy.thermal} mode="thermal" />
      </div>
      <dl className="report__rows mono mono--s">
        <div>
          <dt>Flight record</dt>
          <dd>FLT-07 &middot; M3T</dd>
        </div>
        <div>
          <dt>Thermal observations</dt>
          <dd>1 hotspot &middot; 312 &deg;C</dd>
        </div>
        <div>
          <dt>Follow-up</dt>
          <dd>Additional monitoring</dd>
        </div>
      </dl>
    </div>
  );
}

/** The brief's first sentence for each service: the rest is detail the page doesn't need. */
const firstSentence = (t: string) => t.match(/^.*?\.(?=\s|$)/)?.[0] ?? t;

const VISUALS: (() => ReactNode)[] = [
  () => <PhotoSlot media={MEDIA.svcPatrol} kind="patrol" ratio={[4, 3]} seed={17} origin={["26%", "63%"]} />,
  () => (
    <div className="svc-pair">
      <ThermalPair pair={PAIRS.svcCanopy} kind="canopy" ratio={[4, 3]} seed={8} rest={[0.67, 0.28]} label="Thermal lens" sizes="(min-width: 1024px) 46vw, 100vw" />
    </div>
  ),
  () => (
    <div className="svc-map">
      <SampleMap layers={ALL_LAYERS} time={2} labels={false} title="Sample map still: all six layers" />
      <div className="svc-map__foot">
        <a href="#mapping" className="textlink mono mono--s">
          <span>Try the sample map</span>
          <Arrow />
        </a>
      </div>
    </div>
  ),
  () => <LiveFeed />,
  () => <ReportCard />,
];

export function Services() {
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);
  return (
    <section ref={ref} id="services" className="section svcs" aria-labelledby="svcs-title">
      <div className="wrap">
        <div className="svcs__head">
          <SectionLabel idx="04">Five services, one team</SectionLabel>
          <h2 id="svcs-title" className="h2" data-reveal>
            {SERVICES.title}
          </h2>
        </div>

        <ol className="svcs__list">
          {SERVICES.items.map((s, i) => (
            <li key={s.n} className="svc" data-flip={i % 2 === 1 ? "" : undefined}>
              <div className="svc__copy" data-reveal>
                <p className="svc__n mono">{s.n}</p>
                <h3 className="h3 svc__title">{s.title}</h3>
                <p className="body">{firstSentence(s.text)}</p>
              </div>
              <div className="svc__vis">{VISUALS[i]()}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
