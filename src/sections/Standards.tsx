import { useRef } from "react";
import { Link } from "react-router-dom";
import { BUSINESS, CTA_LONG, PILOT, SIGNOFF, STANDARDS } from "../data/copy";
import { MEDIA } from "../data/media";
import { Arrow, SectionLabel } from "../components/Motifs";
import { PhotoSlot } from "../components/Photo";
import { useReveal } from "../lib/motion";
import "../styles/standards.css";

export function Standards() {
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);
  return (
    <section ref={ref} id="standards" className="section stds" aria-labelledby="stds-title">
      <div className="wrap stds__grid">
        <div className="stds__copy">
          <SectionLabel idx="08">Standards</SectionLabel>
          <h2 id="stds-title" className="h2" data-reveal>
            {STANDARDS.title}
          </h2>
          <p className="lead" data-reveal style={{ ["--i" as string]: 1 }}>
            {STANDARDS.text}
          </p>
          <div className="stds__rules" data-reveal style={{ ["--i" as string]: 2 }}>
            <p className="mono mono--s smoke">{STANDARDS.rule}</p>
            <ol>
              {STANDARDS.items.map((it, i) => (
                <li key={it}>
                  <span className="mono mono--s smoke">{String.fromCharCode(65 + i)}</span>
                  <span>{it}</span>
                </li>
              ))}
            </ol>
            <p className="stds__cert mono mono--s smoke">Pilot certificate: {PILOT.cert}</p>
          </div>
        </div>
        <PhotoSlot media={MEDIA.standardsPreflight} kind="preflight" ratio={[3, 2]} seed={44} className="stds__photo" origin={["30%", "30%"]} />
      </div>
    </section>
  );
}

export function CtaBand() {
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);
  return (
    <section ref={ref} className="cta" aria-labelledby="cta-title">
      <PhotoSlot media={MEDIA.ctaRidgeSmoke} kind="cta" ratio={[21, 9]} seed={52} className="cta__photo" origin={["78%", "55%"]} sizes="100vw" />
      <div className="cta__scrim" aria-hidden="true" />
      <div className="wrap cta__in">
        <p className="mono smoke cta__kicker" data-reveal>
          {BUSINESS.name}
        </p>
        <h2 id="cta-title" className="cta__title display" data-reveal style={{ ["--i" as string]: 1 }}>
          {SIGNOFF}
        </h2>
        <div className="cta__actions" data-reveal style={{ ["--i" as string]: 2 }}>
          <Link to="/proposal" className="btn btn--ember btn--lg">
            {CTA_LONG}
            <Arrow />
          </Link>
          <a className="cta__phone mono" href={BUSINESS.phoneHref}>
            or call {BUSINESS.phone}
          </a>
        </div>
      </div>
    </section>
  );
}
