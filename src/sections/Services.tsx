import { useRef, type ReactNode } from "react";
import { SERVICES } from "../data/copy";
import { MEDIA, PAIRS } from "../data/media";
import { Arrow, Reticle, SampleTag, SectionLabel, Stamp, Ticker } from "../components/Motifs";
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
        <div className="feed__bottom mono mono--s">
          <span>
            <Ticker from="00:21:05" />
          </span>
          <span className="feed__modes">
            <b>Thermal</b>
            <span>Wide</span>
            <span>Tele</span>
          </span>
          <span>Alt 120 m</span>
        </div>
      </div>
    </PhotoSlot>
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
        <div className="svc-report__thumb">
          <SceneArt kind="canopy" mode="visible" ratio={[1, 1]} seed={8} />
          <span className="mono mono--s">IMG 0412 &middot; Visible</span>
        </div>
        <div className="svc-report__thumb">
          <SceneArt kind="canopy" mode="thermal" ratio={[1, 1]} seed={8} />
          <span className="mono mono--s">IMG 0412 &middot; Thermal</span>
        </div>
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
          <dt>Geotagged imagery</dt>
          <dd>E +0395 N +0385</dd>
        </div>
        <div>
          <dt>Timestamps</dt>
          <dd>19:42 to 20:12</dd>
        </div>
        <div>
          <dt>Follow-up</dt>
          <dd>Additional monitoring</dd>
        </div>
      </dl>
    </div>
  );
}

const VISUALS: (() => ReactNode)[] = [
  () => <PhotoSlot media={MEDIA.svcPatrol} kind="patrol" ratio={[4, 3]} seed={17} origin={["84%", "83%"]} />,
  () => (
    <div className="svc-pair">
      <ThermalPair pair={PAIRS.svcCanopy} kind="canopy" ratio={[4, 3]} seed={8} rest={[0.56, 0.46]} label="Thermal lens" />
      <Stamp items={["IMG 0412", "Iron Red palette", "640×512"]} />
    </div>
  ),
  () => (
    <div className="svc-map">
      <SampleMap layers={ALL_LAYERS} time={2} labels={false} title="Sample map still: all six layers" />
      <div className="svc-map__foot">
        <Stamp items={["6 layers", "3 sample times"]} />
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
                <p className="body">{s.text}</p>
                {"more" in s && s.more && <p className="body svc__more">{s.more}</p>}
              </div>
              <div className="svc__vis">{VISUALS[i]()}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
